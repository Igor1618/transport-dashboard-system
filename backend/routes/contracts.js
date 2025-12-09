const express = require('express');
const router = express.Router();
const pool = require('../config/database');

// GET /api/contracts - получить все договоры
router.get('/', async (req, res) => {
  try {
    const {
      search,
      dateFrom,
      dateTo,
      vehicleId,
      driverId,
      contractorId,
      route,
      limit = 50,
      offset = 0
    } = req.query;

    let query = `
      SELECT
        c.uuid,
        c.number,
        c.date,
        c.organization,
        c.contractor_id,
        c.contractor_name,
        c.vehicle_id,
        c.vehicle_number,
        c.driver_id,
        c.driver_name,
        c.responsible_logist,
        c.route,
        c.payment_term,
        c.payment_condition,
        c.amount,
        c.synced_at,
        c.created_at
      FROM contracts c
      WHERE 1=1
    `;

    const params = [];

    // Поиск по номеру договора
    if (search) {
      params.push(`%${search}%`);
      query += ` AND c.number ILIKE $${params.length}`;
    }

    // Фильтр по датам
    if (dateFrom) {
      params.push(dateFrom);
      query += ` AND c.date >= $${params.length}`;
    }

    if (dateTo) {
      params.push(dateTo);
      query += ` AND c.date <= $${params.length}`;
    }

    // Фильтр по машине
    if (vehicleId) {
      params.push(vehicleId);
      query += ` AND c.vehicle_id = $${params.length}`;
    }

    // Фильтр по водителю
    if (driverId) {
      params.push(driverId);
      query += ` AND c.driver_id = $${params.length}`;
    }

    // Фильтр по контрагенту
    if (contractorId) {
      params.push(contractorId);
      query += ` AND c.contractor_id = $${params.length}`;
    }

    // Фильтр по маршруту
    if (route) {
      params.push(`%${route}%`);
      query += ` AND c.route ILIKE $${params.length}`;
    }

    query += `
      ORDER BY c.date DESC, c.created_at DESC
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `;

    params.push(limit, offset);

    const result = await pool.query(query, params);

    // Общее количество с фильтрами
    let countQuery = `SELECT COUNT(*) FROM contracts c WHERE 1=1`;
    const countParams = [];
    let paramIndex = 1;

    if (search) {
      countParams.push(`%${search}%`);
      countQuery += ` AND c.number ILIKE $${paramIndex++}`;
    }
    if (dateFrom) {
      countParams.push(dateFrom);
      countQuery += ` AND c.date >= $${paramIndex++}`;
    }
    if (dateTo) {
      countParams.push(dateTo);
      countQuery += ` AND c.date <= $${paramIndex++}`;
    }
    if (vehicleId) {
      countParams.push(vehicleId);
      countQuery += ` AND c.vehicle_id = $${paramIndex++}`;
    }
    if (driverId) {
      countParams.push(driverId);
      countQuery += ` AND c.driver_id = $${paramIndex++}`;
    }
    if (contractorId) {
      countParams.push(contractorId);
      countQuery += ` AND c.contractor_id = $${paramIndex++}`;
    }
    if (route) {
      countParams.push(`%${route}%`);
      countQuery += ` AND c.route ILIKE $${paramIndex++}`;
    }

    const countResult = await pool.query(countQuery, countParams);

    res.json({
      contracts: result.rows,
      total: parseInt(countResult.rows[0].count),
      limit: parseInt(limit),
      offset: parseInt(offset)
    });
  } catch (error) {
    console.error('Ошибка получения договоров:', error);
    res.status(500).json({ message: 'Ошибка сервера', error: error.message });
  }
});

// GET /api/contracts/:uuid - получить договор по UUID
router.get('/:uuid', async (req, res) => {
  try {
    const { uuid } = req.params;

    const query = `
      SELECT
        c.uuid,
        c.number,
        c.date,
        c.organization,
        c.contractor_id,
        c.contractor_name,
        c.vehicle_id,
        c.vehicle_number,
        c.driver_id,
        c.driver_name,
        c.responsible_logist,
        c.route,
        c.payment_term,
        c.payment_condition,
        c.amount,
        c.synced_at,
        c.created_at,
        c.updated_at
      FROM contracts c
      WHERE c.uuid = $1
    `;

    const result = await pool.query(query, [uuid]);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Договор не найден' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Ошибка получения договора:', error);
    res.status(500).json({ message: 'Ошибка сервера', error: error.message });
  }
});

// GET /api/contracts/stats/summary - общая статистика по договорам
router.get('/stats/summary', async (req, res) => {
  try {
    const { dateFrom, dateTo } = req.query;

    let query = `
      SELECT
        COUNT(*) AS total_contracts,
        COALESCE(SUM(amount), 0) AS total_amount,
        COALESCE(AVG(amount), 0) AS avg_amount,
        COALESCE(MIN(amount), 0) AS min_amount,
        COALESCE(MAX(amount), 0) AS max_amount,
        COUNT(DISTINCT vehicle_id) AS unique_vehicles,
        COUNT(DISTINCT driver_id) AS unique_drivers,
        COUNT(DISTINCT contractor_id) AS unique_contractors,
        COUNT(DISTINCT route) AS unique_routes
      FROM contracts
      WHERE 1=1
    `;

    const params = [];

    if (dateFrom) {
      params.push(dateFrom);
      query += ` AND date >= $${params.length}`;
    }

    if (dateTo) {
      params.push(dateTo);
      query += ` AND date <= $${params.length}`;
    }

    const result = await pool.query(query, params);

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Ошибка получения статистики договоров:', error);
    res.status(500).json({ message: 'Ошибка сервера', error: error.message });
  }
});

// GET /api/contracts/stats/by-month - статистика по месяцам
router.get('/stats/by-month', async (req, res) => {
  try {
    const { dateFrom, dateTo, limit = 12 } = req.query;

    let query = `
      SELECT
        TO_CHAR(date, 'YYYY-MM') AS month,
        COUNT(*) AS contracts_count,
        COALESCE(SUM(amount), 0) AS total_amount,
        COALESCE(AVG(amount), 0) AS avg_amount,
        COUNT(DISTINCT vehicle_id) AS unique_vehicles,
        COUNT(DISTINCT driver_id) AS unique_drivers
      FROM contracts
      WHERE 1=1
    `;

    const params = [];

    if (dateFrom) {
      params.push(dateFrom);
      query += ` AND date >= $${params.length}`;
    }

    if (dateTo) {
      params.push(dateTo);
      query += ` AND date <= $${params.length}`;
    }

    query += `
      GROUP BY TO_CHAR(date, 'YYYY-MM')
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

// GET /api/contracts/stats/by-route - статистика по маршрутам
router.get('/stats/by-route', async (req, res) => {
  try {
    const { dateFrom, dateTo, limit = 20 } = req.query;

    let query = `
      SELECT
        route,
        COUNT(*) AS contracts_count,
        COALESCE(SUM(amount), 0) AS total_amount,
        COALESCE(AVG(amount), 0) AS avg_amount,
        COUNT(DISTINCT vehicle_id) AS unique_vehicles,
        COUNT(DISTINCT driver_id) AS unique_drivers
      FROM contracts
      WHERE route IS NOT NULL AND route != ''
    `;

    const params = [];

    if (dateFrom) {
      params.push(dateFrom);
      query += ` AND date >= $${params.length}`;
    }

    if (dateTo) {
      params.push(dateTo);
      query += ` AND date <= $${params.length}`;
    }

    query += `
      GROUP BY route
      ORDER BY total_amount DESC
      LIMIT $${params.length + 1}
    `;

    params.push(limit);

    const result = await pool.query(query, params);

    res.json(result.rows);
  } catch (error) {
    console.error('Ошибка получения статистики по маршрутам:', error);
    res.status(500).json({ message: 'Ошибка сервера', error: error.message });
  }
});

module.exports = router;
