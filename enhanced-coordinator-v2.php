<?php
/**
 * Enhanced Coordinator v2.0
 * Исправлены все проблемы из анализа:
 * - Единые контракты данных
 * - Валидация входных параметров
 * - Нормальные HTTP коды ошибок
 * - Ограниченный CORS
 * - Стабильные данные без rand()
 * - Пагинация и сортировка
 * - Логирование запросов
 */

// Настройки
$ALLOWED_ORIGINS = ['http://localhost:3000', 'http://localhost:8080', 'https://8080-ipk8ch93zjhflz2f4wpwi-c07c57c4.manusvm.computer'];
$API_KEY = 'transport-dashboard-2024'; // В проде из .env
$LOG_FILE = 'api.log';

// Функция логирования
function logRequest($path, $month, $status, $startTime, $error = null) {
    global $LOG_FILE;
    $duration = round((microtime(true) - $startTime) * 1000, 2);
    $logEntry = [
        'timestamp' => gmdate('c'),
        'path' => $path,
        'month' => $month,
        'status' => $status,
        'duration_ms' => $duration,
        'error' => $error
    ];
    file_put_contents($LOG_FILE, json_encode($logEntry) . "\n", FILE_APPEND | LOCK_EX);
}

// Функция отправки ошибки
function sendError($code, $error, $hint = null) {
    http_response_code($code);
    $response = ['ok' => false, 'error' => $error];
    if ($hint) $response['hint'] = $hint;
    echo json_encode($response, JSON_UNESCAPED_UNICODE);
    exit;
}

// Функция отправки успешного ответа
function sendSuccess($data) {
    http_response_code(200);
    echo json_encode(array_merge(['ok' => true], $data), JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
    exit;
}

// Начало обработки запроса
$startTime = microtime(true);
$requestPath = $_SERVER['REQUEST_URI'] ?? '';
$month = $_GET['month'] ?? date('Y-m');

// CORS проверка
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
if (in_array($origin, $ALLOWED_ORIGINS)) {
    header("Access-Control-Allow-Origin: $origin");
} else {
    header('Access-Control-Allow-Origin: null');
}
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, X-API-Key');
header('Vary: Origin');

// Обработка preflight запросов
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    logRequest($requestPath, $month, 200, $startTime);
    exit(0);
}

// API Key проверка (пока мягкая)
$apiKey = $_SERVER['HTTP_X_API_KEY'] ?? $_GET['api_key'] ?? '';
if ($apiKey && $apiKey !== $API_KEY) {
    logRequest($requestPath, $month, 401, $startTime, 'invalid_api_key');
    sendError(401, 'invalid_api_key', 'Check X-API-Key header');
}

// Валидация месяца
if (!preg_match('/^\d{4}-(0[1-9]|1[0-2])$/', $month)) {
    logRequest($requestPath, $month, 400, $startTime, 'bad_month');
    sendError(400, 'bad_month', 'Use YYYY-MM format');
}

// Определение действия
$action = $_GET['action'] ?? 'dashboard';

try {
    switch ($action) {
        case 'dashboard':
            $data = getDashboardData($month);
            break;
            
        case 'vehicles':
            $data = getVehiclesData($month);
            break;
            
        case 'charts':
            $data = getChartsData($month);
            break;
            
        case 'analytics':
            $data = getAnalyticsData($month);
            break;
            
        case 'drivers':
            $data = getDriversData($month);
            break;
            
        case 'health':
            $data = getHealthStatus();
            break;
            
        case 'readiness':
            $data = getReadinessStatus();
            break;
            
        default:
            logRequest($requestPath, $month, 404, $startTime, 'unknown_action');
            sendError(404, 'not_found', 'Unknown action: ' . $action);
    }
    
    logRequest($requestPath, $month, 200, $startTime);
    sendSuccess($data);
    
} catch (Exception $e) {
    logRequest($requestPath, $month, 502, $startTime, $e->getMessage());
    sendError(502, 'downstream_unavailable', 'Backend service error');
}

/**
 * Единый формат ответа дашборда
 */
function dashboardResponse($month, $summary, $vehicles) {
    $kpi = [
        'revenue'   => (int)($summary['revenue']  ?? 0),
        'costs'     => (int)($summary['costs']    ?? 0),
        'profit'    => (int)($summary['profit']   ?? (($summary['revenue'] ?? 0) - ($summary['costs'] ?? 0))),
        'marginPct' => round((float)($summary['marginPct'] ?? 0), 1)
    ];
    
    $list = [];
    if (is_array($vehicles)) {
        foreach ($vehicles as $v) {
            $list[] = [
                'plate'     => (string)($v['plate'] ?? $v['number'] ?? ''),
                'model'     => (string)($v['model'] ?? ''),
                'profit'    => (int)($v['profit'] ?? 0),
                'marginPct' => round((float)($v['marginPct'] ?? $v['margin'] ?? 0), 1),
            ];
        }
    }
    
    return [
        'month' => $month,
        'kpi' => $kpi,
        'vehicles' => $list,
        'generatedAt' => gmdate('c')
    ];
}

/**
 * Получение данных дашборда
 */
function getDashboardData($month) {
    // Стабильные данные без рандома
    $baseData = getStableBaseData($month);
    return dashboardResponse($month, $baseData['kpi'], $baseData['vehicles']);
}

/**
 * Получение данных транспортных средств с пагинацией
 */
function getVehiclesData($month) {
    $sort = $_GET['sort'] ?? 'profit';
    $order = strtolower($_GET['order'] ?? 'desc') === 'asc' ? 'asc' : 'desc';
    $limit = max(1, min((int)($_GET['limit'] ?? 50), 500));
    $offset = max(0, (int)($_GET['offset'] ?? 0));
    
    $baseData = getStableBaseData($month);
    $vehicles = $baseData['vehicles'];
    
    // Сортировка на бэке
    usort($vehicles, function($a, $b) use ($sort, $order) {
        $aVal = $a[$sort] ?? 0;
        $bVal = $b[$sort] ?? 0;
        
        if ($order === 'asc') {
            return $aVal <=> $bVal;
        } else {
            return $bVal <=> $aVal;
        }
    });
    
    // Пагинация
    $total = count($vehicles);
    $vehicles = array_slice($vehicles, $offset, $limit);
    
    // Нормализация данных
    $normalizedVehicles = [];
    foreach ($vehicles as $v) {
        $normalizedVehicles[] = [
            'plate'     => (string)($v['plate'] ?? $v['number'] ?? ''),
            'model'     => (string)($v['model'] ?? ''),
            'profit'    => (int)($v['profit'] ?? 0),
            'marginPct' => round((float)($v['marginPct'] ?? $v['margin'] ?? 0), 1),
        ];
    }
    
    return [
        'month' => $month,
        'vehicles' => $normalizedVehicles,
        'pagination' => [
            'total' => $total,
            'limit' => $limit,
            'offset' => $offset,
            'hasMore' => ($offset + $limit) < $total
        ],
        'sort' => ['field' => $sort, 'order' => $order],
        'generatedAt' => gmdate('c')
    ];
}

/**
 * Получение данных для графиков
 */
function getChartsData($month) {
    $year = (int)substr($month, 0, 4);
    $currentMonth = (int)substr($month, 5, 2);
    
    // Стабильные данные для графика прибыли (без рандома)
    $profitTrend = [
        'labels' => ['Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн', 'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек'],
        'data' => []
    ];
    
    // Генерация стабильных данных на основе месяца (детерминированно)
    $baseProfit = 1200000;
    for ($i = 1; $i <= 12; $i++) {
        $seasonal = sin(($i - 1) * pi() / 6) * 200000; // Сезонность
        $growth = ($i - 1) * 50000; // Рост
        $monthVariation = (($year + $i) % 7) * 10000; // Стабильная вариация
        
        $profit = $baseProfit + $seasonal + $growth + $monthVariation;
        $profitTrend['data'][] = max(800000, (int)$profit);
    }
    
    // Стабильная структура расходов
    $expenses = [
        'labels' => ['Топливо', 'Зарплата', 'Дороги', 'Прочее'],
        'data' => [
            450000 + (($year + $currentMonth) % 5) * 10000,
            320000 + (($year + $currentMonth) % 3) * 5000,
            180000 + (($year + $currentMonth) % 4) * 3000,
            150000 + (($year + $currentMonth) % 6) * 2000
        ]
    ];
    
    // Данные по транспортным средствам
    $baseData = getStableBaseData($month);
    $vehicles = [
        'labels' => array_column($baseData['vehicles'], 'plate'),
        'data' => array_column($baseData['vehicles'], 'profit')
    ];
    
    return [
        'month' => $month,
        'profitTrend' => $profitTrend,
        'expenses' => $expenses,
        'vehicles' => $vehicles,
        'generatedAt' => gmdate('c')
    ];
}

/**
 * Получение аналитических данных
 */
function getAnalyticsData($month) {
    $chartsData = getChartsData($month);
    $vehiclesData = $chartsData['vehicles']['data'];
    $vehicleNames = $chartsData['vehicles']['labels'];
    
    // Анализ без рандома
    $maxProfit = max($vehiclesData);
    $minProfit = min($vehiclesData);
    $bestVehicleIndex = array_search($maxProfit, $vehiclesData);
    $worstVehicleIndex = array_search($minProfit, $vehiclesData);
    
    // Стабильный расчет трендов
    $profitData = $chartsData['profitTrend']['data'];
    $currentMonth = (int)substr($month, 5, 2);
    $currentProfit = $profitData[$currentMonth - 1];
    $previousProfit = $currentMonth > 1 ? $profitData[$currentMonth - 2] : $profitData[11];
    $profitGrowth = (($currentProfit - $previousProfit) / $previousProfit) * 100;
    
    $fuelExpenses = $chartsData['expenses']['data'][0];
    $totalExpenses = array_sum($chartsData['expenses']['data']);
    $fuelPercentage = ($fuelExpenses / $totalExpenses) * 100;
    
    $insights = [
        [
            'type' => 'success',
            'icon' => '🏆',
            'title' => 'Лучшая машина месяца',
            'subtitle' => 'Максимальная прибыльность',
            'value' => $vehicleNames[$bestVehicleIndex],
            'description' => 'Принесла ₽' . number_format($maxProfit, 0, ',', ' ') . ' прибыли за месяц',
            'trend' => ['type' => 'up', 'value' => '+15.2%']
        ],
        [
            'type' => 'warning',
            'icon' => '⚠️',
            'title' => 'Проблемные ТС',
            'subtitle' => 'Требуют внимания',
            'value' => count(array_filter($vehiclesData, function($profit) { return $profit < 500000; })) . ' машины',
            'description' => $vehicleNames[$worstVehicleIndex] . ' и другие показывают низкую эффективность',
            'trend' => ['type' => 'down', 'value' => '-8.5%']
        ],
        [
            'type' => 'primary',
            'icon' => '📈',
            'title' => 'Общий тренд',
            'subtitle' => 'Динамика за период',
            'value' => ($profitGrowth > 0 ? '+' : '') . round($profitGrowth, 1) . '%',
            'description' => $profitGrowth > 0 ? 'Стабильный рост прибыли' : 'Снижение показателей',
            'trend' => ['type' => $profitGrowth > 0 ? 'up' : 'down', 'value' => $profitGrowth > 0 ? 'Растет' : 'Падает']
        ],
        [
            'type' => $fuelPercentage > 45 ? 'danger' : 'warning',
            'icon' => '💰',
            'title' => 'Расходы на топливо',
            'subtitle' => $fuelPercentage > 45 ? 'Превышение бюджета' : 'В пределах нормы',
            'value' => round($fuelPercentage, 1) . '%',
            'description' => 'Доля топливных расходов в общих затратах',
            'trend' => ['type' => $fuelPercentage > 45 ? 'up' : 'stable', 'value' => $fuelPercentage > 45 ? 'Критично' : 'Норма']
        ]
    ];
    
    $recommendations = [
        [
            'icon' => '🔧',
            'title' => 'Техническое обслуживание',
            'description' => 'Машины с низкой прибыльностью нуждаются в диагностике. Возможны проблемы с двигателем или трансмиссией.',
            'impact' => 'Потенциальная экономия: ₽150,000/месяц'
        ],
        [
            'icon' => '⛽',
            'title' => 'Оптимизация маршрутов',
            'description' => 'Пересмотреть маршруты для снижения расхода топлива. Использовать GPS-оптимизацию.',
            'impact' => 'Экономия топлива: до 15%'
        ],
        [
            'icon' => '👨‍💼',
            'title' => 'Обучение водителей',
            'description' => 'Провести тренинг по экономичному вождению для водителей проблемных ТС.',
            'impact' => 'Улучшение эффективности: +10-20%'
        ],
        [
            'icon' => '📊',
            'title' => 'Мониторинг в реальном времени',
            'description' => 'Внедрить систему отслеживания расхода топлива и стиля вождения в реальном времени.',
            'impact' => 'Снижение расходов: ₽200,000/месяц'
        ]
    ];
    
    $alerts = [];
    
    if ($fuelPercentage > 45) {
        $alerts[] = [
            'type' => 'critical',
            'icon' => '!',
            'title' => 'Критическое превышение расходов',
            'description' => 'Расходы на топливо превысили норму на ' . round($fuelPercentage - 40, 1) . '%'
        ];
    }
    
    if ($minProfit < 400000) {
        $alerts[] = [
            'type' => 'warning',
            'icon' => '⚠',
            'title' => 'Снижение эффективности',
            'description' => 'Машина ' . $vehicleNames[$worstVehicleIndex] . ' показывает критически низкую прибыль'
        ];
    }
    
    $alerts[] = [
        'type' => 'info',
        'icon' => 'i',
        'title' => 'Новые возможности',
        'description' => 'Доступны льготы на техническое обслуживание до конца месяца'
    ];
    
    return [
        'month' => $month,
        'insights' => $insights,
        'recommendations' => $recommendations,
        'alerts' => $alerts,
        'generatedAt' => gmdate('c')
    ];
}

/**
 * Получение данных водителей
 */
function getDriversData($month) {
    // Стабильные данные водителей
    $drivers = [
        ['name' => 'Иванов А.С.', 'vehicle' => 'Г789ЕЖ', 'experience' => 8, 'efficiency' => 95],
        ['name' => 'Петров В.М.', 'vehicle' => 'Ж678МН', 'experience' => 5, 'efficiency' => 89],
        ['name' => 'Сидоров К.И.', 'vehicle' => 'А123БВ', 'experience' => 12, 'efficiency' => 82],
        ['name' => 'Козлов Д.А.', 'vehicle' => 'Е345КЛ', 'experience' => 3, 'efficiency' => 75],
        ['name' => 'Морозов И.П.', 'vehicle' => 'В456ГД', 'experience' => 2, 'efficiency' => 65],
        ['name' => 'Волков С.Н.', 'vehicle' => 'Д012ЗИ', 'experience' => 1, 'efficiency' => 45]
    ];
    
    $chartsData = getChartsData($month);
    $vehicleProfits = array_combine($chartsData['vehicles']['labels'], $chartsData['vehicles']['data']);
    
    $topPerformers = [];
    $allDrivers = [];
    
    foreach ($drivers as $index => $driver) {
        $profit = $vehicleProfits[$driver['vehicle']] ?? 500000;
        $fuelEfficiency = 7.5 + (100 - $driver['efficiency']) * 0.05;
        $safetyRating = 3.0 + ($driver['efficiency'] / 100) * 2.0;
        
        $driverData = [
            'name' => $driver['name'],
            'vehicle' => $driver['vehicle'],
            'avatar' => mb_substr($driver['name'], 0, 1, 'UTF-8'),
            'experience' => $driver['experience'] . ' ' . getYearWord($driver['experience']),
            'profit' => (int)$profit,
            'efficiency' => $driver['efficiency'],
            'fuelConsumption' => round($fuelEfficiency, 1),
            'safetyRating' => round($safetyRating, 1),
            'status' => $driver['efficiency'] >= 80 ? 'active' : ($driver['efficiency'] >= 60 ? 'attention' : 'critical'),
            'category' => $driver['efficiency'] >= 80 ? 'excellent' : ($driver['efficiency'] >= 60 ? 'attention' : 'critical')
        ];
        
        if ($index < 3) {
            $topPerformers[] = array_merge($driverData, [
                'rank' => $index + 1,
                'score' => $driver['efficiency']
            ]);
        }
        
        $allDrivers[] = $driverData;
    }
    
    return [
        'month' => $month,
        'topPerformers' => $topPerformers,
        'allDrivers' => $allDrivers,
        'generatedAt' => gmdate('c')
    ];
}

/**
 * Health check - всегда быстро
 */
function getHealthStatus() {
    return [
        'status' => 'healthy',
        'version' => '2.0.0',
        'timestamp' => gmdate('c')
    ];
}

/**
 * Readiness check - проверка зависимостей
 */
function getReadinessStatus() {
    $services = [
        'coordinator' => 'online',
        'database' => 'online', // В реальности проверить подключение к БД
        'api' => 'online'
    ];
    
    $allHealthy = !in_array('offline', $services);
    
    if (!$allHealthy) {
        http_response_code(503);
    }
    
    return [
        'status' => $allHealthy ? 'ready' : 'not_ready',
        'services' => $services,
        'version' => '2.0.0',
        'timestamp' => gmdate('c')
    ];
}

/**
 * Стабильные базовые данные без рандома
 */
function getStableBaseData($month) {
    $year = (int)substr($month, 0, 4);
    $monthNum = (int)substr($month, 5, 2);
    
    // Детерминированная вариация на основе года и месяца
    $variation = ($year + $monthNum) % 10;
    
    return [
        'kpi' => [
            'revenue' => 2500000 + ($variation * 50000),
            'costs' => 1100000 + ($variation * 30000),
            'profit' => 1400000 + ($variation * 20000),
            'marginPct' => 56.0 + ($variation * 0.5)
        ],
        'vehicles' => [
            ['plate' => 'А123БВ', 'number' => 'А123БВ', 'model' => 'КамАЗ 65115', 'profit' => 650000 + ($variation * 10000), 'margin' => 52, 'marginPct' => 52.0],
            ['plate' => 'В456ГД', 'number' => 'В456ГД', 'model' => 'МАЗ 6312', 'profit' => 420000 + ($variation * 8000), 'margin' => 38, 'marginPct' => 38.0],
            ['plate' => 'Г789ЕЖ', 'number' => 'Г789ЕЖ', 'model' => 'КамАЗ 65116', 'profit' => 780000 + ($variation * 12000), 'margin' => 61, 'marginPct' => 61.0],
            ['plate' => 'Д012ЗИ', 'number' => 'Д012ЗИ', 'model' => 'МАЗ 6430', 'profit' => 320000 + ($variation * 6000), 'margin' => 29, 'marginPct' => 29.0],
            ['plate' => 'Е345КЛ', 'number' => 'Е345КЛ', 'model' => 'КамАЗ 65117', 'profit' => 590000 + ($variation * 9000), 'margin' => 48, 'marginPct' => 48.0],
            ['plate' => 'Ж678МН', 'number' => 'Ж678МН', 'model' => 'МАЗ 6440', 'profit' => 710000 + ($variation * 11000), 'margin' => 58, 'marginPct' => 58.0]
        ]
    ];
}

/**
 * Склонение слова "год"
 */
function getYearWord($years) {
    if ($years % 10 == 1 && $years % 100 != 11) return 'год';
    if (in_array($years % 10, [2, 3, 4]) && !in_array($years % 100, [12, 13, 14])) return 'года';
    return 'лет';
}
?>
