<?php
/**
 * Скрипт синхронизации данных из 1С в Supabase (PHP версия)
 *
 * Забирает данные из API 1С и загружает в Supabase для дашборда
 *
 * Использование:
 *   php sync-1c-to-supabase.php
 *
 * Или с параметрами:
 *   php sync-1c-to-supabase.php 2024-11-01 2024-11-30
 */

// ========================================
// НАСТРОЙКИ
// ========================================

define('API_1C_BASE_URL', 'http://192.168.33.250/tk/hs/TransportAPI/api/v1');
define('API_1C_TOKEN', 'transport_api_2024_secret_key');

define('SUPABASE_URL', 'http://195.26.226.37:8000');
define('SUPABASE_ANON_KEY', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiJ9.LGzLagUWLYU030_PrhQdahdHGhALq6agEyzf3KH3bI0');

// Даты по умолчанию (текущий месяц)
$dateFrom = $argv[1] ?? date('Y-m-01');
$dateTo = $argv[2] ?? date('Y-m-t');

// ========================================
// ФУНКЦИИ ДЛЯ РАБОТЫ С API
// ========================================

/**
 * Делает запрос к API 1С
 */
function fetch1CData($endpoint, $params = []) {
    $url = API_1C_BASE_URL . '/' . $endpoint;

    if (!empty($params)) {
        $url .= '?' . http_build_query($params);
    }

    echo "📡 Запрос к 1С: $url\n";

    $ch = curl_init($url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        'Authorization: Bearer ' . API_1C_TOKEN,
        'Content-Type: application/json'
    ]);

    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);

    if ($httpCode !== 200) {
        $error = curl_error($ch);
        curl_close($ch);
        throw new Exception("API 1С вернул ошибку: $httpCode - $error");
    }

    curl_close($ch);

    $data = json_decode($response, true);

    if (json_last_error() !== JSON_ERROR_NONE) {
        throw new Exception("Ошибка парсинга JSON: " . json_last_error_msg());
    }

    return $data;
}

/**
 * Делает запрос к Supabase REST API
 */
function supabaseRequest($method, $table, $data = null, $upsert = false) {
    $url = SUPABASE_URL . "/rest/v1/$table";

    $ch = curl_init($url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_CUSTOMREQUEST, $method);

    $headers = [
        'apikey: ' . SUPABASE_ANON_KEY,
        'Authorization: Bearer ' . SUPABASE_ANON_KEY,
        'Content-Type: application/json',
        'Prefer: return=minimal'
    ];

    if ($upsert) {
        $headers[] = 'Prefer: resolution=merge-duplicates';
    }

    curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);

    if ($data !== null) {
        curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($data));
    }

    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);

    if ($httpCode >= 400) {
        $error = curl_error($ch);
        curl_close($ch);
        throw new Exception("Supabase API ошибка: $httpCode - $error - Response: $response");
    }

    curl_close($ch);

    return true;
}

// ========================================
// СИНХРОНИЗАЦИЯ ДАННЫХ
// ========================================

/**
 * Синхронизирует транспортные средства
 */
function syncVehicles() {
    echo "\n🚛 Синхронизация транспортных средств...\n";

    try {
        $vehicles1C = fetch1CData('vehicles');
        $count = is_array($vehicles1C) ? count($vehicles1C) : 0;
        echo "   Получено из 1С: $count записей\n";

        if (empty($vehicles1C)) {
            echo "   ⚠️  Нет данных для синхронизации\n";
            return;
        }

        // Маппинг данных из 1С в формат Supabase
        $vehiclesForSupabase = [];

        foreach ($vehicles1C as $v) {
            $vehiclesForSupabase[] = [
                // Предполагаемая структура - АДАПТИРУЙ под реальную структуру API!
                'id' => $v['id'] ?? $v['guid'] ?? $v['uuid'] ?? null,
                'number' => $v['number'] ?? $v['regNumber'] ?? $v['registrationNumber'] ?? '',
                'model' => $v['model'] ?? $v['vehicleModel'] ?? $v['brand'] ?? '',
                // Добавь другие поля по необходимости
            ];
        }

        // Upsert в Supabase
        supabaseRequest('POST', 'vehicles', $vehiclesForSupabase, true);

        echo "   ✅ Синхронизировано: " . count($vehiclesForSupabase) . " машин\n";

    } catch (Exception $e) {
        echo "   ❌ Ошибка: " . $e->getMessage() . "\n";
    }
}

/**
 * Синхронизирует водителей
 */
function syncDrivers() {
    echo "\n👨‍✈️ Синхронизация водителей...\n";

    try {
        $drivers1C = fetch1CData('drivers');
        $count = is_array($drivers1C) ? count($drivers1C) : 0;
        echo "   Получено из 1С: $count записей\n";

        if (empty($drivers1C)) {
            echo "   ⚠️  Нет данных для синхронизации\n";
            return;
        }

        // Маппинг данных из 1С в формат Supabase
        $driversForSupabase = [];

        foreach ($drivers1C as $d) {
            $driversForSupabase[] = [
                // Предполагаемая структура - АДАПТИРУЙ под реальную!
                'id' => $d['id'] ?? $d['guid'] ?? $d['uuid'] ?? null,
                'full_name' => $d['fullName'] ?? $d['name'] ??
                    ($d['lastName'] ?? '') . ' ' . ($d['firstName'] ?? ''),
                // Добавь другие поля
            ];
        }

        supabaseRequest('POST', 'drivers', $driversForSupabase, true);

        echo "   ✅ Синхронизировано: " . count($driversForSupabase) . " водителей\n";

    } catch (Exception $e) {
        echo "   ❌ Ошибка: " . $e->getMessage() . "\n";
    }
}

/**
 * Синхронизирует договор-заявки и создает месячные данные по машинам
 */
function syncContracts($dateFrom, $dateTo) {
    echo "\n📋 Синхронизация договор-заявок...\n";
    echo "   Период: $dateFrom - $dateTo\n";

    try {
        $contracts1C = fetch1CData('contracts', [
            'date_from' => $dateFrom,
            'date_to' => $dateTo
        ]);

        $count = is_array($contracts1C) ? count($contracts1C) : 0;
        echo "   Получено из 1С: $count записей\n";

        if (empty($contracts1C)) {
            echo "   ⚠️  Нет данных для синхронизации\n";
            return;
        }

        // Группируем данные по машинам и месяцам
        $vehicleMonthlyStats = [];

        foreach ($contracts1C as $contract) {
            $vehicleId = $contract['vehicleId'] ?? $contract['vehicle_id'] ?? null;

            if (!$vehicleId) {
                continue;
            }

            $date = strtotime($contract['date'] ?? $contract['contractDate'] ?? 'now');
            $year = (int)date('Y', $date);
            $month = (int)date('n', $date); // 1-12

            $key = "{$vehicleId}_{$year}_{$month}";

            if (!isset($vehicleMonthlyStats[$key])) {
                $vehicleMonthlyStats[$key] = [
                    'vehicle_id' => $vehicleId,
                    'year' => $year,
                    'month' => $month,
                    'income' => 0,
                    'expenses' => 0,
                    'trips' => 0,
                    'efficiency' => 0
                ];
            }

            // Суммируем доходы/расходы
            $vehicleMonthlyStats[$key]['income'] += floatval($contract['income'] ?? $contract['revenue'] ?? 0);
            $vehicleMonthlyStats[$key]['expenses'] += floatval($contract['expenses'] ?? $contract['costs'] ?? 0);
            $vehicleMonthlyStats[$key]['trips'] += 1;
        }

        // Рассчитываем эффективность
        foreach ($vehicleMonthlyStats as &$stat) {
            if ($stat['income'] > 0) {
                $stat['efficiency'] = round((($stat['income'] - $stat['expenses']) / $stat['income']) * 100);
            }
        }

        $monthlyDataArray = array_values($vehicleMonthlyStats);

        // Сохраняем в Supabase
        supabaseRequest('POST', 'vehicle_monthly_data', $monthlyDataArray, true);

        echo "   ✅ Синхронизировано: " . count($monthlyDataArray) . " записей месячных данных\n";

    } catch (Exception $e) {
        echo "   ❌ Ошибка: " . $e->getMessage() . "\n";
    }
}

/**
 * Синхронизирует отчеты водителей
 */
function syncDriverReports($dateFrom, $dateTo) {
    echo "\n📊 Синхронизация отчетов водителей...\n";
    echo "   Период: $dateFrom - $dateTo\n";

    try {
        $reports1C = fetch1CData('driver-reports', [
            'date_from' => $dateFrom,
            'date_to' => $dateTo
        ]);

        $count = is_array($reports1C) ? count($reports1C) : 0;
        echo "   Получено из 1С: $count записей\n";

        if (empty($reports1C)) {
            echo "   ⚠️  Нет данных для синхронизации\n";
            return;
        }

        // Здесь можно добавить логику обработки отчетов водителей
        echo "   ℹ️  Обработка отчетов водителей - в разработке\n";

    } catch (Exception $e) {
        echo "   ❌ Ошибка: " . $e->getMessage() . "\n";
    }
}

// ========================================
// ОСНОВНАЯ ФУНКЦИЯ
// ========================================

function main() {
    global $dateFrom, $dateTo;

    echo "╔════════════════════════════════════════╗\n";
    echo "║  Синхронизация 1С → Supabase          ║\n";
    echo "╚════════════════════════════════════════╝\n\n";

    echo "📅 Период синхронизации: $dateFrom - $dateTo\n\n";
    echo "✅ Начинаем синхронизацию...\n";

    try {
        syncVehicles();
        syncDrivers();
        syncContracts($dateFrom, $dateTo);
        syncDriverReports($dateFrom, $dateTo);

        echo "\n╔════════════════════════════════════════╗\n";
        echo "║  ✅ Синхронизация завершена!          ║\n";
        echo "╚════════════════════════════════════════╝\n\n";

    } catch (Exception $e) {
        echo "\n❌ Критическая ошибка: " . $e->getMessage() . "\n";
        exit(1);
    }
}

// Запускаем скрипт
main();
