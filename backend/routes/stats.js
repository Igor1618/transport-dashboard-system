const express = require('express');
const router = express.Router();
const pool = require('../config/database');

// GET /api/stats?month=YYYY-MM
router.get('/', async (req, res) => {
  try {
    const { month } = req.query;

    let currentMonthStart, currentMonthEnd, prevMonthStart, prevMonthEnd;

    if (month) {
      // Если указан месяц - используем его
      const [year, monthNum] = month.split('-').map(Number);
      currentMonthStart = new Date(year, monthNum - 1, 1);
      currentMonthEnd = new Date(year, monthNum, 0, 23, 59, 59);

      // Предыдущий месяц
      prevMonthStart = new Date(year, monthNum - 2, 1);
      prevMonthEnd = new Date(year, monthNum - 1, 0, 23, 59, 59);
    } else {
      // Если месяц не указан - текущий месяц
      const now = new Date();
      currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      currentMonthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

      // Предыдущий месяц
      prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      prevMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
    }

    // Статистика за текущий выбранный месяц
    const currentStatsQuery = `
      SELECT
        COUNT(*) as total_trips,
        COALESCE(SUM(trip_amount), 0) as total_revenue,
        COALESCE(SUM(trip_amount * 1.2), 0) as total_revenue_with_vat,
        COALESCE(SUM(penalty_amount), 0) as total_penalties,
        COUNT(DISTINCT driver_name) as total_drivers,
        COUNT(DISTINCT vehicle_number) as total_vehicles,
        COALESCE(SUM(distance_km), 0) as total_distance
      FROM trips
      WHERE loading_date >= $1 AND loading_date <= $2
    `;

    // Статистика за предыдущий месяц
    const prevStatsQuery = `
      SELECT
        COUNT(*) as total_trips,
        COALESCE(SUM(trip_amount), 0) as total_revenue,
        COALESCE(SUM(trip_amount * 1.2), 0) as total_revenue_with_vat,
        COALESCE(SUM(penalty_amount), 0) as total_penalties,
        COUNT(DISTINCT driver_name) as total_drivers,
        COUNT(DISTINCT vehicle_number) as total_vehicles,
        COALESCE(SUM(distance_km), 0) as total_distance
      FROM trips
      WHERE loading_date >= $1 AND loading_date <= $2
    `;

    const currentResult = await pool.query(currentStatsQuery, [currentMonthStart, currentMonthEnd]);
    const prevResult = await pool.query(prevStatsQuery, [prevMonthStart, prevMonthEnd]);

    const currentStats = currentResult.rows[0];
    const prevStats = prevResult.rows[0];

    // Функция для расчета процента изменения
    const calculateChange = (current, previous) => {
      if (previous === 0) return current > 0 ? 100 : 0;
      return ((current - previous) / previous) * 100;
    };

    const currentRevenue = parseFloat(currentStats.total_revenue) || 0;
    const currentPenalties = parseFloat(currentStats.total_penalties) || 0;
    const currentDistance = parseFloat(currentStats.total_distance) || 0;
    const currentSalary = (currentRevenue * 0.3) - currentPenalties;
    const currentRevenuePerKm = currentDistance > 0 ? currentRevenue / currentDistance : 0;

    const prevRevenue = parseFloat(prevStats.total_revenue) || 0;
    const prevPenalties = parseFloat(prevStats.total_penalties) || 0;
    const prevDistance = parseFloat(prevStats.total_distance) || 0;
    const prevSalary = (prevRevenue * 0.3) - prevPenalties;
    const prevRevenuePerKm = prevDistance > 0 ? prevRevenue / prevDistance : 0;

    const current = {
      totalTrips: parseInt(currentStats.total_trips) || 0,
      totalRevenue: currentRevenue,
      totalRevenueWithVat: parseFloat(currentStats.total_revenue_with_vat) || 0,
      totalDrivers: parseInt(currentStats.total_drivers) || 0,
      totalVehicles: parseInt(currentStats.total_vehicles) || 0,
      totalPenalties: currentPenalties,
      totalSalary: currentSalary,
      totalDistance: currentDistance,
      revenuePerKm: currentRevenuePerKm,
    };

    const previous = {
      totalTrips: parseInt(prevStats.total_trips) || 0,
      totalRevenue: prevRevenue,
      totalRevenueWithVat: parseFloat(prevStats.total_revenue_with_vat) || 0,
      totalDrivers: parseInt(prevStats.total_drivers) || 0,
      totalVehicles: parseInt(prevStats.total_vehicles) || 0,
      totalPenalties: prevPenalties,
      totalSalary: prevSalary,
      totalDistance: prevDistance,
      revenuePerKm: prevRevenuePerKm,
    };

    const changes = {
      totalTrips: calculateChange(current.totalTrips, previous.totalTrips),
      totalRevenue: calculateChange(current.totalRevenue, previous.totalRevenue),
      totalRevenueWithVat: calculateChange(current.totalRevenueWithVat, previous.totalRevenueWithVat),
      totalDrivers: calculateChange(current.totalDrivers, previous.totalDrivers),
      totalVehicles: calculateChange(current.totalVehicles, previous.totalVehicles),
      totalPenalties: calculateChange(current.totalPenalties, previous.totalPenalties),
      totalSalary: calculateChange(current.totalSalary, previous.totalSalary),
      revenuePerKm: calculateChange(current.revenuePerKm, previous.revenuePerKm),
    };

    res.json({
      ...current,
      changes,
      tripsThisMonth: current.totalTrips, // Для обратной совместимости
    });
  } catch (error) {
    console.error('Ошибка получения статистики:', error);
    res.status(500).json({ message: 'Ошибка сервера' });
  }
});

// GET /api/stats/monthly?months=6
// Получение помесячной статистики за последние N месяцев для графиков
router.get('/monthly', async (req, res) => {
  try {
    const months = parseInt(req.query.months) || 6; // По умолчанию 6 месяцев
    const monthsData = [];

    // Получаем данные за последние N месяцев
    for (let i = months - 1; i >= 0; i--) {
      const date = new Date();
      date.setMonth(date.getMonth() - i);

      const monthStart = new Date(date.getFullYear(), date.getMonth(), 1);
      const monthEnd = new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59);

      const statsQuery = `
        SELECT
          COUNT(*) as total_trips,
          COALESCE(SUM(trip_amount), 0) as total_revenue,
          COALESCE(SUM(trip_amount * 1.2), 0) as total_revenue_with_vat,
          COALESCE(SUM(penalty_amount), 0) as total_penalties,
          COUNT(DISTINCT driver_name) as total_drivers,
          COUNT(DISTINCT vehicle_number) as total_vehicles,
          COALESCE(SUM(distance_km), 0) as total_distance
        FROM trips
        WHERE loading_date >= $1 AND loading_date <= $2
      `;

      const result = await pool.query(statsQuery, [monthStart, monthEnd]);
      const stats = result.rows[0];

      // Рассчитываем общую зарплату за месяц
      // Зарплата = 30% от выручки - штрафы
      const totalRevenue = parseFloat(stats.total_revenue) || 0;
      const totalPenalties = parseFloat(stats.total_penalties) || 0;
      const totalSalary = (totalRevenue * 0.3) - totalPenalties;

      // Рассчитываем рубль/км
      const totalDistance = parseFloat(stats.total_distance) || 0;
      const revenuePerKm = totalDistance > 0 ? totalRevenue / totalDistance : 0;

      monthsData.push({
        month: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`,
        monthName: date.toLocaleDateString('ru-RU', { month: 'short', year: 'numeric' }),
        totalTrips: parseInt(stats.total_trips) || 0,
        totalRevenue: totalRevenue,
        totalRevenueWithVat: parseFloat(stats.total_revenue_with_vat) || 0,
        totalDrivers: parseInt(stats.total_drivers) || 0,
        totalVehicles: parseInt(stats.total_vehicles) || 0,
        totalPenalties: totalPenalties,
        totalSalary: totalSalary,
        totalDistance: totalDistance,
        revenuePerKm: revenuePerKm,
      });
    }

    res.json(monthsData);
  } catch (error) {
    console.error('Ошибка получения помесячной статистики:', error);
    res.status(500).json({ message: 'Ошибка сервера' });
  }
});

module.exports = router;
