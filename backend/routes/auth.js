const express = require('express');
const router = express.Router();
const pool = require('../config/database');

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Логин и пароль обязательны' });
    }

    // Поиск пользователя
    const userQuery = `
      SELECT u.id, u.email, u.full_name, r.name as role, r.display_name as role_display
      FROM users u
      JOIN roles r ON u.role_id = r.id
      WHERE u.email = $1 AND u.password_hash = $2 AND u.is_active = true
    `;

    const result = await pool.query(userQuery, [email, password]);

    if (result.rows.length === 0) {
      return res.status(401).json({ message: 'Неверный логин или пароль' });
    }

    const user = result.rows[0];

    // Обновление времени последнего входа
    await pool.query('UPDATE users SET last_login = NOW() WHERE id = $1', [user.id]);

    res.json({
      user: {
        id: user.id,
        email: user.email,
        full_name: user.full_name,
        role: user.role,
        role_display: user.role_display,
      },
    });
  } catch (error) {
    console.error('Ошибка авторизации:', error);
    res.status(500).json({ message: 'Ошибка сервера' });
  }
});

module.exports = router;
