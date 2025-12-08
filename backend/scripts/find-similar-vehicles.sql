-- Скрипт для поиска похожих номеров машин с опечатками
-- Использует функцию levenshtein для нечеткого сравнения

-- 1. Сначала создаем расширение для levenshtein (если еще не создано)
CREATE EXTENSION IF NOT EXISTS fuzzystrmatch;

-- 2. Находим пары похожих номеров (расстояние Левенштейна <= 2)
SELECT
    v1.vehicle_number as номер_1,
    COUNT(DISTINCT CASE WHEN t1.id IS NOT NULL THEN t1.id END) as рейсов_1,
    v2.vehicle_number as номер_2,
    COUNT(DISTINCT CASE WHEN t2.id IS NOT NULL THEN t2.id END) as рейсов_2,
    levenshtein(v1.vehicle_number, v2.vehicle_number) as расстояние
FROM (SELECT DISTINCT vehicle_number FROM trips) v1
CROSS JOIN (SELECT DISTINCT vehicle_number FROM trips) v2
LEFT JOIN trips t1 ON t1.vehicle_number = v1.vehicle_number
LEFT JOIN trips t2 ON t2.vehicle_number = v2.vehicle_number
WHERE v1.vehicle_number < v2.vehicle_number  -- Избегаем дубликатов
    AND levenshtein(v1.vehicle_number, v2.vehicle_number) <= 2  -- Максимум 2 отличия
    AND levenshtein(v1.vehicle_number, v2.vehicle_number) > 0   -- Не одинаковые
    AND LENGTH(v1.vehicle_number) = LENGTH(v2.vehicle_number)   -- Одинаковая длина
GROUP BY v1.vehicle_number, v2.vehicle_number
ORDER BY расстояние, рейсов_1 DESC;

-- 3. Пример исправления опечатки (РАСКОММЕНТИРУЙ И ПОДСТАВЬ СВОИ ЗНАЧЕНИЯ):
-- UPDATE trips
-- SET vehicle_number = 'B083TM43'  -- Правильный номер
-- WHERE vehicle_number = 'B083TH43';  -- Неправильный номер (с опечаткой)

-- 4. После исправления можно проверить результат:
-- SELECT vehicle_number, COUNT(*) as trips_count
-- FROM trips
-- WHERE vehicle_number LIKE 'B083T%'
-- GROUP BY vehicle_number
-- ORDER BY vehicle_number;
