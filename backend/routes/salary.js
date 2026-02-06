const express = require("express");
const router = express.Router();
const { Pool } = require("pg");
const multer = require("multer");
const xml2js = require("xml2js");
const iconv = require("iconv-lite");

const pool = new Pool({
  host: process.env.DB_HOST || "localhost",
  port: process.env.DB_PORT || 5433,
  database: process.env.DB_NAME || "postgres",
  user: process.env.DB_USER || "postgres",
  password: process.env.DB_PASSWORD
});

const upload = multer({ storage: multer.memoryStorage() });

// Загрузка XML ведомости
router.post("/upload", upload.single("file"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No file uploaded" });
  }

  try {
    // Декодируем windows-1251 в utf-8
    const xmlContent = iconv.decode(req.file.buffer, "windows-1251");
    
    // Парсим XML
    const parser = new xml2js.Parser({ explicitArray: false });
    const result = await parser.parseStringPromise(xmlContent);
    
    // Извлекаем данные из структуры 1С
    const root = result["СчетаПК"] || result.root;
    if (!root) {
      return res.status(400).json({ error: "Invalid XML format" });
    }

    const registerNumber = root.$.НомерРеестра || root.$["НомерРеестра"];
    const registerDate = root.$.ДатаРеестра || root.$["ДатаРеестра"];
    const organization = root.$.НаименованиеОрганизации || root.$["НаименованиеОрганизации"];
    const inn = root.$.ИНН || root.$["ИНН"];
    const externalId = root.$.ИдПервичногоДокумента || root.$["ИдПервичногоДокумента"] || null;
    
    // Получаем сотрудников
    const salaryData = root["ЗачислениеЗарплаты"] || root.ЗачислениеЗарплаты;
    let employees = salaryData?.["Сотрудник"] || salaryData?.Сотрудник || [];
    if (!Array.isArray(employees)) employees = [employees];
    
    // Считаем итого
    let totalAmount = 0;
    const parsedEmployees = employees.map(emp => {
      const amount = parseFloat((emp.Сумма || emp["Сумма"] || "0").replace(",", "."));
      totalAmount += amount;
      return {
        number: parseInt(emp.$.Нпп || emp.$["Нпп"] || 0),
        lastName: emp.Фамилия || emp["Фамилия"] || "",
        firstName: emp.Имя || emp["Имя"] || "",
        middleName: emp.Отчество || emp["Отчество"] || "",
        bankAccount: emp.ЛицевойСчет || emp["ЛицевойСчет"] || "",
        amount: amount
      };
    });

    // Проверяем дубликат по ИдПервичногоДокумента (если есть) или по номеру+дате+сумме
    let existingCheck;
    if (externalId) {
      existingCheck = await pool.query(
        "SELECT id FROM salary_registers WHERE external_id = $1",
        [externalId]
      );
    } else {
      // Fallback: проверяем по номеру + дате + сумме (для уникальности)
      existingCheck = await pool.query(
        "SELECT id FROM salary_registers WHERE register_number = $1 AND register_date = $2 AND total_amount = $3",
        [registerNumber, registerDate, totalAmount]
      );
    }
    
    if (existingCheck.rows.length > 0) {
      return res.status(400).json({ 
        error: "Ведомость уже загружена", 
        existing_id: existingCheck.rows[0].id 
      });
    }

    // Сохраняем реестр
    const regResult = await pool.query(`
      INSERT INTO salary_registers (register_number, register_date, organization, inn, total_amount, employees_count, file_name, external_id)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING id
    `, [registerNumber, registerDate, organization, inn, totalAmount, parsedEmployees.length, req.file.originalname, externalId]);
    
    const registerId = regResult.rows[0].id;

    // Сохраняем сотрудников и пытаемся связать с водителями
    for (const emp of parsedEmployees) {
      const fullName = `${emp.lastName} ${emp.firstName} ${emp.middleName}`.trim();
      
      // Ищем водителя по ФИО
      const driverSearch = await pool.query(`
        SELECT id FROM drivers 
        WHERE LOWER(full_name) = LOWER($1) 
           OR LOWER(full_name) LIKE LOWER($2)
        LIMIT 1
      `, [fullName, `${emp.lastName} ${emp.firstName}%`]);
      
      const driverId = driverSearch.rows[0]?.id || null;
      
      await pool.query(`
        INSERT INTO salary_payments (register_id, employee_number, last_name, first_name, middle_name, full_name, bank_account, amount, driver_id)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      `, [registerId, emp.number, emp.lastName, emp.firstName, emp.middleName, fullName, emp.bankAccount, emp.amount, driverId]);
    }

    res.json({
      success: true,
      register_id: registerId,
      register_number: registerNumber,
      register_date: registerDate,
      organization: organization,
      total_amount: totalAmount,
      employees_count: parsedEmployees.length,
      employees: parsedEmployees
    });

  } catch (err) {
    console.error("Salary upload error:", err);
    res.status(500).json({ error: String(err) });
  }
});

// Список ведомостей
router.get("/registers", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT id, register_number, register_date, organization, total_amount, employees_count, uploaded_at
      FROM salary_registers
      ORDER BY register_date DESC, uploaded_at DESC
    `);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// Детали ведомости
router.get("/registers/:id", async (req, res) => {
  try {
    const reg = await pool.query("SELECT * FROM salary_registers WHERE id = $1", [req.params.id]);
    const payments = await pool.query(`
      SELECT sp.*, d.full_name as driver_name
      FROM salary_payments sp
      LEFT JOIN drivers d ON sp.driver_id = d.id
      WHERE sp.register_id = $1
      ORDER BY sp.employee_number
    `, [req.params.id]);
    
    res.json({
      register: reg.rows[0],
      payments: payments.rows
    });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// Удаление ведомости
router.delete("/registers/:id", async (req, res) => {
  try {
    await pool.query("DELETE FROM salary_registers WHERE id = $1", [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// Сводка по водителям (для отчётов)
router.get("/summary", async (req, res) => {
  const { from, to, driver_id } = req.query;
  try {
    let query = `
      SELECT 
        sp.full_name,
        sp.driver_id,
        d.full_name as driver_name,
        SUM(sp.amount) as total_paid,
        COUNT(DISTINCT sp.register_id) as registers_count,
        MIN(sr.register_date) as first_payment,
        MAX(sr.register_date) as last_payment
      FROM salary_payments sp
      JOIN salary_registers sr ON sp.register_id = sr.id
      LEFT JOIN drivers d ON sp.driver_id = d.id
      WHERE 1=1
    `;
    const params = [];
    
    if (from) {
      params.push(from);
      query += ` AND sr.register_date >= $${params.length}`;
    }
    if (to) {
      params.push(to);
      query += ` AND sr.register_date <= $${params.length}`;
    }
    if (driver_id) {
      params.push(driver_id);
      query += ` AND sp.driver_id = $${params.length}`;
    }
    
    query += ` GROUP BY sp.full_name, sp.driver_id, d.full_name ORDER BY sp.full_name`;
    
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// Выплаты конкретному водителю
router.get("/by-driver/:driver_id", async (req, res) => {
  const { from, to } = req.query;
  try {
    let query = `
      SELECT sp.*, sr.register_number, sr.register_date
      FROM salary_payments sp
      JOIN salary_registers sr ON sp.register_id = sr.id
      WHERE sp.driver_id = $1
    `;
    const params = [req.params.driver_id];
    
    if (from) {
      params.push(from);
      query += ` AND sr.register_date >= $${params.length}`;
    }
    if (to) {
      params.push(to);
      query += ` AND sr.register_date <= $${params.length}`;
    }
    
    query += ` ORDER BY sr.register_date DESC`;
    
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

module.exports = router;

// Выплаты по ФИО водителя за период (для отчётов)
router.get("/by-name", async (req, res) => {
  const { name, from, to } = req.query;
  if (!name) return res.status(400).json({ error: "name required" });
  
  try {
    let query = `
      SELECT sp.id, sp.full_name, sp.amount, sr.register_date, sr.register_number
      FROM salary_payments sp
      JOIN salary_registers sr ON sp.register_id = sr.id
      WHERE LOWER(sp.full_name) LIKE LOWER($1)
    `;
    const params = [`%${name}%`];
    
    if (from) {
      params.push(from);
      query += ` AND sr.register_date >= $${params.length}`;
    }
    if (to) {
      params.push(to);
      query += ` AND sr.register_date <= $${params.length}`;
    }
    
    query += ` ORDER BY sr.register_date DESC`;
    
    const result = await pool.query(query, params);
    
    // Суммируем
    const total = result.rows.reduce((sum, r) => sum + Number(r.amount), 0);
    
    res.json({
      payments: result.rows,
      total: total,
      count: result.rows.length
    });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});
