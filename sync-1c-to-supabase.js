#!/usr/bin/env node

/**
 * Скрипт синхронизации данных из 1С в Supabase
 *
 * Забирает данные из API 1С и загружает в Supabase для дашборда
 *
 * Использование:
 *   node sync-1c-to-supabase.js
 *
 * Или с параметрами:
 *   node sync-1c-to-supabase.js --date-from=2024-11-01 --date-to=2024-11-30
 */

// ========================================
// НАСТРОЙКИ
// ========================================

// API 1С
const API_1C_BASE_URL = 'http://192.168.33.250/tk/hs/TransportAPI/api/v1';
const API_1C_TOKEN = 'transport_api_2024_secret_key';

// Supabase
const SUPABASE_URL = 'http://195.26.226.37:8000';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiJ9.LGzLagUWLYU030_PrhQdahdHGhALq6agEyzf3KH3bI0';

// Даты по умолчанию (текущий месяц)
const now = new Date();
const DEFAULT_DATE_FROM = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
const DEFAULT_DATE_TO = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];

// ========================================
// ФУНКЦИИ ДЛЯ РАБОТЫ С API
// ========================================

/**
 * Делает запрос к API 1С
 */
async function fetch1CData(endpoint, params = {}) {
    const url = new URL(`${API_1C_BASE_URL}/${endpoint}`);
    Object.keys(params).forEach(key => url.searchParams.append(key, params[key]));

    console.log(`📡 Запрос к 1С: ${url}`);

    const response = await fetch(url, {
        headers: {
            'Authorization': `Bearer ${API_1C_TOKEN}`,
            'Content-Type': 'application/json'
        }
    });

    if (!response.ok) {
        throw new Error(`API 1С вернул ошибку: ${response.status} ${response.statusText}`);
    }

    return await response.json();
}

/**
 * Инициализирует Supabase клиент
 */
function initSupabase() {
    // Проверяем наличие библиотеки Supabase
    try {
        const { createClient } = require('@supabase/supabase-js');
        return createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    } catch (error) {
        console.error('❌ Ошибка: библиотека @supabase/supabase-js не установлена');
        console.error('   Установите её командой: npm install @supabase/supabase-js');
        process.exit(1);
    }
}

// ========================================
// СИНХРОНИЗАЦИЯ ДАННЫХ
// ========================================

/**
 * Синхронизирует транспортные средства
 */
async function syncVehicles(supabase) {
    console.log('\n🚛 Синхронизация транспортных средств...');

    try {
        const vehicles1C = await fetch1CData('vehicles');
        console.log(`   Получено из 1С: ${vehicles1C.length || 0} записей`);

        if (!vehicles1C || vehicles1C.length === 0) {
            console.log('   ⚠️  Нет данных для синхронизации');
            return;
        }

        // Маппинг данных из 1С в формат Supabase
        const vehiclesForSupabase = vehicles1C.map(v => ({
            // Предполагаемая структура - адаптируй под реальную!
            id: v.id || v.guid || v.uuid,
            number: v.number || v.regNumber || v.registrationNumber,
            model: v.model || v.vehicleModel || v.brand,
            // Добавь другие поля по необходимости
        }));

        // Upsert в Supabase (обновить если есть, создать если нет)
        const { data, error } = await supabase
            .from('vehicles')
            .upsert(vehiclesForSupabase, { onConflict: 'id' });

        if (error) {
            console.error('   ❌ Ошибка при сохранении:', error.message);
        } else {
            console.log(`   ✅ Синхронизировано: ${vehiclesForSupabase.length} машин`);
        }
    } catch (error) {
        console.error('   ❌ Ошибка:', error.message);
    }
}

/**
 * Синхронизирует водителей
 */
async function syncDrivers(supabase) {
    console.log('\n👨‍✈️ Синхронизация водителей...');

    try {
        const drivers1C = await fetch1CData('drivers');
        console.log(`   Получено из 1С: ${drivers1C.length || 0} записей`);

        if (!drivers1C || drivers1C.length === 0) {
            console.log('   ⚠️  Нет данных для синхронизации');
            return;
        }

        // Маппинг данных из 1С в формат Supabase
        const driversForSupabase = drivers1C.map(d => ({
            // Предполагаемая структура - адаптируй под реальную!
            id: d.id || d.guid || d.uuid,
            full_name: d.fullName || d.name || `${d.lastName} ${d.firstName}`,
            // Добавь другие поля
        }));

        const { data, error } = await supabase
            .from('drivers')
            .upsert(driversForSupabase, { onConflict: 'id' });

        if (error) {
            console.error('   ❌ Ошибка при сохранении:', error.message);
        } else {
            console.log(`   ✅ Синхронизировано: ${driversForSupabase.length} водителей`);
        }
    } catch (error) {
        console.error('   ❌ Ошибка:', error.message);
    }
}

/**
 * Синхронизирует договор-заявки и создает месячные данные по машинам
 */
async function syncContracts(supabase, dateFrom, dateTo) {
    console.log('\n📋 Синхронизация договор-заявок...');
    console.log(`   Период: ${dateFrom} - ${dateTo}`);

    try {
        const contracts1C = await fetch1CData('contracts', {
            date_from: dateFrom,
            date_to: dateTo
        });
        console.log(`   Получено из 1С: ${contracts1C.length || 0} записей`);

        if (!contracts1C || contracts1C.length === 0) {
            console.log('   ⚠️  Нет данных для синхронизации');
            return;
        }

        // Группируем данные по машинам и месяцам
        const vehicleMonthlyStats = {};

        contracts1C.forEach(contract => {
            const vehicleId = contract.vehicleId || contract.vehicle_id;
            const date = new Date(contract.date || contract.contractDate);
            const year = date.getFullYear();
            const month = date.getMonth() + 1; // 1-12

            const key = `${vehicleId}_${year}_${month}`;

            if (!vehicleMonthlyStats[key]) {
                vehicleMonthlyStats[key] = {
                    vehicle_id: vehicleId,
                    year: year,
                    month: month,
                    income: 0,
                    expenses: 0,
                    trips: 0,
                    efficiency: 0
                };
            }

            // Суммируем доходы/расходы
            vehicleMonthlyStats[key].income += parseFloat(contract.income || contract.revenue || 0);
            vehicleMonthlyStats[key].expenses += parseFloat(contract.expenses || contract.costs || 0);
            vehicleMonthlyStats[key].trips += 1;
        });

        // Рассчитываем эффективность (можно адаптировать формулу)
        Object.values(vehicleMonthlyStats).forEach(stat => {
            if (stat.income > 0) {
                stat.efficiency = Math.round(((stat.income - stat.expenses) / stat.income) * 100);
            }
        });

        const monthlyDataArray = Object.values(vehicleMonthlyStats);

        // Сохраняем в Supabase
        const { data, error } = await supabase
            .from('vehicle_monthly_data')
            .upsert(monthlyDataArray, { onConflict: 'vehicle_id,year,month' });

        if (error) {
            console.error('   ❌ Ошибка при сохранении:', error.message);
        } else {
            console.log(`   ✅ Синхронизировано: ${monthlyDataArray.length} записей месячных данных`);
        }
    } catch (error) {
        console.error('   ❌ Ошибка:', error.message);
    }
}

/**
 * Синхронизирует отчеты водителей
 */
async function syncDriverReports(supabase, dateFrom, dateTo) {
    console.log('\n📊 Синхронизация отчетов водителей...');
    console.log(`   Период: ${dateFrom} - ${dateTo}`);

    try {
        const reports1C = await fetch1CData('driver-reports', {
            date_from: dateFrom,
            date_to: dateTo
        });
        console.log(`   Получено из 1С: ${reports1C.length || 0} записей`);

        if (!reports1C || reports1C.length === 0) {
            console.log('   ⚠️  Нет данных для синхронизации');
            return;
        }

        // Здесь можно добавить логику обработки отчетов водителей
        // Например, рассчитать рейтинги, статистику и т.д.

        console.log('   ℹ️  Обработка отчетов водителей - в разработке');
    } catch (error) {
        console.error('   ❌ Ошибка:', error.message);
    }
}

// ========================================
// ОСНОВНАЯ ФУНКЦИЯ
// ========================================

async function main() {
    console.log('╔════════════════════════════════════════╗');
    console.log('║  Синхронизация 1С → Supabase          ║');
    console.log('╚════════════════════════════════════════╝\n');

    // Парсим аргументы командной строки
    const args = process.argv.slice(2);
    let dateFrom = DEFAULT_DATE_FROM;
    let dateTo = DEFAULT_DATE_TO;

    args.forEach(arg => {
        if (arg.startsWith('--date-from=')) {
            dateFrom = arg.split('=')[1];
        }
        if (arg.startsWith('--date-to=')) {
            dateTo = arg.split('=')[1];
        }
    });

    console.log(`📅 Период синхронизации: ${dateFrom} - ${dateTo}\n`);

    // Инициализируем Supabase
    const supabase = initSupabase();
    console.log('✅ Supabase клиент инициализирован\n');

    // Выполняем синхронизацию
    try {
        await syncVehicles(supabase);
        await syncDrivers(supabase);
        await syncContracts(supabase, dateFrom, dateTo);
        await syncDriverReports(supabase, dateFrom, dateTo);

        console.log('\n╔════════════════════════════════════════╗');
        console.log('║  ✅ Синхронизация завершена!          ║');
        console.log('╚════════════════════════════════════════╝\n');
    } catch (error) {
        console.error('\n❌ Критическая ошибка:', error.message);
        process.exit(1);
    }
}

// Запускаем скрипт
if (require.main === module) {
    main().catch(error => {
        console.error('❌ Ошибка выполнения:', error);
        process.exit(1);
    });
}

module.exports = { syncVehicles, syncDrivers, syncContracts, syncDriverReports };
