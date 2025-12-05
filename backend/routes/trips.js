const express = require('express');
const router = express.Router();
const pool = require('../config/database');

// GET /api/trips
router.get('/', async (req, res) => {
  try {
    const query = `
      SELECT
        id,
        wb_trip_number,
        loading_date,
        unloading_date,
        vehicle_number,
        driver_name,
        route_name,
        trip_amount,
        (trip_amount * 1.2) as trip_amount_with_vat,
        distance_km,
        has_penalty,
        penalty_amount,
        containers_count,
        distribution_center,
        created_at
      FROM trips
      ORDER BY loading_date DESC, id DESC
      LIMIT 1000
    `;

    const result = await pool.query(query);

    res.json(result.rows);
  } catch (error) {
    console.error('Ошибка получения рейсов:', error);
    res.status(500).json({ message: 'Ошибка сервера' });
  }
});

module.exports = router;
