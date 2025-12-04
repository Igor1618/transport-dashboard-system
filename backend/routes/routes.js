const express = require('express');
const router = express.Router();
const pool = require('../config/database');

// GET /api/routes - получить все маршруты с тарифами
router.get('/', async (req, res) => {
  try {
    const query = `
      SELECT
        rr.id,
        rr.route_name,
        rr.rate_per_trip,
        rr.is_active,
        COUNT(t.id) as trips_count,
        COUNT(DISTINCT t.driver_name) as drivers_count
      FROM route_rates rr
      LEFT JOIN trips t ON t.route_name = rr.route_name
      GROUP BY rr.id, rr.route_name, rr.rate_per_trip, rr.is_active
      ORDER BY trips_count DESC, rr.route_name
    `;

    const result = await pool.query(query);
    res.json(result.rows);
  } catch (error) {
    console.error('Ошибка получения маршрутов:', error);
    res.status(500).json({ message: 'Ошибка сервера' });
  }
});

// PUT /api/routes/:id - обновить тариф
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { rate_per_trip, is_active } = req.body;

    if (rate_per_trip === undefined && is_active === undefined) {
      return res.status(400).json({ message: 'Нет данных для обновления' });
    }

    let query = 'UPDATE route_rates SET ';
    const updates = [];
    const values = [];
    let paramCount = 1;

    if (rate_per_trip !== undefined) {
      updates.push(`rate_per_trip = $${paramCount}`);
      values.push(rate_per_trip);
      paramCount++;
    }

    if (is_active !== undefined) {
      updates.push(`is_active = $${paramCount}`);
      values.push(is_active);
      paramCount++;
    }

    query += updates.join(', ');
    query += ` WHERE id = $${paramCount} RETURNING *`;
    values.push(id);

    const result = await pool.query(query, values);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Маршрут не найден' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Ошибка обновления тарифа:', error);
    res.status(500).json({ message: 'Ошибка сервера' });
  }
});

// POST /api/routes - добавить новый маршрут с тарифом
router.post('/', async (req, res) => {
  try {
    const { route_name, rate_per_trip } = req.body;

    if (!route_name || rate_per_trip === undefined) {
      return res.status(400).json({ message: 'Укажите название маршрута и тариф' });
    }

    const query = `
      INSERT INTO route_rates (route_name, rate_per_trip)
      VALUES ($1, $2)
      RETURNING *
    `;

    const result = await pool.query(query, [route_name, rate_per_trip]);
    res.status(201).json(result.rows[0]);
  } catch (error) {
    if (error.code === '23505') { // unique violation
      return res.status(409).json({ message: 'Маршрут с таким названием уже существует' });
    }
    console.error('Ошибка создания маршрута:', error);
    res.status(500).json({ message: 'Ошибка сервера' });
  }
});

// DELETE /api/routes/:id - удалить маршрут
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('DELETE FROM route_rates WHERE id = $1 RETURNING *', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Маршрут не найден' });
    }

    res.json({ message: 'Маршрут удален' });
  } catch (error) {
    console.error('Ошибка удаления маршрута:', error);
    res.status(500).json({ message: 'Ошибка сервера' });
  }
});

module.exports = router;
