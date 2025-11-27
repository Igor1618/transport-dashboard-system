const express = require('express');
const router = express.Router();
const pool = require('../config/database');

// GET /api/import-history
router.get('/', async (req, res) => {
  try {
    const query = `
      SELECT
        id,
        filename,
        imported_at,
        rows_imported,
        rows_skipped,
        status,
        error_message
      FROM import_log
      ORDER BY imported_at DESC
      LIMIT 100
    `;

    const result = await pool.query(query);

    res.json(result.rows);
  } catch (error) {
    console.error('Ошибка получения истории импорта:', error);
    res.status(500).json({ message: 'Ошибка сервера' });
  }
});

module.exports = router;
