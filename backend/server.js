const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

// Создание папки для загрузок
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Логирование запросов
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Routes
const authRoutes = require('./routes/auth');
const statsRoutes = require('./routes/stats');
const tripsRoutes = require('./routes/trips');
const salaryRoutes = require('./routes/salary');
const uploadRoutes = require('./routes/upload');
const importHistoryRoutes = require('./routes/importHistory');
const routesRoutes = require('./routes/routes');
const vehiclesRoutes = require('./routes/vehicles');
const usersRoutes = require('./routes/users');
const analyticsRoutes = require('./routes/analytics');
const reportsRoutes = require("./routes/reports");
const fuelRoutes = require(./routes/fuel);
const driversRoutes = require('./routes/drivers');

app.use('/auth', authRoutes);
app.use('/stats', statsRoutes);
app.use('/trips', tripsRoutes);
app.use('/salary', salaryRoutes);
app.use('/upload', uploadRoutes);
app.use('/import-history', importHistoryRoutes);
app.use('/routes', routesRoutes);
app.use('/vehicles', vehiclesRoutes);
app.use('/drivers', driversRoutes);
app.use('/users', usersRoutes);
app.use('/analytics', analyticsRoutes);
app.use("/reports", reportsRoutes);
app.use(/fuel, fuelRoutes);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ message: 'Endpoint не найден' });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Ошибка сервера:', err);
  res.status(500).json({
    message: err.message || 'Внутренняя ошибка сервера',
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║   🚛  TL196 Backend API                                   ║
║                                                           ║
║   Сервер запущен на порту: ${PORT}                          ║
║   Режим: ${process.env.NODE_ENV || 'development'}                              ║
║   Время: ${new Date().toLocaleString('ru-RU')}            ║
║                                                           ║
║   Доступные endpoints:                                    ║
║   - POST /auth/login                                      ║
║   - GET  /stats                                           ║
║   - GET  /trips                                           ║
║   - GET  /salary                                          ║
║   - POST /upload                                          ║
║   - GET  /import-history                                  ║
║   - GET  /health                                          ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
  `);
});

module.exports = app;
