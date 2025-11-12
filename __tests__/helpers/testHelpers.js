// ===================================================================
// Файл: __tests__/helpers/testHelpers.js
// Описание: Вспомогательные функции для тестов
// ===================================================================

/**
 * Создает тестового пользователя с обязательными полями
 * @param {Object} knex - экземпляр Knex
 * @param {Object} userData - данные пользователя
 * @returns {Promise<number>} ID созданного пользователя
 */
async function createTestUser(knex, userData = {}) {
    const defaultData = {
        name: 'testuser',
        position: 'tester',
        password: 'hashedpassword',
        registrationDate: new Date().toISOString(),
        role: 'user'
    };

    const [userId] = await knex('users').insert({
        ...defaultData,
        ...userData
    });

    return userId;
}

module.exports = {
    createTestUser
};
