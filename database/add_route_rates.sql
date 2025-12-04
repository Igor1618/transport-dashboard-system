-- Создание таблицы для тарифов по маршрутам
CREATE TABLE IF NOT EXISTS route_rates (
  id SERIAL PRIMARY KEY,
  route_name VARCHAR(300) NOT NULL UNIQUE,
  rate_per_trip DECIMAL(10,2) NOT NULL DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Индекс для быстрого поиска активных маршрутов
CREATE INDEX idx_route_rates_active ON route_rates(is_active);

-- Триггер для обновления updated_at
CREATE OR REPLACE FUNCTION update_route_rates_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER route_rates_updated_at
BEFORE UPDATE ON route_rates
FOR EACH ROW
EXECUTE FUNCTION update_route_rates_updated_at();

-- Автоматически добавляем уникальные маршруты из существующих рейсов
INSERT INTO route_rates (route_name, rate_per_trip)
SELECT DISTINCT route_name, 5000.00 as rate_per_trip
FROM trips
WHERE route_name IS NOT NULL AND route_name != ''
ON CONFLICT (route_name) DO NOTHING;

COMMENT ON TABLE route_rates IS 'Тарифы оплаты водителям за маршруты';
COMMENT ON COLUMN route_rates.route_name IS 'Название маршрута (должно совпадать с trips.route_name)';
COMMENT ON COLUMN route_rates.rate_per_trip IS 'Ставка за один рейс по этому маршруту';
