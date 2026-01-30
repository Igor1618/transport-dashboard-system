const express = require('express');
const router = express.Router();
const multer = require('multer');
const xlsx = require('xlsx');
const pool = require('../config/database');
const path = require('path');

// Настройка multer для загрузки файлов
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  },
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ext !== '.xlsx' && ext !== '.xls') {
      return cb(new Error('Только Excel файлы разрешены'));
    }
    cb(null, true);
  },
});

// POST /api/upload
router.post('/', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'Файл не загружен' });
    }

    const filePath = req.file.path;
    const filename = req.file.originalname;

    // Чтение Excel файла
    const workbook = xlsx.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = xlsx.utils.sheet_to_json(worksheet);

    let rowsImported = 0;
    let rowsSkipped = 0;
    const skipReasons = [];
    const availableColumns = data.length > 0 ? Object.keys(data[0]) : [];
    const client = await pool.connect();

    // Логируем названия колонок для отладки
    if (data.length > 0) {
      console.log('Доступные колонки в Excel:', availableColumns);
      console.log('Первая строка данных:', data[0]);
    }

    try {
      await client.query('BEGIN');

      // Создание записи в import_log
      const importLogResult = await client.query(
        'INSERT INTO import_log (filename, rows_imported, rows_skipped, status) VALUES ($1, 0, 0, $2) RETURNING id',
        [filename, 'processing']
      );
      const importBatchId = importLogResult.rows[0].id;

      // Обработка каждой строки
      for (let i = 0; i < data.length; i++) {
        const row = data[i];
        try {
          // Маппинг колонок для файла Wildberries
          const wbTripNumber = String(row['№'] || '');  // Номер рейса (в Excel число)
          const loadingDT = parseDateTime(row['Дата открытия']); const loadingDate = loadingDT.date; const loadingTime = loadingDT.time;  // Формат: DD-MM-YYYY HH:MM
          const unloadingDT = parseDateTime(row['Дата закрытия']); const unloadingDate = unloadingDT.date; const unloadingTime = unloadingDT.time;
          const vehicleNumber = row['Номер ТС'] || '';
          const driverName = row['ФИО Водителя'] || '';  // С заглавной В!
          const routeName = row['Маршрут'] || '';
          const tripAmount = parseFloat(row['Сумма путевого листа']) || 0;
          const distanceKm = parseInt(row['Километраж']) || 0;
          const hasPenalty = (String(row['Штраф'] || '').trim().toLowerCase() === 'да');
          const penaltyAmount = parseFloat(row['Сумма штрафов']) || 0;
          const containersCount = parseInt(row['Контейнеры']) || 0;
          const distributionCenter = row['РЦ'] || '';

          // Проверка обязательных полей
          if (!wbTripNumber || !loadingDate || !driverName) {
            rowsSkipped++;
            const missingFields = [];
            if (!wbTripNumber) missingFields.push('№');
            if (!loadingDate) missingFields.push('Дата открытия');
            if (!driverName) missingFields.push('ФИО Водителя');
            skipReasons.push(`Строка ${i + 2}: отсутствуют поля ${missingFields.join(', ')}`);
            continue;
          }

          // Проверка на дубликаты
          const existingTrip = await client.query(
            'SELECT id FROM trips WHERE wb_trip_number = $1',
            [wbTripNumber]
          );

          if (existingTrip.rows.length > 0) {
            rowsSkipped++;
            skipReasons.push(`Строка ${i + 2}: дубликат рейса ${wbTripNumber}`);
            continue;
          }

          // Вставка данных
          await client.query(
            `INSERT INTO trips (
              wb_trip_number, loading_date, loading_time, unloading_date, unloading_time, vehicle_number,
              driver_name, route_name, trip_amount, distance_km,
              has_penalty, penalty_amount, containers_count, distribution_center, import_batch_id
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)`,
            [
              wbTripNumber,
              loadingDate, loadingTime,
              unloadingDate, unloadingTime,
              vehicleNumber,
              driverName,
              routeName,
              tripAmount,
              distanceKm,
              hasPenalty,
              penaltyAmount,
              containersCount,
              distributionCenter,
              importBatchId,
            ]
          );

          rowsImported++;
        } catch (err) {
          console.error('Ошибка обработки строки:', err);
          rowsSkipped++;
          skipReasons.push(`Строка ${i + 2}: ошибка - ${err.message}`);
        }
      }

      // Обновление import_log
      await client.query(
        'UPDATE import_log SET rows_imported = $1, rows_skipped = $2, status = $3 WHERE id = $4',
        [rowsImported, rowsSkipped, 'success', importBatchId]
      );

      await client.query('COMMIT');

      // Логируем первые 10 причин пропуска для отладки
      if (skipReasons.length > 0) {
        console.log('Первые причины пропуска строк:', skipReasons.slice(0, 10));
      }

      res.json({
        success: true,
        message: `Файл обработан: импортировано ${rowsImported}, пропущено ${rowsSkipped}`,
        rowsImported,
        rowsSkipped,
        skipReasons: skipReasons.slice(0, 20), // Возвращаем первые 20 причин
        totalRows: data.length,
        availableColumns: availableColumns, // Показываем доступные колонки
      });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }

    // Удаление временного файла
    const fs = require('fs');
    fs.unlinkSync(filePath);
  } catch (error) {
    console.error('Ошибка загрузки файла:', error);
    res.status(500).json({ message: error.message || 'Ошибка загрузки файла' });
  }
});

// Функция парсинга даты
function parseDate(dateValue) {
  if (!dateValue) return null;

  // Если дата в формате Excel (число)
  if (typeof dateValue === 'number') {
    const excelEpoch = new Date(1899, 11, 30);
    const date = new Date(excelEpoch.getTime() + dateValue * 86400000);
    return date.toISOString().split('T')[0];
  }

  // Если дата в формате строки
  if (typeof dateValue === 'string') {
    // Попытка парсинга различных форматов
    const formats = [
      /(\d{2})-(\d{2})-(\d{4})\s+\d{2}:\d{2}/, // DD-MM-YYYY HH:MM (Wildberries)
      /(\d{2})\.(\d{2})\.(\d{4})/, // DD.MM.YYYY
      /(\d{4})-(\d{2})-(\d{2})/, // YYYY-MM-DD
    ];

    for (const format of formats) {
      const match = dateValue.match(format);
      if (match) {
        if (format.source.startsWith('(\\d{2})-(\\d{2})-(\\d{4})')) {
          // DD-MM-YYYY HH:MM → YYYY-MM-DD
          return `${match[3]}-${match[2]}-${match[1]}`;
        } else if (format.source.startsWith('(\\d{2})')) {
          // DD.MM.YYYY → YYYY-MM-DD
          return `${match[3]}-${match[2]}-${match[1]}`;
        } else {
          // YYYY-MM-DD (уже в правильном формате)
          return match[0].split(' ')[0]; // убираем время если есть
        }
      }
    }
  }

  return null;
}

module.exports = router;

// Парсинг даты и времени из Excel WB
function parseDateTime(dateValue) {
  if (!dateValue) return { date: null, time: null };
  
  // Excel число
  if (typeof dateValue === "number") {
    const excelEpoch = new Date(1899, 11, 30);
    const dt = new Date(excelEpoch.getTime() + dateValue * 86400000);
    const h = String(dt.getHours()).padStart(2, "0");
    const m = String(dt.getMinutes()).padStart(2, "0");
    return { date: dt.toISOString().split("T")[0], time: h + ":" + m };
  }
  
  // Строка "19-01-2026 00:12"
  if (typeof dateValue === "string") {
    const match = dateValue.match(/(\d{2})[-.](\d{2})[-.](\d{4})\s+(\d{2}):(\d{2})/);
    if (match) {
      return { 
        date: match[3] + "-" + match[2] + "-" + match[1], 
        time: match[4] + ":" + match[5] 
      };
    }
    // Только дата
    const dateOnly = dateValue.match(/(\d{2})[-.](\d{2})[-.](\d{4})/);
    if (dateOnly) {
      return { date: dateOnly[3] + "-" + dateOnly[2] + "-" + dateOnly[1], time: null };
    }
  }
  return { date: null, time: null };
}
