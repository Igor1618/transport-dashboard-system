-- ============================================
-- Analytics Views для 1C Integration
-- Description: SQL представления для аналитики и отчетности
-- Date: 2025-12-09
-- ============================================


-- ============================================
-- 1. РАСХОДЫ ПО ВОДИТЕЛЯМ (Driver Expenses Analytics)
-- ============================================
CREATE OR REPLACE VIEW v_driver_expenses AS
SELECT
    dr.driver_id,
    dr.driver_name,
    COUNT(DISTINCT dr.id) AS total_reports,

    -- Периоды
    MIN(dr.date_from) AS first_report_date,
    MAX(dr.date_to) AS last_report_date,

    -- Топливо
    SUM(dr.fuel_quantity) AS total_fuel_liters,
    SUM(dr.fuel_amount) AS total_fuel_cost,
    AVG(dr.fuel_amount / NULLIF(dr.fuel_quantity, 0)) AS avg_fuel_price_per_liter,

    -- Пробег
    SUM(dr.mileage) AS total_mileage_km,
    AVG(dr.mileage) AS avg_mileage_per_report,

    -- Расход топлива
    ROUND(
        SUM(dr.fuel_quantity) / NULLIF(SUM(dr.mileage), 0) * 100,
        2
    ) AS avg_fuel_consumption_per_100km,

    -- Финансы
    SUM(dr.total_expenses) AS total_expenses,
    SUM(dr.driver_accruals) AS total_accruals,
    SUM(dr.driver_payments) AS total_payments,

    -- Расчетные показатели
    SUM(dr.driver_accruals) - SUM(dr.driver_payments) AS balance,

    -- Машины
    COUNT(DISTINCT dr.vehicle_id) AS vehicles_used

FROM driver_reports dr
GROUP BY dr.driver_id, dr.driver_name
ORDER BY total_expenses DESC;

COMMENT ON VIEW v_driver_expenses IS 'Аналитика расходов и показателей по водителям';


-- ============================================
-- 2. ТОПЛИВО ПО МАШИНАМ (Fuel Analytics by Vehicles)
-- ============================================
CREATE OR REPLACE VIEW v_vehicle_fuel_analytics AS
SELECT
    v.id AS vehicle_id,
    v.license_plate,
    v.model,

    -- Количество отчетов
    COUNT(DISTINCT dr.id) AS total_reports,

    -- Периоды
    MIN(dr.date_from) AS first_report_date,
    MAX(dr.date_to) AS last_report_date,

    -- Топливо
    SUM(dr.fuel_quantity) AS total_fuel_liters,
    SUM(dr.fuel_amount) AS total_fuel_cost,
    AVG(dr.fuel_amount / NULLIF(dr.fuel_quantity, 0)) AS avg_fuel_price_per_liter,

    -- Пробег
    SUM(dr.mileage) AS total_mileage_km,
    AVG(dr.mileage) AS avg_mileage_per_report,

    -- Расход топлива на 100 км
    ROUND(
        SUM(dr.fuel_quantity) / NULLIF(SUM(dr.mileage), 0) * 100,
        2
    ) AS avg_fuel_consumption_per_100km,

    -- Стоимость
    ROUND(
        SUM(dr.fuel_amount) / NULLIF(SUM(dr.mileage), 0),
        2
    ) AS fuel_cost_per_km,

    -- Водители
    COUNT(DISTINCT dr.driver_id) AS drivers_count,
    STRING_AGG(DISTINCT dr.driver_name, ', ' ORDER BY dr.driver_name) AS drivers_list

FROM vehicles v
LEFT JOIN driver_reports dr ON v.id = dr.vehicle_id
GROUP BY v.id, v.license_plate, v.model
ORDER BY total_fuel_cost DESC NULLS LAST;

COMMENT ON VIEW v_vehicle_fuel_analytics IS 'Аналитика топлива и эксплуатации по машинам';


-- ============================================
-- 3. СУММЫ ПО МАРШРУТАМ (Amounts by Routes)
-- ============================================
CREATE OR REPLACE VIEW v_route_analytics AS
SELECT
    c.route,

    -- Количество
    COUNT(*) AS total_contracts,
    COUNT(DISTINCT c.vehicle_id) AS vehicles_count,
    COUNT(DISTINCT c.driver_id) AS drivers_count,
    COUNT(DISTINCT c.contractor_id) AS contractors_count,

    -- Финансы
    SUM(c.amount) AS total_amount,
    AVG(c.amount) AS avg_amount,
    MIN(c.amount) AS min_amount,
    MAX(c.amount) AS max_amount,

    -- Периоды
    MIN(c.date) AS first_contract_date,
    MAX(c.date) AS last_contract_date,

    -- Контрагенты
    STRING_AGG(DISTINCT c.contractor_name, ', ') AS contractors_list,

    -- Топ водитель
    (
        SELECT driver_name
        FROM contracts c2
        WHERE c2.route = c.route
        GROUP BY driver_name
        ORDER BY COUNT(*) DESC
        LIMIT 1
    ) AS top_driver,

    -- Топ машина
    (
        SELECT vehicle_number
        FROM contracts c2
        WHERE c2.route = c.route
        GROUP BY vehicle_number
        ORDER BY COUNT(*) DESC
        LIMIT 1
    ) AS top_vehicle

FROM contracts c
WHERE c.route IS NOT NULL AND c.route != ''
GROUP BY c.route
ORDER BY total_amount DESC;

COMMENT ON VIEW v_route_analytics IS 'Аналитика по маршрутам и направлениям';


-- ============================================
-- 4. КАТЕГОРИИ РАСХОДОВ (Expense Categories Summary)
-- ============================================
CREATE OR REPLACE VIEW v_expense_categories_summary AS
SELECT
    ec.category,

    -- Количество
    COUNT(*) AS occurrences,
    COUNT(DISTINCT ec.driver_report_id) AS reports_count,

    -- Суммы
    SUM(ec.amount) AS total_amount,
    AVG(ec.amount) AS avg_amount,
    MIN(ec.amount) AS min_amount,
    MAX(ec.amount) AS max_amount,

    -- Доля от общих расходов
    ROUND(
        SUM(ec.amount) * 100.0 / NULLIF(
            (SELECT SUM(amount) FROM expense_categories),
            0
        ),
        2
    ) AS percentage_of_total

FROM expense_categories ec
GROUP BY ec.category
ORDER BY total_amount DESC;

COMMENT ON VIEW v_expense_categories_summary IS 'Сводка по категориям расходов';


-- ============================================
-- 5. ПРОИЗВОДИТЕЛЬНОСТЬ ВОДИТЕЛЕЙ (Driver Performance)
-- ============================================
CREATE OR REPLACE VIEW v_driver_performance AS
SELECT
    d.id AS driver_id,
    d.full_name AS driver_name,

    -- Отчеты
    COUNT(DISTINCT dr.id) AS reports_count,

    -- Контракты
    COUNT(DISTINCT c.uuid) AS contracts_count,
    SUM(c.amount) AS total_contracts_amount,
    AVG(c.amount) AS avg_contract_amount,

    -- Пробег и топливо
    SUM(dr.mileage) AS total_mileage,
    SUM(dr.fuel_quantity) AS total_fuel,
    SUM(dr.fuel_amount) AS total_fuel_cost,

    -- Эффективность
    ROUND(
        SUM(c.amount) / NULLIF(SUM(dr.mileage), 0),
        2
    ) AS revenue_per_km,

    ROUND(
        SUM(dr.fuel_quantity) / NULLIF(SUM(dr.mileage), 0) * 100,
        2
    ) AS fuel_consumption_per_100km,

    -- Финансы
    SUM(dr.total_expenses) AS total_expenses,
    SUM(dr.driver_accruals) AS total_accruals,
    SUM(dr.driver_payments) AS total_payments,
    SUM(dr.driver_accruals) - SUM(dr.driver_payments) AS balance,

    -- Периоды
    MIN(LEAST(c.date, dr.date_from)) AS first_activity_date,
    MAX(GREATEST(c.date, dr.date_to)) AS last_activity_date,

    -- Машины
    COUNT(DISTINCT COALESCE(dr.vehicle_id, c.vehicle_id)) AS vehicles_used

FROM drivers d
LEFT JOIN driver_reports dr ON d.id = dr.driver_id
LEFT JOIN contracts c ON d.id = c.driver_id
GROUP BY d.id, d.full_name
HAVING COUNT(DISTINCT dr.id) > 0 OR COUNT(DISTINCT c.uuid) > 0
ORDER BY total_contracts_amount DESC NULLS LAST;

COMMENT ON VIEW v_driver_performance IS 'Комплексная оценка производительности водителей';


-- ============================================
-- 6. ЭКСПЛУАТАЦИЯ МАШИН (Vehicle Utilization)
-- ============================================
CREATE OR REPLACE VIEW v_vehicle_utilization AS
SELECT
    v.id AS vehicle_id,
    v.license_plate,
    v.model,

    -- Отчеты
    COUNT(DISTINCT dr.id) AS reports_count,

    -- Контракты
    COUNT(DISTINCT c.uuid) AS contracts_count,
    SUM(c.amount) AS total_contracts_amount,

    -- Пробег
    SUM(dr.mileage) AS total_mileage,
    AVG(dr.mileage) AS avg_mileage_per_report,

    -- Топливо
    SUM(dr.fuel_quantity) AS total_fuel_liters,
    SUM(dr.fuel_amount) AS total_fuel_cost,
    ROUND(
        SUM(dr.fuel_quantity) / NULLIF(SUM(dr.mileage), 0) * 100,
        2
    ) AS fuel_consumption_per_100km,

    -- Расходы
    SUM(dr.total_expenses) AS total_expenses,

    -- Доходность
    ROUND(
        SUM(c.amount) / NULLIF(SUM(dr.mileage), 0),
        2
    ) AS revenue_per_km,

    ROUND(
        (SUM(c.amount) - SUM(dr.total_expenses)) / NULLIF(SUM(c.amount), 0) * 100,
        2
    ) AS profit_margin_percent,

    -- Водители
    COUNT(DISTINCT dr.driver_id) AS drivers_count,

    -- Периоды
    MIN(LEAST(COALESCE(c.date, dr.date_from), dr.date_from)) AS first_activity_date,
    MAX(GREATEST(COALESCE(c.date, dr.date_to), dr.date_to)) AS last_activity_date,

    -- Загрузка (дни активности)
    COUNT(DISTINCT dr.date_from::date) AS active_days

FROM vehicles v
LEFT JOIN driver_reports dr ON v.id = dr.vehicle_id
LEFT JOIN contracts c ON v.id = c.vehicle_id
GROUP BY v.id, v.license_plate, v.model
HAVING COUNT(DISTINCT dr.id) > 0 OR COUNT(DISTINCT c.uuid) > 0
ORDER BY total_contracts_amount DESC NULLS LAST;

COMMENT ON VIEW v_vehicle_utilization IS 'Анализ использования и доходности транспортных средств';


-- ============================================
-- 7. ЕЖЕМЕСЯЧНАЯ СТАТИСТИКА (Monthly Statistics)
-- ============================================
CREATE OR REPLACE VIEW v_monthly_statistics AS
SELECT
    TO_CHAR(period, 'YYYY-MM') AS month,
    period,

    -- Контракты
    COUNT(DISTINCT c.uuid) AS contracts_count,
    SUM(c.amount) AS contracts_total_amount,
    AVG(c.amount) AS contracts_avg_amount,

    -- Отчеты
    COUNT(DISTINCT dr.id) AS reports_count,

    -- Пробег
    SUM(dr.mileage) AS total_mileage,

    -- Топливо
    SUM(dr.fuel_quantity) AS total_fuel_liters,
    SUM(dr.fuel_amount) AS total_fuel_cost,

    -- Расходы
    SUM(dr.total_expenses) AS total_expenses,

    -- Начисления и выплаты
    SUM(dr.driver_accruals) AS total_accruals,
    SUM(dr.driver_payments) AS total_payments,

    -- Активные объекты
    COUNT(DISTINCT dr.driver_id) AS active_drivers,
    COUNT(DISTINCT dr.vehicle_id) AS active_vehicles

FROM (
    SELECT DATE_TRUNC('month', date) AS period, uuid, amount, null::varchar AS driver_id, null::varchar AS vehicle_id
    FROM contracts
    UNION ALL
    SELECT DATE_TRUNC('month', date_from) AS period, null::uuid, null::decimal, driver_id, vehicle_id
    FROM driver_reports
) AS all_data
LEFT JOIN contracts c ON c.date >= all_data.period AND c.date < all_data.period + INTERVAL '1 month'
LEFT JOIN driver_reports dr ON dr.date_from >= all_data.period AND dr.date_from < all_data.period + INTERVAL '1 month'
GROUP BY period
ORDER BY period DESC;

COMMENT ON VIEW v_monthly_statistics IS 'Ежемесячная статистика по всем показателям';


-- ============================================
-- 8. ТОП ПОКАЗАТЕЛИ (Top Performers Dashboard)
-- ============================================
CREATE OR REPLACE VIEW v_top_performers AS
SELECT
    'driver' AS entity_type,
    driver_name AS entity_name,
    total_contracts_amount AS metric_value,
    'total_revenue' AS metric_type
FROM v_driver_performance
ORDER BY total_contracts_amount DESC
LIMIT 10

UNION ALL

SELECT
    'vehicle' AS entity_type,
    license_plate AS entity_name,
    total_contracts_amount AS metric_value,
    'total_revenue' AS metric_type
FROM v_vehicle_utilization
ORDER BY total_contracts_amount DESC
LIMIT 10

UNION ALL

SELECT
    'route' AS entity_type,
    route AS entity_name,
    total_amount AS metric_value,
    'total_revenue' AS metric_type
FROM v_route_analytics
ORDER BY total_amount DESC
LIMIT 10;

COMMENT ON VIEW v_top_performers IS 'Топ-10 по различным показателям для дашборда';


-- ============================================
-- ЗАВЕРШЕНИЕ
-- ============================================

DO $$
BEGIN
    RAISE NOTICE '✅ Analytics views created successfully!';
    RAISE NOTICE '📊 Views created: 8 analytical views';
    RAISE NOTICE '🎯 Use these for dashboards and reports';
END $$;
