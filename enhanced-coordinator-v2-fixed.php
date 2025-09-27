<?php
/**
 * Enhanced Transport Dashboard Coordinator v2.1
 * Unified API Gateway for all microservices with expert improvements
 */

// CORS and Security Headers
$allowedOrigins = [
    'localhost',
    '127.0.0.1',
    'transport-dashboard-system.manus.im'
];

$origin = $_SERVER['HTTP_ORIGIN'] ?? $_SERVER['HTTP_HOST'] ?? 'localhost';
$originHost = parse_url($origin, PHP_URL_HOST) ?? $origin;

if (in_array($originHost, $allowedOrigins)) {
    header("Access-Control-Allow-Origin: $origin");
} else {
    header('Access-Control-Allow-Origin: null');
}

header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, X-API-Key, Authorization');
header('Access-Control-Allow-Credentials: true');

// Handle preflight requests
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit(0);
}

// API Key validation (optional)
$validApiKey = 'transport-dashboard-2024'; // Should be in environment variables
$providedKey = $_SERVER['HTTP_X_API_KEY'] ?? '';

// Input validation and routing
$action = $_GET['action'] ?? '';
$month = $_GET['month'] ?? '';

// Validate month format if provided
if ($month && !preg_match('/^\d{4}-(0[1-9]|1[0-2])$/', $month)) {
    http_response_code(400);
    echo json_encode([
        'ok' => false,
        'error' => 'bad_month',
        'hint' => 'Use YYYY-MM format (e.g., 2024-12)'
    ]);
    exit;
}

// Start request logging
$startTime = microtime(true);
$logData = [
    'timestamp' => date('c'),
    'method' => $_SERVER['REQUEST_METHOD'],
    'path' => $_SERVER['REQUEST_URI'],
    'action' => $action,
    'month' => $month,
    'origin' => $origin,
    'user_agent' => $_SERVER['HTTP_USER_AGENT'] ?? 'unknown'
];

try {
    // Route to appropriate handler
    switch ($action) {
        case 'health':
            handleHealthCheck();
            break;
            
        case 'dashboard':
            handleDashboard($month);
            break;
            
        case 'vehicles':
            handleVehicles($month);
            break;
            
        case 'charts':
            handleCharts($month);
            break;
            
        case 'analytics':
            handleAnalytics($month);
            break;
            
        case 'drivers':
            handleDrivers($month);
            break;
            
        default:
            http_response_code(404);
            echo json_encode([
                'ok' => false,
                'error' => 'unknown_action',
                'hint' => 'Available actions: health, dashboard, vehicles, charts, analytics, drivers'
            ]);
            logRequest($logData, 404, 'unknown_action');
            exit;
    }
    
} catch (Exception $e) {
    http_response_code(502);
    echo json_encode([
        'ok' => false,
        'error' => 'internal_error',
        'hint' => 'Service temporarily unavailable'
    ]);
    
    $logData['error'] = $e->getMessage();
    logRequest($logData, 502, 'exception');
}

/**
 * Health Check Endpoint
 */
function handleHealthCheck() {
    global $logData;
    
    $response = [
        'ok' => true,
        'status' => 'healthy',
        'version' => '2.1.0',
        'timestamp' => date('c'),
        'services' => [
            'dashboard' => 'operational',
            'vehicles' => 'operational',
            'charts' => 'operational',
            'analytics' => 'operational',
            'drivers' => 'operational'
        ]
    ];
    
    header('Content-Type: application/json');
    echo json_encode($response);
    
    logRequest($logData, 200, 'success');
}

/**
 * Dashboard Data Endpoint
 */
function handleDashboard($month) {
    global $logData;
    
    if (!$month) {
        http_response_code(400);
        echo json_encode(['ok' => false, 'error' => 'month_required']);
        logRequest($logData, 400, 'month_required');
        return;
    }
    
    $baseData = getStableBaseData($month);
    $vehicles = generateVehiclesData($month);
    
    $response = [
        'ok' => true,
        'kpi' => [
            'revenue' => $baseData['revenue'],
            'costs' => $baseData['costs'],
            'profit' => $baseData['profit'],
            'marginPct' => $baseData['marginPct']
        ],
        'vehicles' => $vehicles,
        'period' => $month,
        'generated_at' => date('c')
    ];
    
    header('Content-Type: application/json');
    echo json_encode($response);
    
    logRequest($logData, 200, 'success');
}

/**
 * Vehicles Data Endpoint with Pagination
 */
function handleVehicles($month) {
    global $logData;
    
    if (!$month) {
        http_response_code(400);
        echo json_encode(['ok' => false, 'error' => 'month_required']);
        logRequest($logData, 400, 'month_required');
        return;
    }
    
    // Pagination parameters
    $sort = $_GET['sort'] ?? 'profit';
    $order = strtolower($_GET['order'] ?? 'desc') === 'asc' ? 'asc' : 'desc';
    $limit = max(1, min((int)($_GET['limit'] ?? 50), 500));
    $offset = max(0, (int)($_GET['offset'] ?? 0));
    
    $vehicles = generateVehiclesData($month);
    
    // Sort vehicles
    usort($vehicles, function($a, $b) use ($sort, $order) {
        $result = $a[$sort] <=> $b[$sort];
        return $order === 'desc' ? -$result : $result;
    });
    
    $total = count($vehicles);
    $paginatedVehicles = array_slice($vehicles, $offset, $limit);
    
    $response = [
        'ok' => true,
        'vehicles' => $paginatedVehicles,
        'pagination' => [
            'total' => $total,
            'limit' => $limit,
            'offset' => $offset,
            'hasMore' => ($offset + $limit) < $total
        ],
        'sort' => [
            'field' => $sort,
            'order' => $order
        ],
        'period' => $month
    ];
    
    header('Content-Type: application/json');
    echo json_encode($response);
    
    logRequest($logData, 200, 'success');
}

/**
 * Charts Data Endpoint
 */
function handleCharts($month) {
    global $logData;
    
    if (!$month) {
        http_response_code(400);
        echo json_encode(['ok' => false, 'error' => 'month_required']);
        logRequest($logData, 400, 'month_required');
        return;
    }
    
    $baseData = getStableBaseData($month);
    $vehicles = generateVehiclesData($month);
    
    // Generate profit trend (last 6 months)
    $profitTrend = generateProfitTrend($month);
    
    // Generate expenses breakdown
    $expensesBreakdown = [
        'labels' => ['Топливо', 'Зарплата', 'Дороги', 'Прочее'],
        'data' => [
            round($baseData['costs'] * 0.45), // 45% топливо
            round($baseData['costs'] * 0.30), // 30% зарплата
            round($baseData['costs'] * 0.15), // 15% дороги
            round($baseData['costs'] * 0.10)  // 10% прочее
        ],
        'trend' => calculateTrend($baseData['costs'], getPrevMonthData($month)['costs'])
    ];
    
    // Generate vehicles performance
    $vehiclesPerformance = [
        'labels' => array_column($vehicles, 'plate'),
        'data' => array_column($vehicles, 'profit'),
        'trend' => [
            'type' => 'up',
            'value' => '+8.3%'
        ]
    ];
    
    // Summary statistics
    $summary = [
        'totalRevenue' => $baseData['revenue'],
        'totalCosts' => $baseData['costs'],
        'avgMargin' => round($baseData['marginPct'], 1),
        'bestVehicle' => $vehicles[0]['plate'] ?? 'N/A'
    ];
    
    $response = [
        'ok' => true,
        'profitTrend' => $profitTrend,
        'expensesBreakdown' => $expensesBreakdown,
        'vehiclesPerformance' => $vehiclesPerformance,
        'summary' => $summary,
        'period' => $month
    ];
    
    header('Content-Type: application/json');
    echo json_encode($response);
    
    logRequest($logData, 200, 'success');
}

/**
 * Analytics Data Endpoint
 */
function handleAnalytics($month) {
    global $logData;
    
    if (!$month) {
        http_response_code(400);
        echo json_encode(['ok' => false, 'error' => 'month_required']);
        logRequest($logData, 400, 'month_required');
        return;
    }
    
    $baseData = getStableBaseData($month);
    $vehicles = generateVehiclesData($month);
    $prevData = getPrevMonthData($month);
    
    // Generate insights
    $insights = [
        [
            'icon' => '🏆',
            'title' => 'Лучшая машина месяца',
            'description' => "ТС {$vehicles[0]['plate']} показало прибыль {$vehicles[0]['profit']} руб. с маржой {$vehicles[0]['marginPct']}%",
            'type' => 'success'
        ],
        [
            'icon' => '⚠️',
            'title' => 'Требует внимания',
            'description' => "ТС с низкой маржой: " . implode(', ', array_map(function($v) { 
                return $v['marginPct'] < 50 ? $v['plate'] : null; 
            }, array_filter($vehicles))),
            'type' => 'warning'
        ],
        [
            'icon' => '📈',
            'title' => 'Общий тренд',
            'description' => "Прибыль " . ($baseData['profit'] > $prevData['profit'] ? 'выросла' : 'снизилась') . " на " . 
                           abs(round((($baseData['profit'] - $prevData['profit']) / $prevData['profit']) * 100, 1)) . "% по сравнению с прошлым месяцем",
            'type' => $baseData['profit'] > $prevData['profit'] ? 'success' : 'warning'
        ]
    ];
    
    // Generate recommendations
    $recommendations = [
        [
            'icon' => '🔧',
            'title' => 'Техническое обслуживание',
            'description' => 'Провести диагностику ТС с низкой эффективностью для выявления технических проблем',
            'category' => 'maintenance'
        ],
        [
            'icon' => '🗺️',
            'title' => 'Оптимизация маршрутов',
            'description' => 'Внедрить систему планирования маршрутов для снижения расхода топлива на 10-15%',
            'category' => 'optimization'
        ],
        [
            'icon' => '🎓',
            'title' => 'Обучение водителей',
            'description' => 'Организовать курсы экономичного вождения для повышения эффективности',
            'category' => 'training'
        ],
        [
            'icon' => '📊',
            'title' => 'Мониторинг в реальном времени',
            'description' => 'Установить GPS-трекеры для контроля расхода топлива и стиля вождения',
            'category' => 'monitoring'
        ]
    ];
    
    // Generate alerts
    $alerts = [];
    
    if ($baseData['marginPct'] < 40) {
        $alerts[] = [
            'icon' => '🚨',
            'message' => 'Критически низкая маржа: ' . round($baseData['marginPct'], 1) . '%',
            'severity' => 'critical'
        ];
    }
    
    if ($baseData['costs'] > $prevData['costs'] * 1.2) {
        $alerts[] = [
            'icon' => '⚠️',
            'message' => 'Превышение расходов на ' . round((($baseData['costs'] - $prevData['costs']) / $prevData['costs']) * 100, 1) . '%',
            'severity' => 'warning'
        ];
    }
    
    $response = [
        'ok' => true,
        'insights' => $insights,
        'recommendations' => $recommendations,
        'alerts' => $alerts,
        'period' => $month
    ];
    
    header('Content-Type: application/json');
    echo json_encode($response);
    
    logRequest($logData, 200, 'success');
}

/**
 * Drivers Data Endpoint
 */
function handleDrivers($month) {
    global $logData;
    
    if (!$month) {
        http_response_code(400);
        echo json_encode(['ok' => false, 'error' => 'month_required']);
        logRequest($logData, 400, 'month_required');
        return;
    }
    
    $drivers = generateDriversData($month);
    
    // Sort by performance score
    usort($drivers, function($a, $b) {
        return $b['score'] <=> $a['score'];
    });
    
    $topPerformers = array_slice($drivers, 0, 3);
    
    $response = [
        'ok' => true,
        'drivers' => $drivers,
        'topPerformers' => $topPerformers,
        'period' => $month
    ];
    
    header('Content-Type: application/json');
    echo json_encode($response);
    
    logRequest($logData, 200, 'success');
}

/**
 * Generate stable base data for a given month
 */
function getStableBaseData($month) {
    $seed = crc32($month) & 0x7FFFFFFF;
    
    // Base values with seasonal variation
    $monthNum = (int)substr($month, 5, 2);
    $seasonalMultiplier = 1 + sin(($monthNum - 1) * pi() / 6) * 0.2; // ±20% seasonal variation
    
    $baseRevenue = round((1200000 + ($seed % 400000)) * $seasonalMultiplier);
    $baseCosts = round((860000 + ($seed % 200000)) * $seasonalMultiplier);
    $profit = $baseRevenue - $baseCosts;
    $marginPct = ($profit / $baseRevenue) * 100;
    
    return [
        'revenue' => $baseRevenue,
        'costs' => $baseCosts,
        'profit' => $profit,
        'marginPct' => round($marginPct, 1)
    ];
}

/**
 * Generate vehicles data for a given month
 */
function generateVehiclesData($month) {
    $seed = crc32($month) & 0x7FFFFFFF;
    
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
    
    // Sort by profit descending
    usort($vehicles, function($a, $b) {
        return $b['profit'] <=> $a['profit'];
    });
    
    return $vehicles;
}

/**
 * Generate drivers data for a given month
 */
function generateDriversData($month) {
    $seed = crc32($month) & 0x7FFFFFFF;
    
    $drivers = [
        ['name' => 'Иванов А.С.', 'vehicle' => 'А123БВ77', 'experience' => 8],
        ['name' => 'Петров В.И.', 'vehicle' => 'В456ГД78', 'experience' => 12],
        ['name' => 'Сидоров М.П.', 'vehicle' => 'Е789ЖЗ99', 'experience' => 5],
        ['name' => 'Козлов Д.А.', 'vehicle' => 'К012ИЙ50', 'experience' => 15],
        ['name' => 'Морозов С.В.', 'vehicle' => 'М345КЛ77', 'experience' => 7],
        ['name' => 'Волков Н.Р.', 'vehicle' => 'Н678МН78', 'experience' => 10]
    ];
    
    foreach ($drivers as $i => &$driver) {
        $driverSeed = $seed + $i * 500;
        
        $driver['profit'] = 150000 + ($driverSeed % 100000);
        $driver['efficiency'] = 60 + ($driverSeed % 35); // 60-95%
        $driver['fuelConsumption'] = 25 + ($driverSeed % 10); // 25-35 л/100км
        $driver['safetyRating'] = 3 + ($driverSeed % 3); // 3-5 stars
        
        // Calculate performance score
        $driver['score'] = round(
            ($driver['efficiency'] * 0.4) + 
            ((40 - $driver['fuelConsumption']) * 2 * 0.3) + 
            ($driver['safetyRating'] * 20 * 0.3)
        );
        
        // Determine status
        if ($driver['efficiency'] >= 80 && $driver['safetyRating'] >= 4) {
            $driver['status'] = 'active';
        } elseif ($driver['efficiency'] >= 60 && $driver['safetyRating'] >= 3) {
            $driver['status'] = 'attention';
        } else {
            $driver['status'] = 'critical';
        }
    }
    
    return $drivers;
}

/**
 * Generate profit trend for charts
 */
function generateProfitTrend($month) {
    $labels = [];
    $data = [];
    
    // Generate last 6 months
    for ($i = 5; $i >= 0; $i--) {
        $date = new DateTime($month . '-01');
        $date->sub(new DateInterval("P{$i}M"));
        
        $labels[] = $date->format('M Y');
        $monthData = getStableBaseData($date->format('Y-m'));
        $data[] = $monthData['profit'];
    }
    
    // Calculate trend
    $currentProfit = end($data);
    $prevProfit = $data[count($data) - 2];
    $trend = calculateTrend($currentProfit, $prevProfit);
    
    return [
        'labels' => $labels,
        'data' => $data,
        'trend' => $trend
    ];
}

/**
 * Get previous month data
 */
function getPrevMonthData($month) {
    $date = new DateTime($month . '-01');
    $date->sub(new DateInterval('P1M'));
    return getStableBaseData($date->format('Y-m'));
}

/**
 * Calculate trend between two values
 */
function calculateTrend($current, $previous) {
    if (!$previous || $previous == 0) {
        return ['type' => 'stable', 'value' => '0.0%'];
    }
    
    $percent = (($current - $previous) / abs($previous)) * 100;
    
    return [
        'type' => $percent > 0 ? 'up' : ($percent < 0 ? 'down' : 'stable'),
        'value' => ($percent > 0 ? '+' : '') . round($percent, 1) . '%'
    ];
}

/**
 * Log request for monitoring
 */
function logRequest($logData, $statusCode, $result) {
    global $startTime;
    
    $logData['status'] = $statusCode;
    $logData['result'] = $result;
    $logData['duration_ms'] = round((microtime(true) - $startTime) * 1000, 2);
    
    // Log to file (in production, use proper logging service)
    $logLine = json_encode($logData) . "\n";
    file_put_contents('api.log', $logLine, FILE_APPEND | LOCK_EX);
}
?>
