const express = require("express");
const router = express.Router();
const pool = require("../config/database");

// GET /api/drivers - список всех водителей
router.get("/", async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, full_name, phone, phone2, license_number, license_expiry, notes 
       FROM drivers ORDER BY full_name`
    );
    res.json(result.rows);
  } catch (error) {
    console.error("Ошибка получения водителей:", error);
    res.status(500).json({ message: "Ошибка сервера" });
  }
});

// GET /api/drivers/:id - водитель по ID
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      `SELECT * FROM drivers WHERE id = $1`,
      [id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Водитель не найден" });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error("Ошибка получения водителя:", error);
    res.status(500).json({ message: "Ошибка сервера" });
  }
});

// PATCH /api/drivers/:id - обновить данные водителя
router.patch("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { phone, phone2, license_number, license_expiry, passport_series, passport_number, notes } = req.body;
    
    const result = await pool.query(
      `UPDATE drivers SET 
        phone = COALESCE($1, phone),
        phone2 = COALESCE($2, phone2),
        license_number = COALESCE($3, license_number),
        license_expiry = COALESCE($4, license_expiry),
        passport_series = COALESCE($5, passport_series),
        passport_number = COALESCE($6, passport_number),
        notes = COALESCE($7, notes)
       WHERE id = $8
       RETURNING *`,
      [phone, phone2, license_number, license_expiry, passport_series, passport_number, notes, id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Водитель не найден" });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error("Ошибка обновления водителя:", error);
    res.status(500).json({ message: "Ошибка сервера" });
  }
});

// GET /api/drivers/search/:query - поиск водителя
router.get("/search/:query", async (req, res) => {
  try {
    const { query } = req.params;
    const searchTerm = "%" + query + "%";
    
    const result = await pool.query(
      `SELECT * FROM drivers 
       WHERE LOWER(full_name) LIKE LOWER($1) OR phone LIKE $1
       LIMIT 10`,
      [searchTerm]
    );
    res.json(result.rows);
  } catch (error) {
    console.error("Ошибка поиска водителя:", error);
    res.status(500).json({ message: "Ошибка сервера" });
  }
});

module.exports = router;
