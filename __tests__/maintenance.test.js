// ===================================================================
// Файл: __tests__/maintenance.test.js
// Описание: Интеграционные тесты для модуля технического обслуживания
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

describe('Интеграционные тесты для модуля ТО (/api/maintenance/equipment)', () => {
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
      name: 'testuser_maintenance',
      position: 'Тестировщик',
      password: hashedPassword,
    });
    testUserId = userId;

    // Логинимся
    const loginRes = await agent
      .post('/api/login')
      .send({ name: 'testuser_maintenance', password: 'testpassword' });

    expect(loginRes.status).toBe(200);

    // Получаем CSRF токен
    const csrfRes = await agent.get('/api/csrf-token');
    csrfToken = csrfRes.body.csrfToken;
  });

  afterAll(async () => {
    await knex('maintenance_services').del();
    await knex('equipment').del();
    await knex('users').del();
    await knex.destroy();
  });

  beforeEach(async () => {
    // Очищаем данные перед каждым тестом
    await knex('maintenance_services').del();
    await knex('equipment').del();
  });

  describe('POST /api/maintenance/equipment', () => {
    it('должен успешно создать новое оборудование', async () => {
      const res = await agent
        .post('/api/maintenance/equipment')

        .send({
          name: 'Станок токарный',
          serial: 'SN-12345',
          startDate: '01.01.2020',
          services: [
            { work: 'Замена масла', frequency: '30 дней' },
            { work: 'Проверка механизмов', frequency: '90 дней' }
          ]
        });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('id');
      expect(res.body.name).toBe('Станок токарный');
      expect(res.body.serial).toBe('SN-12345');
      expect(res.body.services).toHaveLength(2);
    });

    it('должен вернуть ошибку 409 при попытке создать дубликат по заводскому номеру', async () => {
      // Создаем первое оборудование
      await agent
        .post('/api/maintenance/equipment')

        .send({
          name: 'Станок 1',
          serial: 'SN-DUPLICATE',
          startDate: '01.01.2020',
          services: []
        });

      // Пытаемся создать второе с таким же serial
      const res = await agent
        .post('/api/maintenance/equipment')

        .send({
          name: 'Станок 2',
          serial: 'SN-DUPLICATE',
          startDate: '01.01.2020',
          services: []
        });

      expect(res.status).toBe(409);
      expect(res.body.errors).toBeDefined();
    });

    it('должен вернуть ошибку 400, если не указано обязательное поле', async () => {
      const res = await agent
        .post('/api/maintenance/equipment')

        .send({
          name: 'Станок без серийника',
          // serial отсутствует
          startDate: '01.01.2020',
          services: []
        });

      expect(res.status).toBe(400);
      expect(res.body.errors).toBeDefined();
    });
  });

  describe('GET /api/maintenance/equipment', () => {
    it('должен вернуть пустой массив, если оборудования нет', async () => {
      const res = await agent.get('/api/maintenance/equipment');

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body).toHaveLength(0);
    });

    it('должен вернуть массив всего оборудования с видами ТО', async () => {
      // Создаем два оборудования
      await agent
        .post('/api/maintenance/equipment')

        .send({
          name: 'Станок A',
          serial: 'SN-A',
          startDate: '01.01.2020',
          services: [{ work: 'ТО-1', frequency: '30 дней' }]
        });

      await agent
        .post('/api/maintenance/equipment')

        .send({
          name: 'Станок B',
          serial: 'SN-B',
          startDate: '01.01.2020',
          services: [{ work: 'ТО-2', frequency: '60 дней' }]
        });

      const res = await agent.get('/api/maintenance/equipment');

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThanOrEqual(2);
      expect(res.body[0]).toHaveProperty('services');
    });
  });

  describe('PUT /api/maintenance/equipment/:id', () => {
    it('должен успешно обновить оборудование', async () => {
      // Создаем оборудование
      const createRes = await agent
        .post('/api/maintenance/equipment')

        .send({
          name: 'Станок для обновления',
          serial: 'SN-UPDATE',
          startDate: '01.01.2020',
          services: []
        });

      const equipmentId = createRes.body.id;

      // Обновляем
      const updateRes = await agent
        .put(`/api/maintenance/equipment/${equipmentId}`)

        .send({
          name: 'Станок обновлен',
          serial: 'SN-UPDATE',
          startDate: '01.06.2020',
          services: [{ work: 'Новый вид ТО', frequency: '15 дней' }]
        });

      expect(updateRes.status).toBe(200);
      expect(updateRes.body.name).toBe('Станок обновлен');
      expect(updateRes.body.services).toHaveLength(1);
    });

    it('должен вернуть ошибку 404 при обновлении несуществующего оборудования', async () => {
      const res = await agent
        .put('/api/maintenance/equipment/99999')

        .send({
          name: 'Не существует',
          serial: 'SN-FAKE',
          startDate: '01.01.2020',
          services: []
        });

      expect(res.status).toBe(404);
      expect(res.body.errors).toBeDefined();
    });
  });

  describe('DELETE /api/maintenance/equipment/:id', () => {
    it('должен успешно удалить оборудование и его виды ТО (каскадно)', async () => {
      // Создаем оборудование с видами ТО
      const createRes = await agent
        .post('/api/maintenance/equipment')

        .send({
          name: 'Станок для удаления',
          serial: 'SN-DELETE',
          startDate: '01.01.2020',
          services: [
            { work: 'Вид ТО 1', frequency: '30 дней' },
            { work: 'Вид ТО 2', frequency: '60 дней' }
          ]
        });

      const equipmentId = createRes.body.id;

      // Удаляем
      const deleteRes = await agent
        .delete(`/api/maintenance/equipment/${equipmentId}`)
;

      expect(deleteRes.status).toBe(200);

      // Проверяем, что оборудование удалено
      const getRes = await agent.get('/api/maintenance/equipment');
      const found = getRes.body.find(eq => eq.id === equipmentId);
      expect(found).toBeUndefined();

      // Проверяем, что виды ТО тоже удалены (каскадное удаление)
      const services = await knex('maintenance_services').where({ equipment_id: equipmentId });
      expect(services).toHaveLength(0);
    });

    it('должен вернуть ошибку 404 при удалении несуществующего оборудования', async () => {
      const res = await agent
        .delete('/api/maintenance/equipment/99999')
;

      expect(res.status).toBe(404);
      expect(res.body.errors).toBeDefined();
    });
  });
});
