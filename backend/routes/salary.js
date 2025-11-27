const express = require('express');
const router = express.Router();
const pool = require('../config/database');

// GET /api/salary
router.get('/', async (req, res) => {
  try {
    const { month } = req.query;

    let query = `
      SELECT
        driver_name,
        COUNT(*) as trips_count,
        COALESCE(SUM(distance_km), 0) as total_distance,
        COALESCE(SUM(trip_amount), 0) as total_revenue,
        COALESCE(SUM(penalty_amount), 0) as total_penalties,
        COALESCE(SUM(trip_amount) - SUM(penalty_amount), 0) as net_salary
      FROM trips
    `;

    const params = [];

    // Фильтр по месяцу
    if (month) {
      query += ` WHERE DATE_TRUNC('month', loading_date) = DATE_TRUNC('month', $1::date)`;
      params.push(`${month}-01`);
    }

    query += `
      GROUP BY driver_name
      ORDER BY net_salary DESC
    `;

    const result = await pool.query(query, params);

    res.json(result.rows);
  } catch (error) {
    console.error('Ошибка расчета зарплат:', error);
    res.status(500).json({ message: 'Ошибка сервера' });
  }
});

module.exports = router;
