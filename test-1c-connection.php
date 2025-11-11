<?php
/**
 * Тестовый скрипт для проверки подключения к API 1С
 *
 * Проверяет доступность всех эндпоинтов и выводит структуру данных
 *
 * Использование: php test-1c-connection.php
 */

define('API_1C_BASE_URL', 'http://192.168.33.250/tk/hs/TransportAPI/api/v1');
define('API_1C_TOKEN', 'transport_api_2024_secret_key');

/**
 * Делает тестовый запрос к API
 */
function testEndpoint($endpoint, $params = []) {
    $url = API_1C_BASE_URL . '/' . $endpoint;

    if (!empty($params)) {
        $url .= '?' . http_build_query($params);
    }

    echo "\n========================================\n";
    echo "🔗 Тестирую: $endpoint\n";
    echo "URL: $url\n";
    echo "========================================\n";

    $ch = curl_init($url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        'Authorization: Bearer ' . API_1C_TOKEN,
        'Content-Type: application/json'
    ]);
    curl_setopt($ch, CURLOPT_TIMEOUT, 10);

    $startTime = microtime(true);
    $response = curl_exec($ch);
    $endTime = microtime(true);

    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $error = curl_error($ch);

    echo "⏱️  Время ответа: " . round(($endTime - $startTime) * 1000) . " мс\n";
    echo "📊 HTTP код: $httpCode\n";

    if ($httpCode === 200) {
        echo "✅ Успешно!\n\n";

        $data = json_decode($response, true);

        if (json_last_error() === JSON_ERROR_NONE) {
            $count = is_array($data) ? count($data) : 0;
            echo "📦 Получено записей: $count\n";

            if ($count > 0) {
                echo "\n📋 Структура первой записи:\n";
                echo json_encode($data[0], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE) . "\n";

                echo "\n🔑 Доступные поля:\n";
                foreach (array_keys($data[0]) as $field) {
                    $type = gettype($data[0][$field]);
                    echo "   - $field ($type)\n";
                }
            } else {
                echo "⚠️  Массив пустой (нет данных)\n";
            }
        } else {
            echo "❌ Ошибка парсинга JSON: " . json_last_error_msg() . "\n";
            echo "Ответ: " . substr($response, 0, 500) . "\n";
        }
    } else {
        echo "❌ Ошибка: $httpCode\n";
        if ($error) {
            echo "   cURL error: $error\n";
        }
        echo "   Ответ: $response\n";
    }

    curl_close($ch);
}

// ========================================
// ОСНОВНОЙ КОД
// ========================================

echo "╔════════════════════════════════════════╗\n";
echo "║  Тест подключения к API 1С            ║\n";
echo "╚════════════════════════════════════════╝\n";

echo "\n📍 Базовый URL: " . API_1C_BASE_URL . "\n";
echo "🔐 Токен: " . substr(API_1C_TOKEN, 0, 20) . "...\n";

// Тестируем все эндпоинты
testEndpoint('vehicles');
testEndpoint('drivers');
testEndpoint('contracts', [
    'date_from' => '2024-11-01',
    'date_to' => '2024-11-30'
]);
testEndpoint('driver-reports', [
    'date_from' => '2024-11-01',
    'date_to' => '2024-11-30'
]);

echo "\n╔════════════════════════════════════════╗\n";
echo "║  Тестирование завершено!              ║\n";
echo "╚════════════════════════════════════════╝\n\n";

echo "💡 Следующие шаги:\n";
echo "   1. Если все эндпоинты ✅ - переходите к настройке синхронизации\n";
echo "   2. Если есть ❌ - проверьте:\n";
echo "      - Доступность сервера 1С (192.168.33.250)\n";
echo "      - Правильность токена авторизации\n";
echo "      - Что вы запускаете скрипт из локальной сети\n";
echo "   3. Адаптируйте маппинг полей в sync-1c-to-supabase.php\n";
echo "      под структуру данных, которую вы видите выше\n\n";
