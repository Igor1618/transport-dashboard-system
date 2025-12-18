<?php
/**
 * RF Transport API - данные из 1C (contracts, driver_reports)
 * Подключается к PostgreSQL (Supabase) на порту 5433
 */

// CORS Headers
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit(0);
}

// Database connection
$dbHost = 'localhost';
$dbPort = '5433';
$dbName = 'postgres';
$dbUser = 'postgres';
$dbPass = '5+NMkUPabjFbh5vGZtWx5ea0QAX2NSR3G1k0sfAedms=';

try {
    $dsn = "pgsql:host=$dbHost;port=$dbPort;dbname=$dbName";
    $pdo = new PDO($dsn, $dbUser, $dbPass, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC
    ]);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['error' => 'Database connection failed', 'details' => $e->getMessage()]);
    exit;
}

// Get parameters
$action = $_GET['action'] ?? 'stats';
$month = $_GET['month'] ?? date('Y-m');
$limit = min((int)($_GET['limit'] ?? 100), 1000);
$offset = (int)($_GET['offset'] ?? 0);

// Validate month format
if (!preg_match('/^\d{4}-(0[1-9]|1[0-2])$/', $month)) {
    $month = date('Y-m');
}

$startDate = $month . '-01';
$endDate = date('Y-m-t', strtotime($startDate));

try {
    switch ($action) {
        case 'stats':
            // Get summary statistics
            $stats = [];

            // Contracts stats
            $stmt = $pdo->prepare("
                SELECT
                    COUNT(*) as total_contracts,
                    COUNT(DISTINCT vehicle_number) as unique_vehicles,
                    COUNT(DISTINCT contractor_name) as unique_contractors,
                    COALESCE(SUM(CASE WHEN total_sum > 0 THEN total_sum ELSE 0 END), 0) as total_sum
                FROM contracts
                WHERE (contract_date >= :start_date AND contract_date <= :end_date)
                   OR (contract_date IS NULL)
            ");
            $stmt->execute(['start_date' => $startDate, 'end_date' => $endDate]);
            $contractStats = $stmt->fetch();

            // Driver reports stats
            $stmt = $pdo->prepare("
                SELECT
                    COUNT(*) as total_reports,
                    COUNT(DISTINCT vehicle_number) as unique_vehicles,
                    COUNT(DISTINCT driver_name) as unique_drivers,
                    COALESCE(SUM(kilometers), 0) as total_km,
                    COALESCE(SUM(salary_amount), 0) as total_salary
                FROM driver_reports
                WHERE (report_date >= :start_date AND report_date <= :end_date)
                   OR (report_date IS NULL)
            ");
            $stmt->execute(['start_date' => $startDate, 'end_date' => $endDate]);
            $reportStats = $stmt->fetch();

            echo json_encode([
                'ok' => true,
                'month' => $month,
                'contracts' => [
                    'total' => (int)$contractStats['total_contracts'],
                    'vehicles' => (int)$contractStats['unique_vehicles'],
                    'contractors' => (int)$contractStats['unique_contractors'],
                    'sum' => (float)$contractStats['total_sum']
                ],
                'driver_reports' => [
                    'total' => (int)$reportStats['total_reports'],
                    'vehicles' => (int)$reportStats['unique_vehicles'],
                    'drivers' => (int)$reportStats['unique_drivers'],
                    'total_km' => (float)$reportStats['total_km'],
                    'total_salary' => (float)$reportStats['total_salary']
                ]
            ]);
            break;

        case 'contracts':
            // Get contracts list
            $stmt = $pdo->prepare("
                SELECT
                    id, contract_number, contract_date, contractor_name,
                    vehicle_number, route_name, cargo_type,
                    total_sum, status, created_at
                FROM contracts
                WHERE (contract_date >= :start_date AND contract_date <= :end_date)
                   OR (contract_date IS NULL)
                ORDER BY contract_date DESC NULLS LAST, created_at DESC
                LIMIT :limit OFFSET :offset
            ");
            $stmt->bindValue('start_date', $startDate);
            $stmt->bindValue('end_date', $endDate);
            $stmt->bindValue('limit', $limit, PDO::PARAM_INT);
            $stmt->bindValue('offset', $offset, PDO::PARAM_INT);
            $stmt->execute();
            $contracts = $stmt->fetchAll();

            // Get total count
            $stmt = $pdo->prepare("
                SELECT COUNT(*) as total FROM contracts
                WHERE (contract_date >= :start_date AND contract_date <= :end_date)
                   OR (contract_date IS NULL)
            ");
            $stmt->execute(['start_date' => $startDate, 'end_date' => $endDate]);
            $total = $stmt->fetch()['total'];

            echo json_encode([
                'ok' => true,
                'month' => $month,
                'total' => (int)$total,
                'limit' => $limit,
                'offset' => $offset,
                'data' => $contracts
            ]);
            break;

        case 'driver_reports':
            // Get driver reports list
            $stmt = $pdo->prepare("
                SELECT
                    id, report_number, report_date, driver_name,
                    vehicle_number, route_name, kilometers,
                    fuel_consumed, salary_amount, status, created_at
                FROM driver_reports
                WHERE (report_date >= :start_date AND report_date <= :end_date)
                   OR (report_date IS NULL)
                ORDER BY report_date DESC NULLS LAST, created_at DESC
                LIMIT :limit OFFSET :offset
            ");
            $stmt->bindValue('start_date', $startDate);
            $stmt->bindValue('end_date', $endDate);
            $stmt->bindValue('limit', $limit, PDO::PARAM_INT);
            $stmt->bindValue('offset', $offset, PDO::PARAM_INT);
            $stmt->execute();
            $reports = $stmt->fetchAll();

            // Get total count
            $stmt = $pdo->prepare("
                SELECT COUNT(*) as total FROM driver_reports
                WHERE (report_date >= :start_date AND report_date <= :end_date)
                   OR (report_date IS NULL)
            ");
            $stmt->execute(['start_date' => $startDate, 'end_date' => $endDate]);
            $total = $stmt->fetch()['total'];

            echo json_encode([
                'ok' => true,
                'month' => $month,
                'total' => (int)$total,
                'limit' => $limit,
                'offset' => $offset,
                'data' => $reports
            ]);
            break;

        case 'vehicles':
            // Get vehicles summary from 1C data
            $stmt = $pdo->prepare("
                SELECT
                    vehicle_number,
                    COUNT(DISTINCT id) as trip_count,
                    COALESCE(SUM(total_sum), 0) as total_revenue
                FROM contracts
                WHERE vehicle_number IS NOT NULL
                  AND ((contract_date >= :start_date AND contract_date <= :end_date)
                       OR contract_date IS NULL)
                GROUP BY vehicle_number
                ORDER BY total_revenue DESC
                LIMIT :limit
            ");
            $stmt->bindValue('start_date', $startDate);
            $stmt->bindValue('end_date', $endDate);
            $stmt->bindValue('limit', $limit, PDO::PARAM_INT);
            $stmt->execute();
            $vehicles = $stmt->fetchAll();

            echo json_encode([
                'ok' => true,
                'month' => $month,
                'data' => $vehicles
            ]);
            break;

        case 'drivers':
            // Get drivers summary from 1C data
            $stmt = $pdo->prepare("
                SELECT
                    driver_name,
                    COUNT(DISTINCT id) as report_count,
                    COALESCE(SUM(kilometers), 0) as total_km,
                    COALESCE(SUM(salary_amount), 0) as total_salary
                FROM driver_reports
                WHERE driver_name IS NOT NULL
                  AND ((report_date >= :start_date AND report_date <= :end_date)
                       OR report_date IS NULL)
                GROUP BY driver_name
                ORDER BY total_salary DESC
                LIMIT :limit
            ");
            $stmt->bindValue('start_date', $startDate);
            $stmt->bindValue('end_date', $endDate);
            $stmt->bindValue('limit', $limit, PDO::PARAM_INT);
            $stmt->execute();
            $drivers = $stmt->fetchAll();

            echo json_encode([
                'ok' => true,
                'month' => $month,
                'data' => $drivers
            ]);
            break;

        default:
            http_response_code(400);
            echo json_encode([
                'ok' => false,
                'error' => 'Unknown action',
                'available' => ['stats', 'contracts', 'driver_reports', 'vehicles', 'drivers']
            ]);
    }
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode([
        'ok' => false,
        'error' => 'Query failed',
        'details' => $e->getMessage()
    ]);
}
