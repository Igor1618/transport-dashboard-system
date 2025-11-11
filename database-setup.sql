-- ================================================
-- Скрипт создания базы данных для дашборда
-- ================================================
-- База данных: transport_dashboard
-- PostgreSQL версия: 13+
--
-- Использование:
--   psql -h 127.0.0.1 -p 5433 -U postgres -f database-setup.sql
--
-- Или через Supabase SQL Editor:
--   Скопируйте и выполните в SQL редакторе
-- ================================================

-- Создание базы данных (если еще не создана)
-- CREATE DATABASE transport_dashboard;

-- Подключаемся к базе
-- \c transport_dashboard;

-- ================================================
-- Таблица: vehicles (Транспортные средства)
-- ================================================

CREATE TABLE IF NOT EXISTS vehicles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    number VARCHAR(20) NOT NULL UNIQUE,
    model VARCHAR(100) NOT NULL,
    brand VARCHAR(50),
    year INTEGER,
    vin VARCHAR(17),
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'maintenance', 'sold')),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Индексы для быстрого поиска
CREATE INDEX IF NOT EXISTS idx_vehicles_number ON vehicles(number);
CREATE INDEX IF NOT EXISTS idx_vehicles_status ON vehicles(status);
CREATE INDEX IF NOT EXISTS idx_vehicles_created_at ON vehicles(created_at);

COMMENT ON TABLE vehicles IS 'Транспортные средства компании';
COMMENT ON COLUMN vehicles.id IS 'Уникальный идентификатор';
COMMENT ON COLUMN vehicles.number IS 'Государственный регистрационный номер';
COMMENT ON COLUMN vehicles.model IS 'Модель транспортного средства';
COMMENT ON COLUMN vehicles.status IS 'Статус: active, inactive, maintenance, sold';

-- ================================================
-- Таблица: drivers (Водители)
-- ================================================

CREATE TABLE IF NOT EXISTS drivers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    full_name VARCHAR(200) NOT NULL,
    phone VARCHAR(20),
    license_number VARCHAR(50),
    license_category VARCHAR(20),
    license_expiry_date DATE,
    hire_date DATE,
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'vacation', 'fired')),
    rating INTEGER DEFAULT 0 CHECK (rating >= 0 AND rating <= 100),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Индексы
CREATE INDEX IF NOT EXISTS idx_drivers_full_name ON drivers(full_name);
CREATE INDEX IF NOT EXISTS idx_drivers_status ON drivers(status);
CREATE INDEX IF NOT EXISTS idx_drivers_rating ON drivers(rating DESC);

COMMENT ON TABLE drivers IS 'Водители компании';
COMMENT ON COLUMN drivers.rating IS 'Рейтинг водителя (0-100)';

-- ================================================
-- Таблица: vehicle_monthly_data (Месячные данные по транспорту)
-- ================================================

CREATE TABLE IF NOT EXISTS vehicle_monthly_data (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vehicle_id UUID NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
    year INTEGER NOT NULL CHECK (year >= 2000 AND year <= 2100),
    month INTEGER NOT NULL CHECK (month >= 1 AND month <= 12),
    income DECIMAL(15, 2) DEFAULT 0 CHECK (income >= 0),
    expenses DECIMAL(15, 2) DEFAULT 0 CHECK (expenses >= 0),
    trips INTEGER DEFAULT 0 CHECK (trips >= 0),
    distance_km DECIMAL(10, 2) DEFAULT 0 CHECK (distance_km >= 0),
    fuel_consumption DECIMAL(10, 2) DEFAULT 0 CHECK (fuel_consumption >= 0),
    efficiency INTEGER DEFAULT 0 CHECK (efficiency >= 0 AND efficiency <= 100),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(vehicle_id, year, month)
);

-- Индексы для быстрого поиска
CREATE INDEX IF NOT EXISTS idx_vehicle_monthly_year_month ON vehicle_monthly_data(year, month);
CREATE INDEX IF NOT EXISTS idx_vehicle_monthly_vehicle ON vehicle_monthly_data(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_vehicle_monthly_income ON vehicle_monthly_data(income DESC);

COMMENT ON TABLE vehicle_monthly_data IS 'Месячные показатели по каждому транспортному средству';
COMMENT ON COLUMN vehicle_monthly_data.month IS 'Месяц (1-12, где 1 = Январь)';
COMMENT ON COLUMN vehicle_monthly_data.efficiency IS 'Эффективность в процентах (0-100)';

-- ================================================
-- Таблица: driver_monthly_data (Месячные данные по водителям)
-- ================================================

CREATE TABLE IF NOT EXISTS driver_monthly_data (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    driver_id UUID NOT NULL REFERENCES drivers(id) ON DELETE CASCADE,
    year INTEGER NOT NULL CHECK (year >= 2000 AND year <= 2100),
    month INTEGER NOT NULL CHECK (month >= 1 AND month <= 12),
    trips INTEGER DEFAULT 0 CHECK (trips >= 0),
    distance_km DECIMAL(10, 2) DEFAULT 0 CHECK (distance_km >= 0),
    hours_worked DECIMAL(8, 2) DEFAULT 0 CHECK (hours_worked >= 0),
    violations INTEGER DEFAULT 0 CHECK (violations >= 0),
    rating INTEGER DEFAULT 0 CHECK (rating >= 0 AND rating <= 100),
    salary DECIMAL(15, 2) DEFAULT 0 CHECK (salary >= 0),
    bonuses DECIMAL(15, 2) DEFAULT 0 CHECK (bonuses >= 0),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(driver_id, year, month)
);

-- Индексы
CREATE INDEX IF NOT EXISTS idx_driver_monthly_year_month ON driver_monthly_data(year, month);
CREATE INDEX IF NOT EXISTS idx_driver_monthly_driver ON driver_monthly_data(driver_id);
CREATE INDEX IF NOT EXISTS idx_driver_monthly_rating ON driver_monthly_data(rating DESC);

COMMENT ON TABLE driver_monthly_data IS 'Месячные показатели по водителям';

-- ================================================
-- Функция: обновление updated_at при изменении
-- ================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Триггеры для автоматического обновления updated_at
CREATE TRIGGER update_vehicles_updated_at
    BEFORE UPDATE ON vehicles
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_drivers_updated_at
    BEFORE UPDATE ON drivers
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_vehicle_monthly_data_updated_at
    BEFORE UPDATE ON vehicle_monthly_data
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_driver_monthly_data_updated_at
    BEFORE UPDATE ON driver_monthly_data
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ================================================
-- Тестовые данные (опционально)
-- ================================================

-- Раскомментируйте если нужны тестовые данные

/*
INSERT INTO vehicles (number, model, brand, year, status) VALUES
('А123БВ77', 'TGX', 'MAN', 2020, 'active'),
('В456ГД78', 'Actros', 'Mercedes-Benz', 2021, 'active'),
('С789ЕЖ50', 'R500', 'Scania', 2019, 'active'),
('Е012ИЙ99', 'FH', 'Volvo', 2022, 'active'),
('К345ЛМ77', 'XF', 'DAF', 2020, 'active')
ON CONFLICT (number) DO NOTHING;

INSERT INTO drivers (full_name, phone, license_number, status, rating) VALUES
('Иванов Алексей Сергеевич', '+79001234567', 'ВУ123456', 'active', 85),
('Петров Владимир Иванович', '+79001234568', 'ВУ123457', 'active', 82),
('Сидоров Петр Петрович', '+79001234569', 'ВУ123458', 'active', 78),
('Козлов Игорь Игоревич', '+79001234570', 'ВУ123459', 'active', 75),
('Новиков Сергей Александрович', '+79001234571', 'ВУ123460', 'active', 72),
('Морозов Дмитрий Владимирович', '+79001234572', 'ВУ123461', 'active', 70)
ON CONFLICT DO NOTHING;

-- Месячные данные за октябрь 2024
INSERT INTO vehicle_monthly_data (vehicle_id, year, month, income, expenses, trips, efficiency)
SELECT
    v.id,
    2024,
    10,
    FLOOR(RANDOM() * 500000 + 300000)::DECIMAL(15,2),
    FLOOR(RANDOM() * 300000 + 200000)::DECIMAL(15,2),
    FLOOR(RANDOM() * 20 + 15)::INTEGER,
    FLOOR(RANDOM() * 20 + 70)::INTEGER
FROM vehicles v
ON CONFLICT (vehicle_id, year, month) DO NOTHING;
*/

-- ================================================
-- Права доступа (для Supabase)
-- ================================================

-- Включить Row Level Security (если используется Supabase)
ALTER TABLE vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE drivers ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicle_monthly_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE driver_monthly_data ENABLE ROW LEVEL SECURITY;

-- Политики доступа (разрешить всем анонимным пользователям читать данные)
CREATE POLICY "Enable read access for all users" ON vehicles FOR SELECT USING (true);
CREATE POLICY "Enable read access for all users" ON drivers FOR SELECT USING (true);
CREATE POLICY "Enable read access for all users" ON vehicle_monthly_data FOR SELECT USING (true);
CREATE POLICY "Enable read access for all users" ON driver_monthly_data FOR SELECT USING (true);

-- Политики записи (только для аутентифицированных пользователей или сервисных ключей)
-- Раскомментируйте если нужны ограничения:
-- CREATE POLICY "Enable insert for service role only" ON vehicles FOR INSERT WITH CHECK (auth.role() = 'service_role');
-- CREATE POLICY "Enable update for service role only" ON vehicles FOR UPDATE USING (auth.role() = 'service_role');

-- ================================================
-- Готово!
-- ================================================

-- Проверка созданных таблиц
SELECT
    table_name,
    (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = t.table_name) as columns_count
FROM information_schema.tables t
WHERE table_schema = 'public'
    AND table_type = 'BASE TABLE'
    AND table_name IN ('vehicles', 'drivers', 'vehicle_monthly_data', 'driver_monthly_data')
ORDER BY table_name;

-- Вывод структуры таблиц
\d+ vehicles
\d+ drivers
\d+ vehicle_monthly_data
\d+ driver_monthly_data

COMMIT;
