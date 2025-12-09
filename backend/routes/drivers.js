const express = require('express');
const router = express.Router();
const pool = require('../config/database');

// GET /api/drivers - получить всех водителей из 1C
router.get('/', async (req, res) => {
  try {
    const { search, limit = 100, offset = 0 } = req.query;

    let query = `
      SELECT
        d.id,
        d.full_name,
        d.synced_at,
        d.created_at,
        d.updated_at
      FROM drivers d
      WHERE 1=1
    `;

    const params = [];

    // Поиск по имени
    if (search) {
      params.push(`%${search}%`);
      query += ` AND d.full_name ILIKE $${params.length}`;
    }

    query += `
      ORDER BY d.full_name ASC
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `;

    params.push(limit, offset);

    const result = await pool.query(query, params);

    // Общее количество
    const countQuery = search
      ? `SELECT COUNT(*) FROM drivers WHERE full_name ILIKE $1`
      : `SELECT COUNT(*) FROM drivers`;
    const countParams = search ? [`%${search}%`] : [];
    const countResult = await pool.query(countQuery, countParams);

    res.json({
      drivers: result.rows,
      total: parseInt(countResult.rows[0].count),
      limit: parseInt(limit),
      offset: parseInt(offset)
    });
  } catch (error) {
    console.error('Ошибка получения водителей:', error);
    res.status(500).json({ message: 'Ошибка сервера', error: error.message });
  }
});

// GET /api/drivers/:id - получить водителя по ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const query = `
      SELECT
        d.id,
        d.full_name,
        d.synced_at,
        d.created_at,
        d.updated_at
      FROM drivers d
      WHERE d.id = $1
    `;

    const result = await pool.query(query, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Водитель не найден' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Ошибка получения водителя:', error);
    res.status(500).json({ message: 'Ошибка сервера', error: error.message });
  }
});

// GET /api/drivers/:id/stats - статистика по водителю
router.get('/:id/stats', async (req, res) => {
  try {
    const { id } = req.params;
    const { dateFrom, dateTo } = req.query;

    let query = `
      SELECT
        d.id,
        d.full_name,

        -- Отчеты
        COUNT(DISTINCT dr.id) AS reports_count,

        -- Договоры
        COUNT(DISTINCT c.uuid) AS contracts_count,
        COALESCE(SUM(c.amount), 0) AS total_contracts_amount,
        COALESCE(AVG(c.amount), 0) AS avg_contract_amount,

        -- Пробег и топливо
        COALESCE(SUM(dr.mileage), 0) AS total_mileage,
        COALESCE(SUM(dr.fuel_quantity), 0) AS total_fuel,
        COALESCE(SUM(dr.fuel_amount), 0) AS total_fuel_cost,

        -- Расходы
        COALESCE(SUM(dr.total_expenses), 0) AS total_expenses,
        COALESCE(SUM(dr.driver_accruals), 0) AS total_accruals,
        COALESCE(SUM(dr.driver_payments), 0) AS total_payments,
        COALESCE(SUM(dr.driver_accruals) - SUM(dr.driver_payments), 0) AS balance,

        -- Эффективность
        ROUND(
          COALESCE(SUM(c.amount) / NULLIF(SUM(dr.mileage), 0), 0),
          2
        ) AS revenue_per_km,

        ROUND(
          COALESCE(SUM(dr.fuel_quantity) / NULLIF(SUM(dr.mileage), 0) * 100, 0),
          2
        ) AS fuel_consumption_per_100km,

        -- Машины
        COUNT(DISTINCT COALESCE(dr.vehicle_id, c.vehicle_id)) AS vehicles_used

      FROM drivers d
      LEFT JOIN driver_reports dr ON d.id = dr.driver_id
      LEFT JOIN contracts c ON d.id = c.driver_id
      WHERE d.id = $1
    `;

    const params = [id];

    // Фильтр по датам
    if (dateFrom && dateTo) {
      query += ` AND (
        (dr.date_from >= $2 AND dr.date_from <= $3) OR
        (c.date >= $2 AND c.date <= $3)
      )`;
      params.push(dateFrom, dateTo);
    }

    query += ` GROUP BY d.id, d.full_name`;

    const result = await pool.query(query, params);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Водитель не найден' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Ошибка получения статистики водителя:', error);
    res.status(500).json({ message: 'Ошибка сервера', error: error.message });
  }
});

// GET /api/drivers/:id/reports - отчеты водителя
router.get('/:id/reports', async (req, res) => {
  try {
    const { id } = req.params;
    const { limit = 50, offset = 0 } = req.query;

    const query = `
      SELECT
        dr.id,
        dr.number,
        dr.date_from,
        dr.date_to,
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
        dr.synced_at
      FROM driver_reports dr
      WHERE dr.driver_id = $1
      ORDER BY dr.date_from DESC
      LIMIT $2 OFFSET $3
    `;

    const result = await pool.query(query, [id, limit, offset]);

    // Общее количество
    const countQuery = `SELECT COUNT(*) FROM driver_reports WHERE driver_id = $1`;
    const countResult = await pool.query(countQuery, [id]);

    res.json({
      reports: result.rows,
      total: parseInt(countResult.rows[0].count),
      limit: parseInt(limit),
      offset: parseInt(offset)
    });
  } catch (error) {
    console.error('Ошибка получения отчетов водителя:', error);
    res.status(500).json({ message: 'Ошибка сервера', error: error.message });
  }
});

// GET /api/drivers/:id/contracts - договоры водителя
router.get('/:id/contracts', async (req, res) => {
  try {
    const { id } = req.params;
    const { limit = 50, offset = 0 } = req.query;

    const query = `
      SELECT
        c.uuid,
        c.number,
        c.date,
        c.organization,
        c.contractor_name,
        c.vehicle_number,
        c.route,
        c.amount,
        c.payment_term,
        c.synced_at
      FROM contracts c
      WHERE c.driver_id = $1
      ORDER BY c.date DESC
      LIMIT $2 OFFSET $3
    `;

    const result = await pool.query(query, [id, limit, offset]);

    // Общее количество
    const countQuery = `SELECT COUNT(*) FROM contracts WHERE driver_id = $1`;
    const countResult = await pool.query(countQuery, [id]);

    res.json({
      contracts: result.rows,
      total: parseInt(countResult.rows[0].count),
      limit: parseInt(limit),
      offset: parseInt(offset)
    });
  } catch (error) {
    console.error('Ошибка получения договоров водителя:', error);
    res.status(500).json({ message: 'Ошибка сервера', error: error.message });
  }
});

module.exports = router;
