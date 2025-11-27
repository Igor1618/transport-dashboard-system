-- TL196 Database Schema
-- PostgreSQL 14+

-- ============================================
-- ТАБЛИЦА РОЛЕЙ
-- ============================================

CREATE TABLE IF NOT EXISTS roles (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) UNIQUE NOT NULL,
    display_name VARCHAR(100) NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Заполнение ролей
INSERT INTO roles (name, display_name, description) VALUES
    ('director', 'Директор', 'Полный доступ ко всем функциям системы'),
    ('manager', 'Управленец', 'Управление рейсами, зарплатами, машинами'),
    ('economist', 'Экономист', 'Просмотр рейсов и зарплат'),
    ('accountant', 'Бухгалтер', 'Управление финансами и зарплатами'),
    ('mechanic', 'Механик', 'Управление транспортными средствами'),
    ('dispatcher', 'Диспетчер', 'Управление рейсами и загрузкой данных')
ON CONFLICT (name) DO NOTHING;

-- ============================================
-- ТАБЛИЦА ПОЛЬЗОВАТЕЛЕЙ
-- ============================================

CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(200) NOT NULL,
    role_id INTEGER REFERENCES roles(id) ON DELETE SET NULL,
    is_active BOOLEAN DEFAULT TRUE,
    last_login TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Создание индексов
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role_id);

-- Тестовый пользователь (пароль: Director123!)
-- ВАЖНО: В production использовать хэширование паролей!
INSERT INTO users (email, password_hash, full_name, role_id) VALUES
    ('IgorL', 'Director123!', 'Игорь Л.', (SELECT id FROM roles WHERE name = 'director'))
ON CONFLICT (email) DO NOTHING;

-- ============================================
-- ТАБЛИЦА РЕЙСОВ
-- ============================================

CREATE TABLE IF NOT EXISTS trips (
    id SERIAL PRIMARY KEY,
    wb_trip_number VARCHAR(50) UNIQUE NOT NULL,
    loading_date DATE NOT NULL,
    unloading_date DATE,
    vehicle_number VARCHAR(20),
    driver_name VARCHAR(200) NOT NULL,
    route_name VARCHAR(300),
    trip_amount DECIMAL(12,2) DEFAULT 0,
    distance_km INTEGER DEFAULT 0,
    has_penalty BOOLEAN DEFAULT FALSE,
    penalty_amount DECIMAL(12,2) DEFAULT 0,
    containers_count INTEGER DEFAULT 0,
    distribution_center VARCHAR(100),
    import_batch_id INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Создание индексов для оптимизации
CREATE INDEX IF NOT EXISTS idx_trips_wb_number ON trips(wb_trip_number);
CREATE INDEX IF NOT EXISTS idx_trips_loading_date ON trips(loading_date);
CREATE INDEX IF NOT EXISTS idx_trips_driver ON trips(driver_name);
CREATE INDEX IF NOT EXISTS idx_trips_vehicle ON trips(vehicle_number);
CREATE INDEX IF NOT EXISTS idx_trips_import_batch ON trips(import_batch_id);

-- ============================================
-- ТАБЛИЦА ИСТОРИИ ИМПОРТА
-- ============================================

CREATE TABLE IF NOT EXISTS import_log (
    id SERIAL PRIMARY KEY,
    filename VARCHAR(255) NOT NULL,
    imported_at TIMESTAMPTZ DEFAULT NOW(),
    rows_imported INTEGER DEFAULT 0,
    rows_skipped INTEGER DEFAULT 0,
    status VARCHAR(50) DEFAULT 'processing',
    error_message TEXT,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL
);

-- Создание индексов
CREATE INDEX IF NOT EXISTS idx_import_log_date ON import_log(imported_at DESC);
CREATE INDEX IF NOT EXISTS idx_import_log_status ON import_log(status);

-- ============================================
-- ТАБЛИЦА ВОДИТЕЛЕЙ (опционально)
-- ============================================

CREATE TABLE IF NOT EXISTS drivers (
    id SERIAL PRIMARY KEY,
    full_name VARCHAR(200) NOT NULL,
    phone VARCHAR(20),
    license_number VARCHAR(50),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_drivers_name ON drivers(full_name);

-- ============================================
-- ТАБЛИЦА ТРАНСПОРТНЫХ СРЕДСТВ (опционально)
-- ============================================

CREATE TABLE IF NOT EXISTS vehicles (
    id SERIAL PRIMARY KEY,
    vehicle_number VARCHAR(20) UNIQUE NOT NULL,
    model VARCHAR(100),
    year INTEGER,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vehicles_number ON vehicles(vehicle_number);

-- ============================================
-- ПРЕДСТАВЛЕНИЯ (VIEWS)
-- ============================================

-- Представление для статистики по водителям
CREATE OR REPLACE VIEW driver_statistics AS
SELECT
    driver_name,
    COUNT(*) as total_trips,
    SUM(trip_amount) as total_revenue,
    SUM(distance_km) as total_distance,
    SUM(penalty_amount) as total_penalties,
    SUM(trip_amount) - SUM(penalty_amount) as net_salary,
    AVG(trip_amount) as avg_trip_amount,
    MAX(loading_date) as last_trip_date
FROM trips
GROUP BY driver_name;

-- Представление для статистики по машинам
CREATE OR REPLACE VIEW vehicle_statistics AS
SELECT
    vehicle_number,
    COUNT(*) as total_trips,
    SUM(trip_amount) as total_revenue,
    SUM(distance_km) as total_distance,
    AVG(trip_amount) as avg_trip_amount
FROM trips
WHERE vehicle_number IS NOT NULL
GROUP BY vehicle_number;

-- ============================================
-- ФУНКЦИИ
-- ============================================

-- Функция для обновления updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Триггеры для автоматического обновления updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_trips_updated_at BEFORE UPDATE ON trips
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- КОММЕНТАРИИ К ТАБЛИЦАМ
-- ============================================

COMMENT ON TABLE roles IS 'Роли пользователей системы';
COMMENT ON TABLE users IS 'Пользователи системы';
COMMENT ON TABLE trips IS 'Рейсы транспортных средств';
COMMENT ON TABLE import_log IS 'История импорта файлов';
COMMENT ON TABLE drivers IS 'Водители компании';
COMMENT ON TABLE vehicles IS 'Транспортные средства';

-- ============================================
-- ТЕСТОВЫЕ ДАННЫЕ (опционально)
-- ============================================

-- Раскомментировать для добавления тестовых данных

/*
INSERT INTO drivers (full_name, phone, license_number) VALUES
    ('Иванов Иван Иванович', '+79001234567', '77АА123456'),
    ('Петров Петр Петрович', '+79007654321', '77ВВ654321'),
    ('Сидоров Сергей Сергеевич', '+79009876543', '77СС987654')
ON CONFLICT DO NOTHING;

INSERT INTO vehicles (vehicle_number, model, year) VALUES
    ('А123ВС777', 'MAN TGX', 2020),
    ('В456ГД777', 'Mercedes Actros', 2021),
    ('К789ЕЖ777', 'Scania R500', 2019)
ON CONFLICT (vehicle_number) DO NOTHING;
*/

-- ============================================
-- ЗАВЕРШЕНИЕ
-- ============================================

-- Проверка созданных таблиц
SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;

ANALYZE;
