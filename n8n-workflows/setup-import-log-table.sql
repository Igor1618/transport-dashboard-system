-- Таблица для логирования результатов синхронизации
-- Выполнить один раз перед запуском workflow

CREATE TABLE IF NOT EXISTS import_log (
    id SERIAL PRIMARY KEY,
    sync_time TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    vehicles_count INTEGER DEFAULT 0,
    drivers_count INTEGER DEFAULT 0,
    contracts_count INTEGER DEFAULT 0,
    driver_reports_count INTEGER DEFAULT 0,
    expense_categories_count INTEGER DEFAULT 0,
    status VARCHAR(20) DEFAULT 'UNKNOWN',
    errors TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Индекс для быстрого поиска по времени
CREATE INDEX IF NOT EXISTS idx_import_log_sync_time ON import_log(sync_time DESC);

-- Комментарий к таблице
COMMENT ON TABLE import_log IS 'Лог синхронизации данных из 1C в PostgreSQL через n8n';
