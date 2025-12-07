const bcrypt = require('bcrypt');

const SALT_ROUNDS = 10;

/**
 * Хэширует пароль с использованием bcrypt
 * @param {string} password - Пароль в открытом виде
 * @returns {Promise<string>} - Хэшированный пароль
 */
async function hashPassword(password) {
    try {
        const hash = await bcrypt.hash(password, SALT_ROUNDS);
        return hash;
    } catch (error) {
        console.error('Ошибка хэширования пароля:', error);
        throw new Error('Не удалось хэшировать пароль');
    }
}

/**
 * Сравнивает пароль в открытом виде с хэшем
 * @param {string} password - Пароль в открытом виде
 * @param {string} hash - Хэшированный пароль из БД
 * @returns {Promise<boolean>} - true если пароли совпадают
 */
async function comparePassword(password, hash) {
    try {
        const isMatch = await bcrypt.compare(password, hash);
        return isMatch;
    } catch (error) {
        console.error('Ошибка сравнения пароля:', error);
        throw new Error('Не удалось проверить пароль');
    }
}

module.exports = {
    hashPassword,
    comparePassword
};
