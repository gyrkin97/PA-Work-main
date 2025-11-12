// ===================================================================
// Файл: __tests__/eds.test.js
// Описание: Интеграционные тесты для модуля ЭЦП (электронные цифровые подписи)
// ===================================================================

const request = require('supertest');
const bcrypt = require('bcrypt');
const { createTestUser } = require('./helpers/testHelpers');

// Мокаем event-emitter перед импортом сервера
jest.mock('../event-emitter', () => ({
  sendEvent: jest.fn(),
  initializeSSE: jest.fn(),
}));

const app = require('../server');
const { knex } = require('../config/database');

describe('Интеграционные тесты для модуля ЭЦП (/api/eds)', () => {
  let agent;
  let csrfToken;
  let testUserId;

  beforeAll(async () => {
    // Применяем миграции
    await knex.migrate.latest();
    
    // Создаем агента для сохранения сессии
    agent = request.agent(app);

    // Создаем тестового пользователя
    const hashedPassword = await bcrypt.hash('testpassword', 10);
    const userId = await createTestUser(knex, {
      name: 'testuser_eds',
      position: 'Тестировщик',
      password: hashedPassword,
    });
    testUserId = userId;

    // Логинимся
    const loginRes = await agent
      .post('/api/login')
      .send({ name: 'testuser_eds', password: 'testpassword' });

    expect(loginRes.status).toBe(200);

    // Получаем CSRF токен
    const csrfRes = await agent.get('/api/csrf-token');
    csrfToken = csrfRes.body.csrfToken;
  });

  afterAll(async () => {
    await knex('digital_signatures').del();
    await knex('users').del();
    await knex.destroy();
  });

  beforeEach(async () => {
    // Очищаем данные перед каждым тестом
    await knex('digital_signatures').del();
  });

  describe('POST /api/eds', () => {
    it('должен успешно создать новую ЭЦП', async () => {
      const res = await agent
        .post('/api/eds')

        .send({
          fio: 'Иванов Иван Иванович',
          position_key: 'engineer',
          position_name: 'Инженер',
          inn: '123456789012',
          ecp_number: 'ECP-12345',
          date_from: '2024-01-01',
          date_to: '2025-01-01',
          avatar_color: 'blue'
        });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('id');
      expect(res.body.fio).toBe('Иванов Иван Иванович');
      expect(res.body.ecp_number).toBe('ECP-12345');
    });

    it('должен вернуть ошибку 409 при попытке создать дубликат по номеру ЭЦП', async () => {
      // Создаем первую ЭЦП
      await agent
        .post('/api/eds')

        .send({
          fio: 'Петров Петр Петрович',
          position_key: 'manager',
          position_name: 'Менеджер',
          inn: '111111111111',
          ecp_number: 'ECP-DUPLICATE',
          date_from: '2024-01-01',
          date_to: '2025-01-01'
        });

      // Пытаемся создать вторую с таким же номером
      const res = await agent
        .post('/api/eds')

        .send({
          fio: 'Сидоров Сидор Сидорович',
          position_key: 'engineer',
          position_name: 'Инженер',
          inn: '222222222222',
          ecp_number: 'ECP-DUPLICATE',
          date_from: '2024-01-01',
          date_to: '2025-01-01'
        });

      expect(res.status).toBe(409);
      expect(res.body.errors).toBeDefined();
    });

    it('должен вернуть ошибку 400, если не указано обязательное поле', async () => {
      const res = await agent
        .post('/api/eds')

        .send({
          fio: 'Тестов Тест Тестович',
          // Пропускаем обязательное поле position_key
          position_name: 'Тестировщик',
          inn: '333333333333',
          ecp_number: 'ECP-TEST',
          date_from: '2024-01-01',
          date_to: '2025-01-01'
        });

      expect(res.status).toBe(400);
      expect(res.body.errors).toBeDefined();
    });
  });

  describe('GET /api/eds', () => {
    it('должен вернуть пустой массив, если ЭЦП нет', async () => {
      const res = await agent.get('/api/eds');

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body).toHaveLength(0);
    });

    it('должен вернуть массив всех ЭЦП', async () => {
      // Создаем две ЭЦП
      await agent
        .post('/api/eds')

        .send({
          fio: 'Иванов А.А.',
          position_key: 'engineer',
          position_name: 'Инженер',
          inn: '111111111111',
          ecp_number: 'ECP-A',
          date_from: '2024-01-01',
          date_to: '2025-01-01'
        });

      await agent
        .post('/api/eds')

        .send({
          fio: 'Петров Б.Б.',
          position_key: 'manager',
          position_name: 'Менеджер',
          inn: '222222222222',
          ecp_number: 'ECP-B',
          date_from: '2024-01-01',
          date_to: '2025-01-01'
        });

      const res = await agent.get('/api/eds');

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('GET /api/eds/:id', () => {
    it('должен вернуть конкретную ЭЦП по ID', async () => {
      // Создаем ЭЦП
      const createRes = await agent
        .post('/api/eds')

        .send({
          fio: 'Иванов И.И.',
          position_key: 'engineer',
          position_name: 'Инженер',
          inn: '123456789012',
          ecp_number: 'ECP-GET-TEST',
          date_from: '2024-01-01',
          date_to: '2025-01-01'
        });

      const edsId = createRes.body.id;

      // Запрашиваем по ID
      const res = await agent.get(`/api/eds/${edsId}`);

      expect(res.status).toBe(200);
      expect(res.body.id).toBe(edsId);
      expect(res.body.fio).toBe('Иванов И.И.');
    });

    it('должен вернуть ошибку 404 для несуществующей ЭЦП', async () => {
      const res = await agent.get('/api/eds/99999');

      expect(res.status).toBe(404);
      expect(res.body.errors).toBeDefined();
    });
  });

  describe('PUT /api/eds/:id', () => {
    it('должен успешно обновить ЭЦП', async () => {
      // Создаем ЭЦП
      const createRes = await agent
        .post('/api/eds')

        .send({
          fio: 'Иванов И.И.',
          position_key: 'engineer',
          position_name: 'Инженер',
          inn: '123456789012',
          ecp_number: 'ECP-UPDATE',
          date_from: '2024-01-01',
          date_to: '2025-01-01'
        });

      const edsId = createRes.body.id;

      // Обновляем
      const updateRes = await agent
        .put(`/api/eds/${edsId}`)

        .send({
          fio: 'Иванов Иван Иванович (обновлен)',
          position_key: 'senior-engineer',
          position_name: 'Старший инженер',
          inn: '123456789012',
          ecp_number: 'ECP-UPDATE',
          date_from: '2024-01-01',
          date_to: '2026-01-01'
        });

      expect(updateRes.status).toBe(200);
      expect(updateRes.body.fio).toBe('Иванов Иван Иванович (обновлен)');
      expect(updateRes.body.position_name).toBe('Старший инженер');
    });

    it('должен вернуть ошибку 404 при обновлении несуществующей ЭЦП', async () => {
      const res = await agent
        .put('/api/eds/99999')

        .send({
          fio: 'Не существует',
          position_key: 'engineer',
          position_name: 'Инженер',
          inn: '000000000000',
          ecp_number: 'ECP-FAKE',
          date_from: '2024-01-01',
          date_to: '2025-01-01'
        });

      expect(res.status).toBe(404);
      expect(res.body.errors).toBeDefined();
    });
  });

  describe('DELETE /api/eds/:id', () => {
    it('должен успешно удалить ЭЦП', async () => {
      // Создаем ЭЦП
      const createRes = await agent
        .post('/api/eds')

        .send({
          fio: 'Иванов И.И.',
          position_key: 'engineer',
          position_name: 'Инженер',
          inn: '123456789012',
          ecp_number: 'ECP-DELETE',
          date_from: '2024-01-01',
          date_to: '2025-01-01'
        });

      const edsId = createRes.body.id;

      // Удаляем
      const deleteRes = await agent
        .delete(`/api/eds/${edsId}`)
;

      expect(deleteRes.status).toBe(200);

      // Проверяем, что удалена
      const getRes = await agent.get(`/api/eds/${edsId}`);
      expect(getRes.status).toBe(404);
    });

    it('должен вернуть ошибку 404 при удалении несуществующей ЭЦП', async () => {
      const res = await agent
        .delete('/api/eds/99999')
;

      expect(res.status).toBe(404);
      expect(res.body.errors).toBeDefined();
    });
  });

  describe('GET /api/eds/stats', () => {
    it('должен вернуть статистику по ЭЦП', async () => {
      // Создаем несколько ЭЦП для статистики
      await agent
        .post('/api/eds')

        .send({
          fio: 'Иванов А.А.',
          position_key: 'engineer',
          position_name: 'Инженер',
          inn: '111111111111',
          ecp_number: 'ECP-STATS-1',
          date_from: '2024-01-01',
          date_to: '2025-01-01'
        });

      await agent
        .post('/api/eds')

        .send({
          fio: 'Петров Б.Б.',
          position_key: 'manager',
          position_name: 'Менеджер',
          inn: '222222222222',
          ecp_number: 'ECP-STATS-2',
          date_from: '2024-01-01',
          date_to: '2025-01-01'
        });

      const res = await agent.get('/api/eds/stats');

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('total');
      expect(res.body.total).toBeGreaterThanOrEqual(2);
    });
  });
});
