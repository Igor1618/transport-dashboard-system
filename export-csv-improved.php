<?php
/**
 * Enhanced CSV Export Service v2.0
 * Exports KPI and Vehicles data with proper Excel formatting
 */

header('Access-Control-Allow-Origin: ' . ($_SERVER['HTTP_HOST'] ?? 'localhost'));
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, X-API-Key');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

// Input validation
$type = $_GET['type'] ?? '';
$month = $_GET['month'] ?? '';

if (!in_array($type, ['kpi', 'vehicles', 'all'])) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => 'invalid_type', 'hint' => 'Use type=kpi|vehicles|all']);
    exit;
}

if (!preg_match('/^\d{4}-(0[1-9]|1[0-2])$/', $month)) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => 'bad_month', 'hint' => 'Use YYYY-MM format']);
    exit;
}

// Load coordinator for data
require_once 'enhanced-coordinator-v2.php';

try {
    if ($type === 'all') {
        exportAllData($month);
    } else {
        exportSingleType($type, $month);
    }
} catch (Exception $e) {
    http_response_code(502);
    echo json_encode(['ok' => false, 'error' => 'export_failed', 'hint' => $e->getMessage()]);
}

function exportSingleType($type, $month) {
    $filename = "{$type}-{$month}.csv";
    
    // Proper headers for Excel compatibility
    header('Content-Type: text/csv; charset=UTF-8');
    header("Content-Disposition: attachment; filename=\"{$filename}\"");
    header('Cache-Control: no-cache, must-revalidate');
    header('Expires: Sat, 26 Jul 1997 05:00:00 GMT');
    
    // BOM for Excel UTF-8 support
    echo "\xEF\xBB\xBF";
    
    $output = fopen('php://output', 'w');
    
    if ($type === 'kpi') {
        exportKpiData($output, $month);
    } elseif ($type === 'vehicles') {
        exportVehiclesData($output, $month);
    }
    
    fclose($output);
}

function exportKpiData($output, $month) {
    // Get KPI data
    $_GET['action'] = 'dashboard';
    $_GET['month'] = $month;
    
    ob_start();
    $coordinator = new EnhancedCoordinator();
    $response = $coordinator->handleRequest();
    $jsonOutput = ob_get_clean();
    
    $data = json_decode($jsonOutput, true);
    
    if (!$data['ok']) {
        throw new Exception('Failed to get KPI data: ' . ($data['error'] ?? 'unknown'));
    }
    
    $kpi = $data['kpi'];
    
    // CSV headers (semicolon for Excel RU)
    fputcsv($output, ['Показатель', 'Значение', 'Период'], ';');
    
    // KPI rows
    fputcsv($output, ['Выручка', $kpi['revenue'], $month], ';');
    fputcsv($output, ['Расходы', $kpi['costs'], $month], ';');
    fputcsv($output, ['Прибыль', $kpi['profit'], $month], ';');
    fputcsv($output, ['Маржа (%)', $kpi['marginPct'], $month], ';');
}

function exportVehiclesData($output, $month) {
    // Get vehicles data
    $_GET['action'] = 'vehicles';
    $_GET['month'] = $month;
    $_GET['limit'] = '1000'; // Get all vehicles
    $_GET['offset'] = '0';
    
    ob_start();
    $coordinator = new EnhancedCoordinator();
    $response = $coordinator->handleRequest();
    $jsonOutput = ob_get_clean();
    
    $data = json_decode($jsonOutput, true);
    
    if (!$data['ok']) {
        throw new Exception('Failed to get vehicles data: ' . ($data['error'] ?? 'unknown'));
    }
    
    $vehicles = $data['vehicles'];
    
    // CSV headers
    fputcsv($output, ['Номер', 'Модель', 'Прибыль', 'Маржа (%)', 'Период'], ';');
    
    // Vehicle rows
    foreach ($vehicles as $vehicle) {
        fputcsv($output, [
            $vehicle['plate'],
            $vehicle['model'],
            $vehicle['profit'],
            $vehicle['marginPct'],
            $month
        ], ';');
    }
}

function exportAllData($month) {
    // Create ZIP archive with both files
    $zipFilename = "transport-data-{$month}.zip";
    
    header('Content-Type: application/zip');
    header("Content-Disposition: attachment; filename=\"{$zipFilename}\"");
    header('Cache-Control: no-cache, must-revalidate');
    
    $zip = new ZipArchive();
    $tempZip = tempnam(sys_get_temp_dir(), 'transport_export');
    
    if ($zip->open($tempZip, ZipArchive::CREATE) !== TRUE) {
        throw new Exception('Cannot create ZIP file');
    }
    
    // Add KPI CSV
    $kpiCsv = generateCsvContent('kpi', $month);
    $zip->addFromString("kpi-{$month}.csv", $kpiCsv);
    
    // Add Vehicles CSV
    $vehiclesCsv = generateCsvContent('vehicles', $month);
    $zip->addFromString("vehicles-{$month}.csv", $vehiclesCsv);
    
    // Add README
    $readme = "Transport Dashboard Export\n";
    $readme .= "Period: {$month}\n";
    $readme .= "Generated: " . date('Y-m-d H:i:s') . "\n\n";
    $readme .= "Files:\n";
    $readme .= "- kpi-{$month}.csv: Key Performance Indicators\n";
    $readme .= "- vehicles-{$month}.csv: Vehicle Performance Data\n";
    $zip->addFromString('README.txt', $readme);
    
    $zip->close();
    
    readfile($tempZip);
    unlink($tempZip);
}

function generateCsvContent($type, $month) {
    ob_start();
    
    $output = fopen('php://memory', 'w');
    
    // BOM for Excel
    fwrite($output, "\xEF\xBB\xBF");
    
    if ($type === 'kpi') {
        exportKpiData($output, $month);
    } elseif ($type === 'vehicles') {
        exportVehiclesData($output, $month);
    }
    
    rewind($output);
    $content = stream_get_contents($output);
    fclose($output);
    
    ob_end_clean();
    
    return $content;
}

/**
 * Enhanced Coordinator Class
 * Reuse the coordinator logic for data fetching
 */
class EnhancedCoordinator {
    private $allowedOrigins = [
        'localhost',
        '127.0.0.1',
        'transport-dashboard-system.manus.im'
    ];
    
    public function handleRequest() {
        $action = $_GET['action'] ?? '';
        $month = $_GET['month'] ?? '';
        
        switch ($action) {
            case 'dashboard':
                return $this->getDashboardData($month);
            case 'vehicles':
                return $this->getVehiclesData($month);
            default:
                http_response_code(404);
                return json_encode(['ok' => false, 'error' => 'unknown_action']);
        }
    }
    
    private function getDashboardData($month) {
        // Generate deterministic data based on month
        $seed = $this->getMonthSeed($month);
        
        $baseRevenue = 1200000 + ($seed % 400000);
        $baseCosts = 860000 + ($seed % 200000);
        $profit = $baseRevenue - $baseCosts;
        $marginPct = ($profit / $baseRevenue) * 100;
        
        $kpi = [
            'revenue' => $baseRevenue,
            'costs' => $baseCosts,
            'profit' => $profit,
            'marginPct' => round($marginPct, 1)
        ];
        
        $vehicles = $this->generateVehiclesData($month);
        
        echo json_encode([
            'ok' => true,
            'kpi' => $kpi,
            'vehicles' => $vehicles
        ]);
    }
    
    private function getVehiclesData($month) {
        $vehicles = $this->generateVehiclesData($month);
        
        // Apply sorting
        $sort = $_GET['sort'] ?? 'profit';
        $order = $_GET['order'] ?? 'desc';
        $limit = min(1000, max(1, intval($_GET['limit'] ?? 50)));
        $offset = max(0, intval($_GET['offset'] ?? 0));
        
        // Sort vehicles
        usort($vehicles, function($a, $b) use ($sort, $order) {
            $result = $a[$sort] <=> $b[$sort];
            return $order === 'desc' ? -$result : $result;
        });
        
        $total = count($vehicles);
        $paginatedVehicles = array_slice($vehicles, $offset, $limit);
        
        echo json_encode([
            'ok' => true,
            'vehicles' => $paginatedVehicles,
            'pagination' => [
                'total' => $total,
                'limit' => $limit,
                'offset' => $offset,
                'hasMore' => ($offset + $limit) < $total
            ]
        ]);
    }
    
    private function generateVehiclesData($month) {
        $seed = $this->getMonthSeed($month);
        
        $vehicles = [
            ['plate' => 'А123БВ77', 'model' => 'МАЗ-6312'],
            ['plate' => 'В456ГД78', 'model' => 'КАМАЗ-65117'],
            ['plate' => 'Е789ЖЗ99', 'model' => 'Volvo FH'],
            ['plate' => 'К012ИЙ50', 'model' => 'Scania R450'],
            ['plate' => 'М345КЛ77', 'model' => 'Mercedes Actros'],
            ['plate' => 'Н678МН78', 'model' => 'MAN TGX']
        ];
        
        foreach ($vehicles as $i => &$vehicle) {
            $vehicleSeed = $seed + $i * 1000;
            $baseProfit = 180000 + ($vehicleSeed % 120000);
            $baseRevenue = $baseProfit + 50000 + ($vehicleSeed % 30000);
            
            $vehicle['profit'] = $baseProfit;
            $vehicle['marginPct'] = round(($baseProfit / $baseRevenue) * 100, 1);
        }
        
        return $vehicles;
    }
    
    private function getMonthSeed($month) {
        return crc32($month) & 0x7FFFFFFF;
    }
}
?>
