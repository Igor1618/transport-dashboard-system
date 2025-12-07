const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { checkRole } = require('../middleware/auth');
const { hashPassword } = require('../utils/passwordUtils');

// GET /api/users - Получить всех пользователей (Только директор)
router.get('/', checkRole(['director']), async (req, res) => {
  try {
    const query = `
      SELECT
        u.id,
        u.email,
        u.full_name,
        u.is_active,
        u.last_login,
        u.created_at,
        r.id as role_id,
        r.name as role,
        r.display_name as role_display
      FROM users u
      LEFT JOIN roles r ON u.role_id = r.id
      ORDER BY u.created_at DESC
    `;

    const result = await pool.query(query);
    res.json(result.rows);
  } catch (error) {
    console.error('Ошибка получения пользователей:', error);
    res.status(500).json({ message: 'Ошибка сервера' });
  }
});

// GET /api/users/roles - Получить все роли
router.get('/roles', async (req, res) => {
  try {
    const query = `
      SELECT id, name, display_name, description
      FROM roles
      ORDER BY display_name
    `;

    const result = await pool.query(query);
    res.json(result.rows);
  } catch (error) {
    console.error('Ошибка получения ролей:', error);
    res.status(500).json({ message: 'Ошибка сервера' });
  }
});

// POST /api/users - Создать нового пользователя (Только директор)
router.post('/', checkRole(['director']), async (req, res) => {
  try {
    const { email, password, full_name, role_id } = req.body;

    // Валидация
    if (!email || !password || !full_name || !role_id) {
      return res.status(400).json({
        message: 'Email, пароль, ФИО и роль обязательны'
      });
    }

    // Проверка существования email
    const existingUser = await pool.query(
      'SELECT id FROM users WHERE email = $1',
      [email]
    );

    if (existingUser.rows.length > 0) {
      return res.status(400).json({
        message: 'Пользователь с таким email уже существует'
      });
    }

    // Хэширование пароля
    const hashedPassword = await hashPassword(password);

    // Создание пользователя
    const query = `
      INSERT INTO users (email, password_hash, full_name, role_id)
      VALUES ($1, $2, $3, $4)
      RETURNING id, email, full_name, role_id, is_active, created_at
    `;

    const result = await pool.query(query, [email, hashedPassword, full_name, role_id]);

    res.status(201).json({
      message: 'Пользователь успешно создан',
      user: result.rows[0]
    });
  } catch (error) {
    console.error('Ошибка создания пользователя:', error);
    res.status(500).json({ message: 'Ошибка сервера' });
  }
});

// PUT /api/users/:id - Обновить пользователя (Только директор)
router.put('/:id', checkRole(['director']), async (req, res) => {
  try {
    const { id } = req.params;
    const { email, password, full_name, role_id, is_active } = req.body;

    // Проверка существования пользователя
    const existingUser = await pool.query(
      'SELECT id FROM users WHERE id = $1',
      [id]
    );

    if (existingUser.rows.length === 0) {
      return res.status(404).json({ message: 'Пользователь не найден' });
    }

    // Проверка уникальности email (если меняется)
    if (email) {
      const emailCheck = await pool.query(
        'SELECT id FROM users WHERE email = $1 AND id != $2',
        [email, id]
      );

      if (emailCheck.rows.length > 0) {
        return res.status(400).json({
          message: 'Пользователь с таким email уже существует'
        });
      }
    }

    // Формирование динамического запроса
    const updates = [];
    const values = [];
    let paramCounter = 1;

    if (email !== undefined) {
      updates.push(`email = $${paramCounter++}`);
      values.push(email);
    }
    if (password !== undefined && password !== '') {
      const hashedPassword = await hashPassword(password);
      updates.push(`password_hash = $${paramCounter++}`);
      values.push(hashedPassword);
    }
    if (full_name !== undefined) {
      updates.push(`full_name = $${paramCounter++}`);
      values.push(full_name);
    }
    if (role_id !== undefined) {
      updates.push(`role_id = $${paramCounter++}`);
      values.push(role_id);
    }
    if (is_active !== undefined) {
      updates.push(`is_active = $${paramCounter++}`);
      values.push(is_active);
    }

    updates.push(`updated_at = NOW()`);
    values.push(id);

    const query = `
      UPDATE users
      SET ${updates.join(', ')}
      WHERE id = $${paramCounter}
      RETURNING id, email, full_name, role_id, is_active, updated_at
    `;

    const result = await pool.query(query, values);

    res.json({
      message: 'Пользователь успешно обновлен',
      user: result.rows[0]
    });
  } catch (error) {
    console.error('Ошибка обновления пользователя:', error);
    res.status(500).json({ message: 'Ошибка сервера' });
  }
});

// DELETE /api/users/:id - Удалить пользователя (Только директор)
router.delete('/:id', checkRole(['director']), async (req, res) => {
  try {
    const { id } = req.params;

    // Проверка существования пользователя
    const existingUser = await pool.query(
      'SELECT id FROM users WHERE id = $1',
      [id]
    );

    if (existingUser.rows.length === 0) {
      return res.status(404).json({ message: 'Пользователь не найден' });
    }

    // Мягкое удаление (деактивация)
    await pool.query(
      'UPDATE users SET is_active = false, updated_at = NOW() WHERE id = $1',
      [id]
    );

    res.json({ message: 'Пользователь успешно деактивирован' });
  } catch (error) {
    console.error('Ошибка удаления пользователя:', error);
    res.status(500).json({ message: 'Ошибка сервера' });
  }
});

module.exports = router;
