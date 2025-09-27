<?php
/**
 * CSV Export Service
 * Экспорт данных KPI и Vehicles в CSV формате
 */

require_once 'enhanced-coordinator-v2.php';

// Настройки
$ALLOWED_ORIGINS = ['http://localhost:3000', 'http://localhost:8080', 'https://8080-ipk8ch93zjhflz2f4wpwi-c07c57c4.manusvm.computer'];

// CORS
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
if (in_array($origin, $ALLOWED_ORIGINS)) {
    header("Access-Control-Allow-Origin: $origin");
} else {
    header('Access-Control-Allow-Origin: null');
}
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, X-API-Key');
header('Vary: Origin');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

// Валидация параметров
$type = $_GET['type'] ?? '';
$month = $_GET['month'] ?? date('Y-m');

if (!preg_match('/^\d{4}-(0[1-9]|1[0-2])$/', $month)) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => 'bad_month', 'hint' => 'Use YYYY-MM format']);
    exit;
}

if (!in_array($type, ['kpi', 'vehicles'])) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => 'bad_type', 'hint' => 'Use type=kpi or type=vehicles']);
    exit;
}

try {
    switch ($type) {
        case 'kpi':
            exportKpiCsv($month);
            break;
            
        case 'vehicles':
            exportVehiclesCsv($month);
            break;
    }
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['ok' => false, 'error' => 'export_failed', 'message' => $e->getMessage()]);
}

/**
 * Экспорт KPI в CSV
 */
function exportKpiCsv($month) {
    $data = getDashboardData($month);
    $kpi = $data['kpi'];
    
    $filename = "kpi-{$month}.csv";
    
    header('Content-Type: text/csv; charset=utf-8');
    header("Content-Disposition: attachment; filename=\"{$filename}\"");
    header('Cache-Control: no-cache, must-revalidate');
    
    $output = fopen('php://output', 'w');
    
    // BOM для корректного отображения в Excel
    fprintf($output, chr(0xEF).chr(0xBB).chr(0xBF));
    
    // Заголовки
    fputcsv($output, [
        'Период',
        'Выручка (руб)',
        'Расходы (руб)',
        'Прибыль (руб)',
        'Маржа (%)'
    ], ';');
    
    // Данные
    fputcsv($output, [
        $month,
        number_format($kpi['revenue'], 0, ',', ' '),
        number_format($kpi['costs'], 0, ',', ' '),
        number_format($kpi['profit'], 0, ',', ' '),
        number_format($kpi['marginPct'], 1, ',', '')
    ], ';');
    
    fclose($output);
}

/**
 * Экспорт транспортных средств в CSV
 */
function exportVehiclesCsv($month) {
    $data = getVehiclesData($month);
    $vehicles = $data['vehicles'];
    
    $filename = "vehicles-{$month}.csv";
    
    header('Content-Type: text/csv; charset=utf-8');
    header("Content-Disposition: attachment; filename=\"{$filename}\"");
    header('Cache-Control: no-cache, must-revalidate');
    
    $output = fopen('php://output', 'w');
    
    // BOM для корректного отображения в Excel
    fprintf($output, chr(0xEF).chr(0xBB).chr(0xBF));
    
    // Заголовки
    fputcsv($output, [
        'Номер ТС',
        'Модель',
        'Прибыль (руб)',
        'Маржа (%)'
    ], ';');
    
    // Данные
    foreach ($vehicles as $vehicle) {
        fputcsv($output, [
            $vehicle['plate'],
            $vehicle['model'],
            number_format($vehicle['profit'], 0, ',', ' '),
            number_format($vehicle['marginPct'], 1, ',', '')
        ], ';');
    }
    
    fclose($output);
}
?>
