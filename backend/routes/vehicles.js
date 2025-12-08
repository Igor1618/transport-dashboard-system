const express = require('express');
const router = express.Router();
const pool = require('../config/database');

// GET /api/vehicles/canonical
// Получение списка канонических (правильных) номеров машин
router.get('/canonical', async (req, res) => {
  try {
    // Функция для нормализации номера (кириллица -> латиница)
    const normalizeNumber = (number) => {
      const cyrillicToLatin = {
        'А': 'A', 'В': 'B', 'Е': 'E', 'К': 'K', 'М': 'M', 'Н': 'H',
        'О': 'O', 'Р': 'P', 'С': 'C', 'Т': 'T', 'У': 'Y', 'Х': 'X',
        'а': 'A', 'в': 'B', 'е': 'E', 'к': 'K', 'м': 'M', 'н': 'H',
        'о': 'O', 'р': 'P', 'с': 'C', 'т': 'T', 'у': 'Y', 'х': 'X'
      };

      return number
        .trim()
        .toUpperCase()
        .split('')
        .map(char => cyrillicToLatin[char] || char)
        .join('');
    };

    // Функция расчета расстояния Левенштейна
    const levenshteinDistance = (str1, str2) => {
      const len1 = str1.length;
      const len2 = str2.length;
      const dp = Array(len1 + 1).fill(null).map(() => Array(len2 + 1).fill(0));

      for (let i = 0; i <= len1; i++) dp[i][0] = i;
      for (let j = 0; j <= len2; j++) dp[0][j] = j;

      for (let i = 1; i <= len1; i++) {
        for (let j = 1; j <= len2; j++) {
          if (str1[i - 1] === str2[j - 1]) {
            dp[i][j] = dp[i - 1][j - 1];
          } else {
            dp[i][j] = Math.min(
              dp[i - 1][j] + 1,
              dp[i][j - 1] + 1,
              dp[i - 1][j - 1] + 1
            );
          }
        }
      }
      return dp[len1][len2];
    };

    // Получаем все номера с количеством рейсов
    const query = `
      SELECT
        vehicle_number,
        COUNT(*) as trips_count
      FROM trips
      GROUP BY vehicle_number
      ORDER BY trips_count DESC
    `;

    const result = await pool.query(query);
    const allNumbers = result.rows;

    // Группируем похожие номера
    const processed = new Set();
    const canonicalList = [];

    for (const vehicle of allNumbers) {
      if (processed.has(vehicle.vehicle_number)) continue;

      const normalized = normalizeNumber(vehicle.vehicle_number);
      const similarGroup = [vehicle];

      // Ищем похожие номера (расстояние = 1)
      for (const other of allNumbers) {
        if (vehicle.vehicle_number === other.vehicle_number) continue;
        if (processed.has(other.vehicle_number)) continue;

        const otherNormalized = normalizeNumber(other.vehicle_number);

        // Только для номеров одинаковой длины
        if (normalized.length === otherNormalized.length) {
          const distance = levenshteinDistance(normalized, otherNormalized);

          // Если расстояние = 1 (опечатка)
          if (distance === 1) {
            similarGroup.push(other);
            processed.add(other.vehicle_number);
          }
        }
      }

      // Помечаем главный номер как обработанный
      processed.add(vehicle.vehicle_number);

      // Из группы выбираем номер с наибольшим количеством рейсов
      const canonical = similarGroup.reduce((prev, curr) =>
        Number(curr.trips_count) > Number(prev.trips_count) ? curr : prev
      );

      // Добавляем в canonical list только нормализованный номер
      canonicalList.push(normalizeNumber(canonical.vehicle_number));
    }

    res.json(canonicalList);
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
