const express = require('express');
const router = express.Router();
const pool = require('../config/database');

// GET /api/stats
router.get('/', async (req, res) => {
  try {
    // Общая статистика
    const statsQuery = `
      SELECT
        COUNT(*) as total_trips,
        COALESCE(SUM(trip_amount), 0) as total_revenue,
        COALESCE(SUM(trip_amount * 1.2), 0) as total_revenue_with_vat,
        COALESCE(SUM(penalty_amount), 0) as total_penalties,
        COUNT(DISTINCT driver_name) as total_drivers,
        COUNT(DISTINCT vehicle_number) as total_vehicles,
        COUNT(CASE WHEN DATE_TRUNC('month', loading_date) = DATE_TRUNC('month', CURRENT_DATE) THEN 1 END) as trips_this_month
      FROM trips
    `;

    const result = await pool.query(statsQuery);
    const stats = result.rows[0];

    res.json({
      totalTrips: parseInt(stats.total_trips) || 0,
      totalRevenue: parseFloat(stats.total_revenue) || 0,
      totalRevenueWithVat: parseFloat(stats.total_revenue_with_vat) || 0,
      totalDrivers: parseInt(stats.total_drivers) || 0,
      totalVehicles: parseInt(stats.total_vehicles) || 0,
      totalPenalties: parseFloat(stats.total_penalties) || 0,
      tripsThisMonth: parseInt(stats.trips_this_month) || 0,
    });
  } catch (error) {
    console.error('Ошибка получения статистики:', error);
    res.status(500).json({ message: 'Ошибка сервера' });
  }
});

module.exports = router;
