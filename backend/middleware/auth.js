const checkRole = (allowedRoles) => {
    return (req, res, next) => {
        // В реальном приложении здесь должна быть проверка токена или сессии
        // Так как текущая реализация может не иметь полноценной аутентификации на бэкенде,
        // мы добавим базовую проверку.

        // TODO: Интегрировать с middleware аутентификации, который добавляет req.user

        const userRole = req.headers['x-user-role']; // Временное решение: передаем роль в заголовке (НЕБЕЗОПАСНО для продакшена, но ок для прототипа)

        if (!userRole) {
            return res.status(401).json({ message: 'Не авторизован' });
        }

        if (allowedRoles.includes(userRole)) {
            next();
        } else {
            res.status(403).json({ message: 'Нет доступа' });
        }
    };
};

module.exports = { checkRole };
