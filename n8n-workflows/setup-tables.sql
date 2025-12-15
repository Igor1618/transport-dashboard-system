-- Setup Tables for Transport Dashboard System
-- Run this script on PostgreSQL to create required tables

-- Vehicles table
CREATE TABLE IF NOT EXISTS vehicles (
    id VARCHAR(255) PRIMARY KEY,
    license_plate VARCHAR(50),
    model VARCHAR(255),
    created_at TIMESTAMP DEFAULT NOW(),
    synced_at TIMESTAMP DEFAULT NOW()
);

-- Drivers table
CREATE TABLE IF NOT EXISTS drivers (
    id VARCHAR(255) PRIMARY KEY,
    full_name VARCHAR(255),
    created_at TIMESTAMP DEFAULT NOW(),
    synced_at TIMESTAMP DEFAULT NOW()
);

-- Contracts table
CREATE TABLE IF NOT EXISTS contracts (
    number VARCHAR(100) NOT NULL,
    date DATE NOT NULL,
    organization VARCHAR(255),
    contractor_id VARCHAR(255),
    contractor_name VARCHAR(255),
    vehicle_id VARCHAR(255),
    vehicle_number VARCHAR(50),
    driver_id VARCHAR(255),
    driver_name VARCHAR(255),
    responsible_logist VARCHAR(255),
    route TEXT,
    payment_term VARCHAR(100),
    payment_condition VARCHAR(100),
    amount DECIMAL(15, 2) DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    synced_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    PRIMARY KEY (number, date)
);

-- Driver Reports table
CREATE TABLE IF NOT EXISTS driver_reports (
    id VARCHAR(255) PRIMARY KEY,
    number VARCHAR(100),
    date_from TIMESTAMP,
    date_to TIMESTAMP,
    driver_id VARCHAR(255),
    driver_name VARCHAR(255),
    vehicle_id VARCHAR(255),
    vehicle_number VARCHAR(50),
    fuel_start DECIMAL(10, 2) DEFAULT 0,
    fuel_end DECIMAL(10, 2) DEFAULT 0,
    mileage DECIMAL(15, 2) DEFAULT 0,
    fuel_quantity DECIMAL(15, 2) DEFAULT 0,
    fuel_amount DECIMAL(15, 2) DEFAULT 0,
    total_expenses DECIMAL(15, 2) DEFAULT 0,
    driver_accruals DECIMAL(15, 2) DEFAULT 0,
    driver_payments DECIMAL(15, 2) DEFAULT 0,
    expense_categories JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMP DEFAULT NOW(),
    synced_at TIMESTAMP DEFAULT NOW()
);

-- Sync Log table (for tracking sync history)
CREATE TABLE IF NOT EXISTS sync_log (
    id SERIAL PRIMARY KEY,
    sync_type VARCHAR(50),
    vehicles_count INTEGER DEFAULT 0,
    drivers_count INTEGER DEFAULT 0,
    contracts_count INTEGER DEFAULT 0,
    driver_reports_count INTEGER DEFAULT 0,
    synced_at TIMESTAMP DEFAULT NOW(),
    status VARCHAR(50) DEFAULT 'success',
    error_message TEXT
);

-- Indexes for better performance
CREATE INDEX IF NOT EXISTS idx_contracts_date ON contracts(date);
CREATE INDEX IF NOT EXISTS idx_contracts_driver_id ON contracts(driver_id);
CREATE INDEX IF NOT EXISTS idx_contracts_vehicle_id ON contracts(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_driver_reports_date_from ON driver_reports(date_from);
CREATE INDEX IF NOT EXISTS idx_driver_reports_driver_id ON driver_reports(driver_id);
CREATE INDEX IF NOT EXISTS idx_driver_reports_vehicle_id ON driver_reports(vehicle_id);

-- Grant permissions (if needed)
-- GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO postgres;
-- GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO postgres;

SELECT 'Tables created successfully!' as status;
