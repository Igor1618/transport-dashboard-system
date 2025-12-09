const express = require('express');
const router = express.Router();
const pool = require('../config/database');

// GET /api/driver-reports - получить все отчеты водителей
router.get('/', async (req, res) => {
  try {
    const {
      search,
      dateFrom,
      dateTo,
      vehicleId,
      driverId,
      limit = 50,
      offset = 0
    } = req.query;

    let query = `
      SELECT
        dr.id,
        dr.number,
        dr.date_from,
        dr.date_to,
        dr.driver_id,
        dr.driver_name,
        dr.vehicle_id,
        dr.vehicle_number,
        dr.fuel_start,
        dr.fuel_end,
        dr.fuel_quantity,
        dr.fuel_amount,
        dr.mileage,
        dr.total_expenses,
        dr.driver_accruals,
        dr.driver_payments,
        (dr.driver_accruals - dr.driver_payments) AS balance,
        dr.synced_at,
        dr.created_at
      FROM driver_reports dr
      WHERE 1=1
    `;

    const params = [];

    // Поиск по номеру отчета
    if (search) {
      params.push(`%${search}%`);
      query += ` AND (dr.number ILIKE $${params.length} OR dr.driver_name ILIKE $${params.length})`;
    }

    // Фильтр по датам
    if (dateFrom) {
      params.push(dateFrom);
      query += ` AND dr.date_from >= $${params.length}`;
    }

    if (dateTo) {
      params.push(dateTo);
      query += ` AND dr.date_to <= $${params.length}`;
    }

    // Фильтр по машине
    if (vehicleId) {
      params.push(vehicleId);
      query += ` AND dr.vehicle_id = $${params.length}`;
    }

    // Фильтр по водителю
    if (driverId) {
      params.push(driverId);
      query += ` AND dr.driver_id = $${params.length}`;
    }

    query += `
      ORDER BY dr.date_from DESC, dr.created_at DESC
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `;

    params.push(limit, offset);

    const result = await pool.query(query, params);

    // Общее количество с фильтрами
    let countQuery = `SELECT COUNT(*) FROM driver_reports dr WHERE 1=1`;
    const countParams = [];
    let paramIndex = 1;

    if (search) {
      countParams.push(`%${search}%`);
      countQuery += ` AND (dr.number ILIKE $${paramIndex} OR dr.driver_name ILIKE $${paramIndex})`;
      paramIndex++;
    }
    if (dateFrom) {
      countParams.push(dateFrom);
      countQuery += ` AND dr.date_from >= $${paramIndex++}`;
    }
    if (dateTo) {
      countParams.push(dateTo);
      countQuery += ` AND dr.date_to <= $${paramIndex++}`;
    }
    if (vehicleId) {
      countParams.push(vehicleId);
      countQuery += ` AND dr.vehicle_id = $${paramIndex++}`;
    }
    if (driverId) {
      countParams.push(driverId);
      countQuery += ` AND dr.driver_id = $${paramIndex++}`;
    }

    const countResult = await pool.query(countQuery, countParams);

    res.json({
      reports: result.rows,
      total: parseInt(countResult.rows[0].count),
      limit: parseInt(limit),
      offset: parseInt(offset)
    });
  } catch (error) {
    console.error('Ошибка получения отчетов водителей:', error);
    res.status(500).json({ message: 'Ошибка сервера', error: error.message });
  }
});

// GET /api/driver-reports/:id - получить отчет по ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const query = `
      SELECT
        dr.id,
        dr.number,
        dr.date_from,
        dr.date_to,
        dr.driver_id,
        dr.driver_name,
        dr.vehicle_id,
        dr.vehicle_number,
        dr.fuel_start,
        dr.fuel_end,
        dr.fuel_quantity,
        dr.fuel_amount,
        dr.mileage,
        dr.total_expenses,
        dr.driver_accruals,
        dr.driver_payments,
        (dr.driver_accruals - dr.driver_payments) AS balance,
        dr.synced_at,
        dr.created_at,
        dr.updated_at
      FROM driver_reports dr
      WHERE dr.id = $1
    `;

    const result = await pool.query(query, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Отчет не найден' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Ошибка получения отчета:', error);
    res.status(500).json({ message: 'Ошибка сервера', error: error.message });
  }
});

// GET /api/driver-reports/:id/expenses - категории расходов отчета
router.get('/:id/expenses', async (req, res) => {
  try {
    const { id } = req.params;

    const query = `
      SELECT
        ec.uuid,
        ec.category,
        ec.amount,
        ec.created_at
      FROM expense_categories ec
      WHERE ec.driver_report_id = $1
      ORDER BY ec.amount DESC
    `;

    const result = await pool.query(query, [id]);

    res.json(result.rows);
  } catch (error) {
    console.error('Ошибка получения категорий расходов:', error);
    res.status(500).json({ message: 'Ошибка сервера', error: error.message });
  }
});

// GET /api/driver-reports/stats/summary - общая статистика по отчетам
router.get('/stats/summary', async (req, res) => {
  try {
    const { dateFrom, dateTo } = req.query;

    let query = `
      SELECT
        COUNT(*) AS total_reports,
        COUNT(DISTINCT driver_id) AS unique_drivers,
        COUNT(DISTINCT vehicle_id) AS unique_vehicles,
        COALESCE(SUM(mileage), 0) AS total_mileage,
        COALESCE(SUM(fuel_quantity), 0) AS total_fuel_liters,
        COALESCE(SUM(fuel_amount), 0) AS total_fuel_cost,
        COALESCE(SUM(total_expenses), 0) AS total_expenses,
        COALESCE(SUM(driver_accruals), 0) AS total_accruals,
        COALESCE(SUM(driver_payments), 0) AS total_payments,
        COALESCE(SUM(driver_accruals) - SUM(driver_payments), 0) AS total_balance,
        ROUND(
          COALESCE(SUM(fuel_quantity) / NULLIF(SUM(mileage), 0) * 100, 0),
          2
        ) AS avg_fuel_consumption_per_100km,
        ROUND(
          COALESCE(AVG(fuel_amount / NULLIF(fuel_quantity, 0)), 0),
          2
        ) AS avg_fuel_price_per_liter
      FROM driver_reports
      WHERE 1=1
    `;

    const params = [];

    if (dateFrom) {
      params.push(dateFrom);
      query += ` AND date_from >= $${params.length}`;
    }

    if (dateTo) {
      params.push(dateTo);
      query += ` AND date_to <= $${params.length}`;
    }

    const result = await pool.query(query, params);

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Ошибка получения статистики отчетов:', error);
    res.status(500).json({ message: 'Ошибка сервера', error: error.message });
  }
});

// GET /api/driver-reports/stats/by-month - статистика по месяцам
router.get('/stats/by-month', async (req, res) => {
  try {
    const { dateFrom, dateTo, limit = 12 } = req.query;

    let query = `
      SELECT
        TO_CHAR(date_from, 'YYYY-MM') AS month,
        COUNT(*) AS reports_count,
        COUNT(DISTINCT driver_id) AS unique_drivers,
        COUNT(DISTINCT vehicle_id) AS unique_vehicles,
        COALESCE(SUM(mileage), 0) AS total_mileage,
        COALESCE(SUM(fuel_quantity), 0) AS total_fuel,
        COALESCE(SUM(fuel_amount), 0) AS total_fuel_cost,
        COALESCE(SUM(total_expenses), 0) AS total_expenses,
        COALESCE(SUM(driver_accruals), 0) AS total_accruals,
        COALESCE(SUM(driver_payments), 0) AS total_payments,
        ROUND(
          COALESCE(SUM(fuel_quantity) / NULLIF(SUM(mileage), 0) * 100, 0),
          2
        ) AS avg_fuel_consumption_per_100km
      FROM driver_reports
      WHERE 1=1
    `;

    const params = [];

    if (dateFrom) {
      params.push(dateFrom);
      query += ` AND date_from >= $${params.length}`;
    }

    if (dateTo) {
      params.push(dateTo);
      query += ` AND date_to <= $${params.length}`;
    }

    query += `
      GROUP BY TO_CHAR(date_from, 'YYYY-MM')
      ORDER BY month DESC
      LIMIT $${params.length + 1}
    `;

    params.push(limit);

    const result = await pool.query(query, params);

    res.json(result.rows);
  } catch (error) {
    console.error('Ошибка получения статистики по месяцам:', error);
    res.status(500).json({ message: 'Ошибка сервера', error: error.message });
  }
});

// GET /api/driver-reports/stats/fuel-efficiency - эффективность расхода топлива
router.get('/stats/fuel-efficiency', async (req, res) => {
  try {
    const { dateFrom, dateTo, limit = 20 } = req.query;

    let query = `
      SELECT
        driver_id,
        driver_name,
        COUNT(*) AS reports_count,
        COALESCE(SUM(mileage), 0) AS total_mileage,
        COALESCE(SUM(fuel_quantity), 0) AS total_fuel,
        ROUND(
          COALESCE(SUM(fuel_quantity) / NULLIF(SUM(mileage), 0) * 100, 0),
          2
        ) AS fuel_consumption_per_100km,
        COALESCE(SUM(fuel_amount), 0) AS total_fuel_cost,
        ROUND(
          COALESCE(SUM(fuel_amount) / NULLIF(SUM(mileage), 0), 0),
          2
        ) AS fuel_cost_per_km
      FROM driver_reports
      WHERE mileage > 0 AND fuel_quantity > 0
    `;

    const params = [];

    if (dateFrom) {
      params.push(dateFrom);
      query += ` AND date_from >= $${params.length}`;
    }

    if (dateTo) {
      params.push(dateTo);
      query += ` AND date_to <= $${params.length}`;
    }

    query += `
      GROUP BY driver_id, driver_name
      ORDER BY fuel_consumption_per_100km ASC
      LIMIT $${params.length + 1}
    `;

    params.push(limit);

    const result = await pool.query(query, params);

    res.json(result.rows);
  } catch (error) {
    console.error('Ошибка получения статистики эффективности:', error);
    res.status(500).json({ message: 'Ошибка сервера', error: error.message });
  }
});

module.exports = router;
