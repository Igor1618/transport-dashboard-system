const express = require('express');
const router = express.Router();
const pool = require('../config/database');

// GET /api/salary
router.get('/', async (req, res) => {
  try {
    const { month } = req.query;

    let query = `
      SELECT
        t.driver_name,
        COUNT(t.id) as trips_count,
        COALESCE(SUM(t.distance_km), 0) as total_distance,
        COALESCE(SUM(t.trip_amount), 0) as total_revenue,
        COALESCE(SUM(t.penalty_amount), 0) as total_penalties,
        COALESCE(SUM(COALESCE(rr.rate_per_trip, 0)), 0) as gross_salary,
        COALESCE(SUM(COALESCE(rr.rate_per_trip, 0)) - SUM(t.penalty_amount), 0) as net_salary
      FROM trips t
      LEFT JOIN route_rates rr ON t.route_name = rr.route_name AND rr.is_active = true
    `;

    const params = [];

    // Фильтр по месяцу
    if (month) {
      query += ` WHERE DATE_TRUNC('month', t.loading_date) = DATE_TRUNC('month', $1::date)`;
      params.push(`${month}-01`);
    }

    query += `
      GROUP BY t.driver_name
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
