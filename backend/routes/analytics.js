const express = require('express');
const router = express.Router();
const pool = require('../config/database');

// GET /api/analytics/driver-expenses - расходы по водителям
router.get('/driver-expenses', async (req, res) => {
  try {
    const { limit = 50, offset = 0, search } = req.query;

    let query = `
      SELECT
        driver_id,
        driver_name,
        total_reports,
        first_report_date,
        last_report_date,
        total_fuel_liters,
        total_fuel_cost,
        avg_fuel_price_per_liter,
        total_mileage_km,
        avg_mileage_per_report,
        avg_fuel_consumption_per_100km,
        total_expenses,
        total_accruals,
        total_payments,
        balance,
        vehicles_used
      FROM v_driver_expenses
      WHERE 1=1
    `;

    const params = [];

    if (search) {
      params.push(`%${search}%`);
      query += ` AND driver_name ILIKE $${params.length}`;
    }

    query += `
      ORDER BY total_expenses DESC
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `;

    params.push(limit, offset);

    const result = await pool.query(query, params);

    // Получить общее количество
    const countQuery = search
      ? `SELECT COUNT(*) FROM v_driver_expenses WHERE driver_name ILIKE $1`
      : `SELECT COUNT(*) FROM v_driver_expenses`;
    const countParams = search ? [`%${search}%`] : [];
    const countResult = await pool.query(countQuery, countParams);

    res.json({
      data: result.rows,
      total: parseInt(countResult.rows[0].count),
      limit: parseInt(limit),
      offset: parseInt(offset)
    });
  } catch (error) {
    console.error('Ошибка получения аналитики расходов водителей:', error);
    res.status(500).json({ message: 'Ошибка сервера', error: error.message });
  }
});

// GET /api/analytics/vehicle-fuel - аналитика топлива по машинам
router.get('/vehicle-fuel', async (req, res) => {
  try {
    const { limit = 50, offset = 0, search } = req.query;

    let query = `
      SELECT
        vehicle_id,
        license_plate,
        model,
        total_reports,
        first_report_date,
        last_report_date,
        total_fuel_liters,
        total_fuel_cost,
        avg_fuel_price_per_liter,
        total_mileage_km,
        avg_mileage_per_report,
        avg_fuel_consumption_per_100km,
        fuel_cost_per_km,
        drivers_count,
        drivers_list
      FROM v_vehicle_fuel_analytics
      WHERE 1=1
    `;

    const params = [];

    if (search) {
      params.push(`%${search}%`);
      query += ` AND (license_plate ILIKE $${params.length} OR model ILIKE $${params.length})`;
    }

    query += `
      ORDER BY total_fuel_cost DESC NULLS LAST
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `;

    params.push(limit, offset);

    const result = await pool.query(query, params);

    // Получить общее количество
    const countQuery = search
      ? `SELECT COUNT(*) FROM v_vehicle_fuel_analytics WHERE license_plate ILIKE $1 OR model ILIKE $1`
      : `SELECT COUNT(*) FROM v_vehicle_fuel_analytics`;
    const countParams = search ? [`%${search}%`] : [];
    const countResult = await pool.query(countQuery, countParams);

    res.json({
      data: result.rows,
      total: parseInt(countResult.rows[0].count),
      limit: parseInt(limit),
      offset: parseInt(offset)
    });
  } catch (error) {
    console.error('Ошибка получения аналитики топлива по машинам:', error);
    res.status(500).json({ message: 'Ошибка сервера', error: error.message });
  }
});

// GET /api/analytics/route-analytics - аналитика по маршрутам
router.get('/route-analytics', async (req, res) => {
  try {
    const { limit = 50, offset = 0, search } = req.query;

    let query = `
      SELECT
        route,
        total_contracts,
        vehicles_count,
        drivers_count,
        contractors_count,
        total_amount,
        avg_amount,
        min_amount,
        max_amount,
        first_contract_date,
        last_contract_date,
        contractors_list,
        top_driver,
        top_vehicle
      FROM v_route_analytics
      WHERE 1=1
    `;

    const params = [];

    if (search) {
      params.push(`%${search}%`);
      query += ` AND route ILIKE $${params.length}`;
    }

    query += `
      ORDER BY total_amount DESC
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `;

    params.push(limit, offset);

    const result = await pool.query(query, params);

    // Получить общее количество
    const countQuery = search
      ? `SELECT COUNT(*) FROM v_route_analytics WHERE route ILIKE $1`
      : `SELECT COUNT(*) FROM v_route_analytics`;
    const countParams = search ? [`%${search}%`] : [];
    const countResult = await pool.query(countQuery, countParams);

    res.json({
      data: result.rows,
      total: parseInt(countResult.rows[0].count),
      limit: parseInt(limit),
      offset: parseInt(offset)
    });
  } catch (error) {
    console.error('Ошибка получения аналитики по маршрутам:', error);
    res.status(500).json({ message: 'Ошибка сервера', error: error.message });
  }
});

// GET /api/analytics/expense-categories - сводка по категориям расходов
router.get('/expense-categories', async (req, res) => {
  try {
    const { limit = 50, offset = 0 } = req.query;

    const query = `
      SELECT
        category,
        occurrences,
        reports_count,
        total_amount,
        avg_amount,
        min_amount,
        max_amount,
        percentage_of_total
      FROM v_expense_categories_summary
      ORDER BY total_amount DESC
      LIMIT $1 OFFSET $2
    `;

    const result = await pool.query(query, [limit, offset]);

    // Получить общее количество
    const countQuery = `SELECT COUNT(*) FROM v_expense_categories_summary`;
    const countResult = await pool.query(countQuery);

    res.json({
      data: result.rows,
      total: parseInt(countResult.rows[0].count),
      limit: parseInt(limit),
      offset: parseInt(offset)
    });
  } catch (error) {
    console.error('Ошибка получения аналитики категорий расходов:', error);
    res.status(500).json({ message: 'Ошибка сервера', error: error.message });
  }
});

// GET /api/analytics/driver-performance - производительность водителей
router.get('/driver-performance', async (req, res) => {
  try {
    const { limit = 50, offset = 0, search, sortBy = 'total_contracts_amount' } = req.query;

    const allowedSortFields = [
      'total_contracts_amount',
      'revenue_per_km',
      'fuel_consumption_per_100km',
      'total_mileage',
      'balance'
    ];

    const sortField = allowedSortFields.includes(sortBy) ? sortBy : 'total_contracts_amount';

    let query = `
      SELECT
        driver_id,
        driver_name,
        reports_count,
        contracts_count,
        total_contracts_amount,
        avg_contract_amount,
        total_mileage,
        total_fuel,
        total_fuel_cost,
        revenue_per_km,
        fuel_consumption_per_100km,
        total_expenses,
        total_accruals,
        total_payments,
        balance,
        first_activity_date,
        last_activity_date,
        vehicles_used
      FROM v_driver_performance
      WHERE 1=1
    `;

    const params = [];

    if (search) {
      params.push(`%${search}%`);
      query += ` AND driver_name ILIKE $${params.length}`;
    }

    query += `
      ORDER BY ${sortField} DESC NULLS LAST
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `;

    params.push(limit, offset);

    const result = await pool.query(query, params);

    // Получить общее количество
    const countQuery = search
      ? `SELECT COUNT(*) FROM v_driver_performance WHERE driver_name ILIKE $1`
      : `SELECT COUNT(*) FROM v_driver_performance`;
    const countParams = search ? [`%${search}%`] : [];
    const countResult = await pool.query(countQuery, countParams);

    res.json({
      data: result.rows,
      total: parseInt(countResult.rows[0].count),
      limit: parseInt(limit),
      offset: parseInt(offset)
    });
  } catch (error) {
    console.error('Ошибка получения аналитики производительности водителей:', error);
    res.status(500).json({ message: 'Ошибка сервера', error: error.message });
  }
});

// GET /api/analytics/vehicle-utilization - использование транспорта
router.get('/vehicle-utilization', async (req, res) => {
  try {
    const { limit = 50, offset = 0, search, sortBy = 'total_contracts_amount' } = req.query;

    const allowedSortFields = [
      'total_contracts_amount',
      'revenue_per_km',
      'fuel_consumption_per_100km',
      'profit_margin_percent',
      'total_mileage',
      'active_days'
    ];

    const sortField = allowedSortFields.includes(sortBy) ? sortBy : 'total_contracts_amount';

    let query = `
      SELECT
        vehicle_id,
        license_plate,
        model,
        reports_count,
        contracts_count,
        total_contracts_amount,
        total_mileage,
        avg_mileage_per_report,
        total_fuel_liters,
        total_fuel_cost,
        fuel_consumption_per_100km,
        total_expenses,
        revenue_per_km,
        profit_margin_percent,
        drivers_count,
        first_activity_date,
        last_activity_date,
        active_days
      FROM v_vehicle_utilization
      WHERE 1=1
    `;

    const params = [];

    if (search) {
      params.push(`%${search}%`);
      query += ` AND (license_plate ILIKE $${params.length} OR model ILIKE $${params.length})`;
    }

    query += `
      ORDER BY ${sortField} DESC NULLS LAST
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `;

    params.push(limit, offset);

    const result = await pool.query(query, params);

    // Получить общее количество
    const countQuery = search
      ? `SELECT COUNT(*) FROM v_vehicle_utilization WHERE license_plate ILIKE $1 OR model ILIKE $1`
      : `SELECT COUNT(*) FROM v_vehicle_utilization`;
    const countParams = search ? [`%${search}%`] : [];
    const countResult = await pool.query(countQuery, countParams);

    res.json({
      data: result.rows,
      total: parseInt(countResult.rows[0].count),
      limit: parseInt(limit),
      offset: parseInt(offset)
    });
  } catch (error) {
    console.error('Ошибка получения аналитики использования транспорта:', error);
    res.status(500).json({ message: 'Ошибка сервера', error: error.message });
  }
});

// GET /api/analytics/monthly-statistics - ежемесячная статистика
router.get('/monthly-statistics', async (req, res) => {
  try {
    const { limit = 12, offset = 0 } = req.query;

    const query = `
      SELECT
        month,
        contracts_count,
        contracts_total_amount,
        contracts_avg_amount,
        reports_count,
        total_mileage,
        total_fuel_liters,
        total_fuel_cost,
        total_expenses,
        total_accruals,
        total_payments,
        active_drivers,
        active_vehicles
      FROM v_monthly_statistics
      ORDER BY period DESC
      LIMIT $1 OFFSET $2
    `;

    const result = await pool.query(query, [limit, offset]);

    // Получить общее количество
    const countQuery = `SELECT COUNT(*) FROM v_monthly_statistics`;
    const countResult = await pool.query(countQuery);

    res.json({
      data: result.rows,
      total: parseInt(countResult.rows[0].count),
      limit: parseInt(limit),
      offset: parseInt(offset)
    });
  } catch (error) {
    console.error('Ошибка получения ежемесячной статистики:', error);
    res.status(500).json({ message: 'Ошибка сервера', error: error.message });
  }
});

// GET /api/analytics/top-performers - топ-10 показателей
router.get('/top-performers', async (req, res) => {
  try {
    const { type } = req.query; // driver, vehicle, route

    let query = `
      SELECT
        entity_type,
        entity_name,
        metric_value,
        metric_type
      FROM v_top_performers
    `;

    const params = [];

    if (type) {
      params.push(type);
      query += ` WHERE entity_type = $${params.length}`;
    }

    query += ` ORDER BY metric_value DESC`;

    const result = await pool.query(query, params);

    res.json(result.rows);
  } catch (error) {
    console.error('Ошибка получения топ показателей:', error);
    res.status(500).json({ message: 'Ошибка сервера', error: error.message });
  }
});

// GET /api/analytics/dashboard - данные для главного дашборда
router.get('/dashboard', async (req, res) => {
  try {
    // Получаем агрегированные данные из нескольких views
    const [
      driversStats,
      vehiclesStats,
      contractsStats,
      reportsStats,
      topPerformers,
      monthlyStats
    ] = await Promise.all([
      // Статистика водителей
      pool.query(`
        SELECT
          COUNT(*) AS total_drivers,
          SUM(total_expenses) AS total_expenses,
          SUM(total_accruals) AS total_accruals,
          SUM(total_payments) AS total_payments
        FROM v_driver_expenses
      `),
      // Статистика машин
      pool.query(`
        SELECT
          COUNT(*) AS total_vehicles,
          SUM(total_fuel_cost) AS total_fuel_cost,
          SUM(total_mileage_km) AS total_mileage,
          AVG(avg_fuel_consumption_per_100km) AS avg_fuel_consumption
        FROM v_vehicle_fuel_analytics
        WHERE total_mileage_km > 0
      `),
      // Статистика договоров
      pool.query(`
        SELECT
          COUNT(*) AS total_contracts,
          SUM(total_amount) AS total_amount,
          COUNT(DISTINCT route) AS unique_routes
        FROM v_route_analytics
      `),
      // Статистика отчетов (последние 30 дней)
      pool.query(`
        SELECT
          COUNT(*) AS reports_last_30_days,
          SUM(total_expenses) AS expenses_last_30_days,
          SUM(total_fuel) AS fuel_last_30_days
        FROM v_driver_expenses
        WHERE last_report_date >= NOW() - INTERVAL '30 days'
      `),
      // Топ-5 водителей
      pool.query(`
        SELECT entity_name, metric_value
        FROM v_top_performers
        WHERE entity_type = 'driver'
        LIMIT 5
      `),
      // Последние 6 месяцев
      pool.query(`
        SELECT *
        FROM v_monthly_statistics
        ORDER BY period DESC
        LIMIT 6
      `)
    ]);

    res.json({
      drivers: driversStats.rows[0],
      vehicles: vehiclesStats.rows[0],
      contracts: contractsStats.rows[0],
      reports: reportsStats.rows[0],
      topDrivers: topPerformers.rows,
      monthlyTrend: monthlyStats.rows.reverse()
    });
  } catch (error) {
    console.error('Ошибка получения данных дашборда:', error);
    res.status(500).json({ message: 'Ошибка сервера', error: error.message });
  }
});

module.exports = router;
