const express = require('express');
const router = express.Router();
const pool = require('../config/database');

/**
 * Улучшенная логика объединения машин с похожими номерами
 *
 * Проблема: Машины с похожими номерами (B083TM43 и B083TH43) объединялись,
 * даже если это РАЗНЫЕ машины, работающие одновременно с разными водителями.
 *
 * Решение: Используем дополнительные признаки:
 * 1. Общие водители - если есть пересечение, возможно это одна машина
 * 2. Общие маршруты - если есть пересечение, возможно это одна машина
 * 3. Временные конфликты - если работают одновременно с разными водителями, это РАЗНЫЕ машины
 */

// Функция нормализации номера (кириллица -> латиница)
function normalizeVehicleNumber(number) {
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
}

// Функция расчета расстояния Левенштейна
function levenshteinDistance(str1, str2) {
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
}

// Проверка похожести номеров
function areSimilarNumbers(num1, num2) {
  const normalized1 = normalizeVehicleNumber(num1);
  const normalized2 = normalizeVehicleNumber(num2);

  // Точное совпадение после нормализации
  if (normalized1 === normalized2) return true;

  // Опечатка (расстояние = 1) только для номеров одинаковой длины
  if (normalized1.length === normalized2.length) {
    return levenshteinDistance(normalized1, normalized2) === 1;
  }

  return false;
}

// Функция получения детальной информации о рейсах машины
async function getVehicleTripsDetails(vehicleNumber, month) {
  let query = `
    SELECT
      vehicle_number,
      driver_name,
      route_name,
      DATE(loading_date) as trip_date,
      loading_date
    FROM trips
    WHERE vehicle_number = $1
  `;

  const params = [vehicleNumber];

  if (month) {
    query += ` AND DATE_TRUNC('month', loading_date) = DATE_TRUNC('month', $2::date)`;
    params.push(`${month}-01`);
  }

  const result = await pool.query(query, params);
  return result.rows;
}

// Проверка: можно ли объединить две машины?
async function shouldMergeVehicles(vehicle1Number, vehicle2Number, month) {
  // Получаем детали рейсов обеих машин
  const trips1 = await getVehicleTripsDetails(vehicle1Number, month);
  const trips2 = await getVehicleTripsDetails(vehicle2Number, month);

  if (trips1.length === 0 || trips2.length === 0) {
    return false; // Нет данных - не объединяем
  }

  // Собираем множества водителей
  const drivers1 = new Set(trips1.map(t => t.driver_name));
  const drivers2 = new Set(trips2.map(t => t.driver_name));

  // Собираем множества маршрутов
  const routes1 = new Set(trips1.map(t => t.route_name).filter(r => r));
  const routes2 = new Set(trips2.map(t => t.route_name).filter(r => r));

  // Проверяем пересечение водителей
  const commonDrivers = [...drivers1].filter(d => drivers2.has(d));
  const hasCommonDrivers = commonDrivers.length > 0;

  // Проверяем пересечение маршрутов
  const commonRoutes = [...routes1].filter(r => routes2.has(r));
  const hasCommonRoutes = commonRoutes.length > 0;

  // Если НЕТ общих водителей И НЕТ общих маршрутов - это точно РАЗНЫЕ машины
  if (!hasCommonDrivers && !hasCommonRoutes) {
    console.log(`❌ ${vehicle1Number} и ${vehicle2Number} - РАЗНЫЕ машины (нет общих водителей/маршрутов)`);
    return false;
  }

  // Проверяем временные конфликты
  // Группируем рейсы по датам
  const dateMap1 = {};
  const dateMap2 = {};

  trips1.forEach(t => {
    const date = t.trip_date.toISOString().split('T')[0];
    if (!dateMap1[date]) dateMap1[date] = [];
    dateMap1[date].push(t);
  });

  trips2.forEach(t => {
    const date = t.trip_date.toISOString().split('T')[0];
    if (!dateMap2[date]) dateMap2[date] = [];
    dateMap2[date].push(t);
  });

  // Находим общие даты работы
  const commonDates = Object.keys(dateMap1).filter(date => dateMap2[date]);

  // Проверяем конфликты: в один день разные водители = РАЗНЫЕ машины
  for (const date of commonDates) {
    const driversOnDate1 = new Set(dateMap1[date].map(t => t.driver_name));
    const driversOnDate2 = new Set(dateMap2[date].map(t => t.driver_name));

    const commonDriversOnDate = [...driversOnDate1].filter(d => driversOnDate2.has(d));

    if (commonDriversOnDate.length === 0) {
      // В один день работали РАЗНЫЕ водители - это РАЗНЫЕ машины!
      console.log(`❌ ${vehicle1Number} и ${vehicle2Number} - РАЗНЫЕ машины (${date}: разные водители)`);
      return false;
    }
  }

  // Если дошли сюда - есть общие признаки и нет конфликтов, можно объединять
  console.log(`✅ ${vehicle1Number} и ${vehicle2Number} - ОДНА машина (общие признаки, нет конфликтов)`);
  return true;
}

// GET /api/vehicles/stats - статистика по автомобилям с умным объединением
router.get('/stats', async (req, res) => {
  try {
    const { month } = req.query;

    // Получаем статистику по каждому уникальному номеру из БД
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

    if (month) {
      query += ` WHERE DATE_TRUNC('month', t.loading_date) = DATE_TRUNC('month', $1::date)`;
      params.push(`${month}-01`);
    }

    query += `
      GROUP BY t.vehicle_number
      ORDER BY total_revenue DESC
    `;

    const result = await pool.query(query, params);
    const allVehicles = result.rows;

    console.log(`\n🚗 Найдено ${allVehicles.length} уникальных номеров в БД`);

    // Умное объединение похожих машин
    const mergedVehicles = [];
    const processed = new Set();

    for (const vehicle of allVehicles) {
      if (processed.has(vehicle.vehicle_number)) continue;

      const group = [vehicle];
      processed.add(vehicle.vehicle_number);

      // Ищем похожие номера
      for (const other of allVehicles) {
        if (vehicle.vehicle_number === other.vehicle_number) continue;
        if (processed.has(other.vehicle_number)) continue;

        // Проверяем похожесть номеров
        if (areSimilarNumbers(vehicle.vehicle_number, other.vehicle_number)) {
          // Проверяем можно ли объединить (на основе водителей/маршрутов)
          const canMerge = await shouldMergeVehicles(
            vehicle.vehicle_number,
            other.vehicle_number,
            month
          );

          if (canMerge) {
            group.push(other);
            processed.add(other.vehicle_number);
          }
        }
      }

      // Объединяем группу в одну машину
      if (group.length > 1) {
        console.log(`🔗 Объединяем ${group.length} номеров: ${group.map(v => v.vehicle_number).join(', ')}`);
      }

      const merged = {
        vehicle_number: normalizeVehicleNumber(vehicle.vehicle_number), // Канонический номер
        trips_count: 0,
        total_distance: 0,
        total_revenue: 0,
        total_revenue_with_vat: 0,
        drivers_count: 0,
        working_days: 0,
        revenue_per_km: 0,
        revenue_per_km_with_vat: 0,
        trips_per_day: 0
      };

      // Суммируем данные
      group.forEach(v => {
        merged.trips_count += Number(v.trips_count);
        merged.total_distance += Number(v.total_distance);
        merged.total_revenue += Number(v.total_revenue);
        merged.total_revenue_with_vat += Number(v.total_revenue_with_vat);
        merged.drivers_count = Math.max(merged.drivers_count, Number(v.drivers_count));
        merged.working_days = Math.max(merged.working_days, Number(v.working_days));
      });

      // Пересчитываем средние
      merged.revenue_per_km = merged.total_distance > 0
        ? Number((merged.total_revenue / merged.total_distance).toFixed(2))
        : 0;

      merged.revenue_per_km_with_vat = merged.total_distance > 0
        ? Number((merged.total_revenue_with_vat / merged.total_distance).toFixed(2))
        : 0;

      merged.trips_per_day = merged.working_days > 0
        ? Number((merged.trips_count / merged.working_days).toFixed(2))
        : 0;

      mergedVehicles.push(merged);
    }

    // Сортируем по выручке
    mergedVehicles.sort((a, b) => b.total_revenue - a.total_revenue);

    console.log(`✅ Итого ${mergedVehicles.length} машин после умного объединения\n`);

    res.json(mergedVehicles);
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

    // Нормализуем входящий номер
    const normalizedNumber = normalizeVehicleNumber(vehicleNumber);

    // Ищем все похожие номера в БД
    let findSimilarQuery = `
      SELECT DISTINCT vehicle_number
      FROM trips
    `;

    if (month) {
      findSimilarQuery += ` WHERE DATE_TRUNC('month', loading_date) = DATE_TRUNC('month', $1::date)`;
    }

    const similarResult = await pool.query(
      findSimilarQuery,
      month ? [`${month}-01`] : []
    );

    const similarNumbers = similarResult.rows
      .map(row => row.vehicle_number)
      .filter(num => normalizeVehicleNumber(num) === normalizedNumber);

    // Получаем рейсы для всех похожих номеров
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
        t.penalty_amount,
        t.vehicle_number
      FROM trips t
      WHERE t.vehicle_number = ANY($1)
    `;

    const params = [similarNumbers];

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
