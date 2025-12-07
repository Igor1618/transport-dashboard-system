#!/usr/bin/env node

const readline = require('readline');
const pool = require('../config/database');
const { hashPassword } = require('../utils/passwordUtils');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

function question(prompt) {
    return new Promise((resolve) => {
        rl.question(prompt, resolve);
    });
}

async function createSuperuser() {
    console.log('\n╔═══════════════════════════════════════════════════════════╗');
    console.log('║                                                           ║');
    console.log('║   🔐  Создание суперпользователя (Директор)             ║');
    console.log('║                                                           ║');
    console.log('╚═══════════════════════════════════════════════════════════╝\n');

    try {
        // Запрос данных пользователя
        const email = await question('Введите email (логин): ');

        if (!email || !email.trim()) {
            console.error('❌ Email не может быть пустым');
            rl.close();
            process.exit(1);
        }

        const password = await question('Введите пароль: ');

        if (!password || password.length < 8) {
            console.error('❌ Пароль должен содержать минимум 8 символов');
            rl.close();
            process.exit(1);
        }

        const confirmPassword = await question('Подтвердите пароль: ');

        if (password !== confirmPassword) {
            console.error('❌ Пароли не совпадают');
            rl.close();
            process.exit(1);
        }

        const fullName = await question('Введите полное имя: ');

        if (!fullName || !fullName.trim()) {
            console.error('❌ Полное имя не может быть пустым');
            rl.close();
            process.exit(1);
        }

        console.log('\n⏳ Создание пользователя...\n');

        // Проверка существования пользователя
        const existingUser = await pool.query(
            'SELECT id FROM users WHERE email = $1',
            [email.trim()]
        );

        if (existingUser.rows.length > 0) {
            console.error('❌ Пользователь с таким email уже существует');
            rl.close();
            process.exit(1);
        }

        // Получение ID роли директора
        const roleResult = await pool.query(
            "SELECT id FROM roles WHERE name = 'director'"
        );

        if (roleResult.rows.length === 0) {
            console.error('❌ Роль "director" не найдена в базе данных');
            console.error('   Убедитесь, что схема базы данных инициализирована');
            rl.close();
            process.exit(1);
        }

        const directorRoleId = roleResult.rows[0].id;

        // Хэширование пароля
        const hashedPassword = await hashPassword(password);

        // Создание пользователя
        const result = await pool.query(
            `INSERT INTO users (email, password_hash, full_name, role_id, is_active)
       VALUES ($1, $2, $3, $4, true)
       RETURNING id, email, full_name`,
            [email.trim(), hashedPassword, fullName.trim(), directorRoleId]
        );

        const newUser = result.rows[0];

        console.log('✅ Суперпользователь успешно создан!\n');
        console.log('📋 Детали:');
        console.log(`   ID: ${newUser.id}`);
        console.log(`   Email: ${newUser.email}`);
        console.log(`   Полное имя: ${newUser.full_name}`);
        console.log(`   Роль: Директор (полный доступ)\n`);
        console.log('🔐 Пароль успешно зашифрован и сохранен\n');

    } catch (error) {
        console.error('❌ Ошибка при создании пользователя:', error.message);
        process.exit(1);
    } finally {
        rl.close();
        await pool.end();
    }
}

// Запуск скрипта
createSuperuser();
