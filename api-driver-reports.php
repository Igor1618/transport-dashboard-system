<?php
/**
 * Driver Reports API
 * Endpoint: /api-driver-reports.php
 */

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// Database connection
$host = 'localhost';
$port = '5433';
$db = 'postgres';
$user = 'postgres';
$pass = '5+NMkUPabjFbh5vGZtWx5ea0QAX2NSR3G1k0sfAedms=';

try {
    $pdo = new PDO("pgsql:host=$host;port=$port;dbname=$db", $user, $pass);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
} catch (PDOException $e) {
    echo json_encode(['ok' => false, 'error' => 'db_connection_failed']);
    exit;
}

// Parameters
$action = $_GET['action'] ?? 'list';
$month = $_GET['month'] ?? null;
$driver = $_GET['driver'] ?? null;
$vehicle = $_GET['vehicle'] ?? null;
$limit = min(500, max(1, (int)($_GET['limit'] ?? 100)));
$offset = max(0, (int)($_GET['offset'] ?? 0));

switch ($action) {
    case 'list':
        listReports($pdo, $month, $driver, $vehicle, $limit, $offset);
        break;
    case 'stats':
        getStats($pdo, $month);
        break;
    case 'drivers':
        getDriversList($pdo);
        break;
    case 'vehicles':
        getVehiclesList($pdo);
        break;
    case 'categories':
        getCategories($pdo);
        break;
    default:
        echo json_encode(['ok' => false, 'error' => 'unknown_action']);
}

function listReports($pdo, $month, $driver, $vehicle, $limit, $offset) {
    $where = [];
    $params = [];
    
    if ($month) {
        $where[] = "TO_CHAR(date_to, 'YYYY-MM') = :month";
        $params[':month'] = $month;
    }
    if ($driver) {
        $where[] = "driver_name ILIKE :driver";
        $params[':driver'] = '%' . $driver . '%';
    }
    if ($vehicle) {
        $where[] = "vehicle_number ILIKE :vehicle";
        $params[':vehicle'] = '%' . $vehicle . '%';
    }
    
    $whereClause = $where ? 'WHERE ' . implode(' AND ', $where) : '';
    
    // Count total
    $countSql = "SELECT COUNT(*) FROM driver_reports $whereClause";
    $stmt = $pdo->prepare($countSql);
    $stmt->execute($params);
    $total = (int)$stmt->fetchColumn();
    
    // Get data
    $sql = "SELECT 
        id, number, date_from, date_to, 
        driver_id, driver_name, 
        vehicle_id, vehicle_number,
        fuel_quantity, fuel_amount,
        mileage, total_expenses,
        driver_accruals, driver_payments,
        expense_categories
    FROM driver_reports 
    $whereClause
    ORDER BY date_to DESC, number DESC
    LIMIT :limit OFFSET :offset";
    
    $stmt = $pdo->prepare($sql);
    foreach ($params as $key => $val) {
        $stmt->bindValue($key, $val);
    }
    $stmt->bindValue(':limit', $limit, PDO::PARAM_INT);
    $stmt->bindValue(':offset', $offset, PDO::PARAM_INT);
    $stmt->execute();
    
    $reports = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    // Parse JSONB
    foreach ($reports as &$r) {
        $r['expense_categories'] = $r['expense_categories'] ? json_decode($r['expense_categories'], true) : [];
        $r['fuel_quantity'] = (float)$r['fuel_quantity'];
        $r['fuel_amount'] = (float)$r['fuel_amount'];
        $r['mileage'] = (int)$r['mileage'];
        $r['total_expenses'] = (float)$r['total_expenses'];
        $r['driver_accruals'] = (float)$r['driver_accruals'];
        $r['driver_payments'] = (float)$r['driver_payments'];
    }
    
    echo json_encode([
        'ok' => true,
        'total' => $total,
        'limit' => $limit,
        'offset' => $offset,
        'reports' => $reports
    ], JSON_UNESCAPED_UNICODE);
}

function getStats($pdo, $month) {
    $where = $month ? "WHERE TO_CHAR(date_to, 'YYYY-MM') = :month" : '';
    $params = $month ? [':month' => $month] : [];
    
    $sql = "SELECT 
        COUNT(*) as total_reports,
        COUNT(DISTINCT driver_id) as total_drivers,
        COUNT(DISTINCT vehicle_id) as total_vehicles,
        COALESCE(SUM(total_expenses), 0) as total_expenses,
        COALESCE(SUM(fuel_amount), 0) as total_fuel,
        COALESCE(SUM(mileage), 0) as total_mileage,
        COALESCE(SUM(driver_accruals), 0) as total_accruals,
        COALESCE(SUM(driver_payments), 0) as total_payments
    FROM driver_reports $where";
    
    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $stats = $stmt->fetch(PDO::FETCH_ASSOC);
    
    // Monthly breakdown
    $monthSql = "SELECT 
        TO_CHAR(date_to, 'YYYY-MM') as month,
        COUNT(*) as reports,
        SUM(total_expenses) as expenses,
        SUM(driver_accruals) as accruals
    FROM driver_reports
    GROUP BY TO_CHAR(date_to, 'YYYY-MM')
    ORDER BY month DESC
    LIMIT 12";
    
    $monthStmt = $pdo->query($monthSql);
    $monthly = $monthStmt->fetchAll(PDO::FETCH_ASSOC);
    
    echo json_encode([
        'ok' => true,
        'stats' => $stats,
        'monthly' => $monthly
    ], JSON_UNESCAPED_UNICODE);
}

function getDriversList($pdo) {
    $sql = "SELECT DISTINCT driver_name, COUNT(*) as reports 
            FROM driver_reports 
            WHERE driver_name IS NOT NULL AND driver_name != ''
            GROUP BY driver_name 
            ORDER BY driver_name";
    $stmt = $pdo->query($sql);
    $drivers = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    echo json_encode(['ok' => true, 'drivers' => $drivers], JSON_UNESCAPED_UNICODE);
}

function getVehiclesList($pdo) {
    $sql = "SELECT DISTINCT vehicle_number, COUNT(*) as reports 
            FROM driver_reports 
            WHERE vehicle_number IS NOT NULL AND vehicle_number != ''
            GROUP BY vehicle_number 
            ORDER BY vehicle_number";
    $stmt = $pdo->query($sql);
    $vehicles = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    echo json_encode(['ok' => true, 'vehicles' => $vehicles], JSON_UNESCAPED_UNICODE);
}

function getCategories($pdo) {
    $sql = "SELECT DISTINCT 
        jsonb_array_elements(expense_categories)->>'category' as category,
        COUNT(*) as count
    FROM driver_reports
    WHERE expense_categories IS NOT NULL
    GROUP BY jsonb_array_elements(expense_categories)->>'category'
    ORDER BY count DESC";
    $stmt = $pdo->query($sql);
    $categories = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    echo json_encode(['ok' => true, 'categories' => $categories], JSON_UNESCAPED_UNICODE);
}
