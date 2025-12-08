const express = require('express');
const router = express.Router();
const pool = require('../config/database');

// GET /api/vehicles/canonical
// Получение списка канонических (правильных) номеров машин
router.get('/canonical', async (req, res) => {
  try {
    // Получаем список номеров машин с количеством рейсов
    // Берем самый частый вариант написания каждого номера
    const query = `
      SELECT
        vehicle_number,
        COUNT(*) as trips_count
      FROM trips
      GROUP BY vehicle_number
      ORDER BY trips_count DESC
    `;

    const result = await pool.query(query);
    const canonicalNumbers = result.rows.map(row => row.vehicle_number);

    res.json(canonicalNumbers);
  } catch (error) {
    console.error('Ошибка получения канонических номеров:', error);
    res.status(500).json({ message: 'Ошибка сервера' });
  }
});

// GET /api/vehicles/stats - статистика по автомобилям
router.get('/stats', async (req, res) => {
  try {
    const { month } = req.query;

    let query = `
      SELECT
        t.vehicle_number,
        COUNT(t.id)::integer as trips_count,
        COALESCE(SUM(t.distance_km), 0)::numeric as total_distance,
        COALESCE(SUM(t.trip_amount), 0)::numeric as total_revenue,
        COALESCE(SUM(t.trip_amount * 1.2), 0)::numeric as total_revenue_with_vat,
        COUNT(DISTINCT t.driver_name)::integer as drivers_count,
        COUNT(DISTINCT DATE_TRUNC('day', t.loading_date))::integer as working_days,
        COALESCE(ROUND(SUM(t.trip_amount)::numeric / NULLIF(SUM(t.distance_km), 0), 2), 0)::numeric as revenue_per_km,
        COALESCE(ROUND(SUM(t.trip_amount * 1.2)::numeric / NULLIF(SUM(t.distance_km), 0), 2), 0)::numeric as revenue_per_km_with_vat,
        COALESCE(ROUND(COUNT(t.id)::numeric / NULLIF(COUNT(DISTINCT DATE_TRUNC('day', t.loading_date)), 0), 2), 0)::numeric as trips_per_day
      FROM trips t
    `;

    const params = [];

    // Фильтр по месяцу
    if (month) {
      query += ` WHERE DATE_TRUNC('month', t.loading_date) = DATE_TRUNC('month', $1::date)`;
      params.push(`${month}-01`);
    }

    query += `
      GROUP BY t.vehicle_number
      ORDER BY total_revenue DESC
    `;

    const result = await pool.query(query, params);

    res.json(result.rows);
  } catch (error) {
    console.error('Ошибка получения статистики по автомобилям:', error);
    res.status(500).json({ message: 'Ошибка сервера' });
  }
});

// GET /api/vehicles/:vehicleNumber/trips - детализация рейсов автомобиля
router.get('/:vehicleNumber/trips', async (req, res) => {
  try {
    const { vehicleNumber } = req.params;
    const { month } = req.query;

    let query = `
      SELECT
        t.id,
        t.wb_trip_number,
        t.loading_date,
        t.driver_name,
        t.route_name,
        t.distance_km,
        t.trip_amount as revenue,
        (t.trip_amount * 1.2) as revenue_with_vat,
        t.penalty_amount
      FROM trips t
      WHERE t.vehicle_number = $1
    `;

    const params = [vehicleNumber];

    // Фильтр по месяцу
    if (month) {
      query += ` AND DATE_TRUNC('month', t.loading_date) = DATE_TRUNC('month', $2::date)`;
      params.push(`${month}-01`);
    }

    query += ` ORDER BY t.loading_date DESC`;

    const result = await pool.query(query, params);

    res.json(result.rows);
  } catch (error) {
    console.error('Ошибка загрузки рейсов автомобиля:', error);
    res.status(500).json({ message: 'Ошибка сервера' });
  }
});

module.exports = router;
