-- ============================================
-- Migration: 1C REST API Integration
-- Description: Справочники и транзакционные данные из 1C
-- Date: 2025-12-09
-- ============================================

-- ============================================
-- 1. СПРАВОЧНИК: МАШИНЫ (Vehicles)
-- ============================================
CREATE TABLE IF NOT EXISTS vehicles (
    -- Natural key из 1C (например "018")
    id VARCHAR(50) PRIMARY KEY,

    -- Данные из 1C API
    license_plate VARCHAR(20) NOT NULL,
    model VARCHAR(100),

    -- Метаданные синхронизации
    synced_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Индексы для поиска
CREATE INDEX IF NOT EXISTS idx_vehicles_license_plate ON vehicles(license_plate);
CREATE INDEX IF NOT EXISTS idx_vehicles_synced_at ON vehicles(synced_at);

-- Комментарии
COMMENT ON TABLE vehicles IS 'Справочник транспортных средств из 1C (166 записей)';
COMMENT ON COLUMN vehicles.id IS 'ID из 1C (текстовый, например "018")';
COMMENT ON COLUMN vehicles.synced_at IS 'Время последней синхронизации с 1C';


-- ============================================
-- 2. СПРАВОЧНИК: ВОДИТЕЛИ (Drivers)
-- ============================================
CREATE TABLE IF NOT EXISTS drivers (
    -- Natural key из 1C (ФИО как текст)
    id VARCHAR(255) PRIMARY KEY,

    -- Данные из 1C API
    full_name VARCHAR(255) NOT NULL,

    -- Метаданные синхронизации
    synced_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Индексы для поиска
CREATE INDEX IF NOT EXISTS idx_drivers_full_name ON drivers(full_name);
CREATE INDEX IF NOT EXISTS idx_drivers_synced_at ON drivers(synced_at);

-- Комментарии
COMMENT ON TABLE drivers IS 'Справочник водителей из 1C (65 записей)';
COMMENT ON COLUMN drivers.id IS 'ID из 1C (ФИО водителя)';


-- ============================================
-- 3. ТРАНЗАКЦИОННАЯ: ДОГОВОРЫ (Contracts)
-- ============================================
CREATE TABLE IF NOT EXISTS contracts (
    -- Суррогатный ключ для PostgreSQL
    uuid UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Данные договора
    number VARCHAR(100) NOT NULL,
    date DATE NOT NULL,
    organization VARCHAR(255),

    -- Контрагент
    contractor_id VARCHAR(255),
    contractor_name VARCHAR(255),

    -- Связь с машиной
    vehicle_id VARCHAR(50),
    vehicle_number VARCHAR(20),

    -- Связь с водителем
    driver_id VARCHAR(255),
    driver_name VARCHAR(255),

    -- Логистика
    responsible_logist VARCHAR(255),
    route TEXT,

    -- Финансы
    payment_term VARCHAR(100),
    payment_condition VARCHAR(100),
    amount DECIMAL(15, 2),

    -- Метаданные синхронизации
    synced_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Foreign keys
    FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE SET NULL,
    FOREIGN KEY (driver_id) REFERENCES drivers(id) ON DELETE SET NULL,

    -- Уникальность по номеру и дате
    UNIQUE(number, date)
);

-- Индексы для производительности
CREATE INDEX IF NOT EXISTS idx_contracts_date ON contracts(date DESC);
CREATE INDEX IF NOT EXISTS idx_contracts_vehicle_id ON contracts(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_contracts_driver_id ON contracts(driver_id);
CREATE INDEX IF NOT EXISTS idx_contracts_contractor_id ON contracts(contractor_id);
CREATE INDEX IF NOT EXISTS idx_contracts_number ON contracts(number);
CREATE INDEX IF NOT EXISTS idx_contracts_synced_at ON contracts(synced_at);

-- Комментарии
COMMENT ON TABLE contracts IS 'Договоры/контракты из 1C (инкрементальная загрузка за 30 дней)';
COMMENT ON COLUMN contracts.amount IS 'Сумма договора в рублях';


-- ============================================
-- 4. ТРАНЗАКЦИОННАЯ: ОТЧЕТЫ ВОДИТЕЛЕЙ (Driver Reports)
-- ============================================
CREATE TABLE IF NOT EXISTS driver_reports (
    -- Natural key из 1C
    id VARCHAR(100) PRIMARY KEY,

    -- Данные отчета
    number VARCHAR(100),
    date_from DATE NOT NULL,
    date_to DATE NOT NULL,

    -- Связь с водителем
    driver_id VARCHAR(255),
    driver_name VARCHAR(255),

    -- Связь с машиной
    vehicle_id VARCHAR(50),
    vehicle_number VARCHAR(20),

    -- Топливо
    fuel_start DECIMAL(10, 2),
    fuel_end DECIMAL(10, 2),
    fuel_quantity DECIMAL(10, 2),
    fuel_amount DECIMAL(15, 2),

    -- Пробег
    mileage INTEGER,

    -- Финансы
    total_expenses DECIMAL(15, 2),
    driver_accruals DECIMAL(15, 2),
    driver_payments DECIMAL(15, 2),

    -- Метаданные синхронизации
    synced_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Foreign keys
    FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE SET NULL,
    FOREIGN KEY (driver_id) REFERENCES drivers(id) ON DELETE SET NULL
);

-- Индексы для производительности
CREATE INDEX IF NOT EXISTS idx_driver_reports_date_from ON driver_reports(date_from DESC);
CREATE INDEX IF NOT EXISTS idx_driver_reports_date_to ON driver_reports(date_to DESC);
CREATE INDEX IF NOT EXISTS idx_driver_reports_driver_id ON driver_reports(driver_id);
CREATE INDEX IF NOT EXISTS idx_driver_reports_vehicle_id ON driver_reports(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_driver_reports_number ON driver_reports(number);
CREATE INDEX IF NOT EXISTS idx_driver_reports_synced_at ON driver_reports(synced_at);

-- Комментарии
COMMENT ON TABLE driver_reports IS 'Отчеты водителей из 1C (лимит 1000 записей, инкрементальная загрузка за 30 дней)';
COMMENT ON COLUMN driver_reports.fuel_start IS 'Остаток топлива на начало периода (л)';
COMMENT ON COLUMN driver_reports.fuel_end IS 'Остаток топлива на конец периода (л)';
COMMENT ON COLUMN driver_reports.fuel_quantity IS 'Количество залитого топлива (л)';
COMMENT ON COLUMN driver_reports.fuel_amount IS 'Стоимость топлива (руб)';
COMMENT ON COLUMN driver_reports.mileage IS 'Пробег за период (км)';
COMMENT ON COLUMN driver_reports.total_expenses IS 'Общая сумма расходов (руб)';


-- ============================================
-- 5. СВЯЗАННАЯ: КАТЕГОРИИ РАСХОДОВ (Expense Categories)
-- ============================================
CREATE TABLE IF NOT EXISTS expense_categories (
    -- Суррогатный ключ
    uuid UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Связь с отчетом водителя
    driver_report_id VARCHAR(100) NOT NULL,

    -- Данные категории
    category VARCHAR(255) NOT NULL,
    amount DECIMAL(15, 2) NOT NULL,

    -- Метаданные
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Foreign key
    FOREIGN KEY (driver_report_id) REFERENCES driver_reports(id) ON DELETE CASCADE
);

-- Индексы
CREATE INDEX IF NOT EXISTS idx_expense_categories_report_id ON expense_categories(driver_report_id);
CREATE INDEX IF NOT EXISTS idx_expense_categories_category ON expense_categories(category);

-- Комментарии
COMMENT ON TABLE expense_categories IS 'Категории расходов по отчетам водителей (многие-к-одному с driver_reports)';
COMMENT ON COLUMN expense_categories.driver_report_id IS 'ID отчета водителя из таблицы driver_reports';


-- ============================================
-- 6. ТРИГГЕРЫ: AUTO-UPDATE TIMESTAMPS
-- ============================================

-- Функция для обновления updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Триггеры для всех таблиц с updated_at
CREATE TRIGGER update_vehicles_updated_at
    BEFORE UPDATE ON vehicles
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_drivers_updated_at
    BEFORE UPDATE ON drivers
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_contracts_updated_at
    BEFORE UPDATE ON contracts
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_driver_reports_updated_at
    BEFORE UPDATE ON driver_reports
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();


-- ============================================
-- 7. ПРАВА ДОСТУПА (опционально)
-- ============================================

-- Если используется отдельный пользователь для n8n
-- CREATE USER n8n_sync WITH PASSWORD 'secure_password';
-- GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO n8n_sync;
-- GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO n8n_sync;


-- ============================================
-- ЗАВЕРШЕНИЕ МИГРАЦИИ
-- ============================================

-- Успешное завершение
DO $$
BEGIN
    RAISE NOTICE '✅ Migration completed successfully!';
    RAISE NOTICE '📊 Created tables: vehicles, drivers, contracts, driver_reports, expense_categories';
    RAISE NOTICE '🔗 Created foreign keys and indexes';
    RAISE NOTICE '⚡ Created auto-update triggers';
END $$;
