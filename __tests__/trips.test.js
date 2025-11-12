// ===================================================================
// Файл: __tests__/trips.test.js
// Описание: Интеграционные тесты для API командировок
// ===================================================================

const request = require('supertest');
const bcrypt = require('bcrypt');
const { createTestUser } = require('./helpers/testHelpers');
const app = require('../server');
const { knex } = require('../config/database');

describe('Интеграционные тесты для API командировок (/api/trips)', () => {
  let agent;
  let csrfToken;
  let testOrganizationId;
  let testEmployeeId1;
  let testEmployeeId2;

  beforeAll(async () => {
    await knex.migrate.latest();
    agent = request.agent(app);
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash('password123', saltRounds);
    await createTestUser(knex, {
      name: 'testuser',
      position: 'tester',
      password: hashedPassword
    });

    // Создаем тестовую организацию
    const [orgId] = await knex('organizations').insert({
      name: 'Тестовая организация',
      color: '#FF5733'
    }).returning('id');
    testOrganizationId = typeof orgId === 'object' ? orgId.id : orgId;

    // Создаем тестовых сотрудников
    const [emp1] = await knex('employees').insert({
      lastName: 'Тестовый',
      firstName: 'Сотрудник',
      patronymic: 'Первый',
      position: 'Инженер'
    }).returning('id');
    testEmployeeId1 = typeof emp1 === 'object' ? emp1.id : emp1;

    const [emp2] = await knex('employees').insert({
      lastName: 'Тестовый',
      firstName: 'Сотрудник',
      patronymic: 'Второй',
      position: 'Техник'
    }).returning('id');
    testEmployeeId2 = typeof emp2 === 'object' ? emp2.id : emp2;
  });

  beforeEach(async () => {
    await knex('trip_participants').del();
    await knex('trips').del();
    await agent
      .post('/api/login')
      .send({ name: 'testuser', password: 'password123' });
    const csrfResponse = await agent.get('/api/csrf-token');
    csrfToken = csrfResponse.body.csrfToken;
  });

  afterAll(async () => {
    await knex.destroy();
  });

  const makeProtectedRequest = (method, url, data = null) => {
    let req = agent[method.toLowerCase()](url)
      .set('Accept', 'application/json');
    if (csrfToken && ['post', 'put', 'delete'].includes(method.toLowerCase())) {
      req = req.set('x-csrf-token', csrfToken);
    }
    return data ? req.send(data) : req;
  };

  describe('POST /api/trips', () => {
    it('должен успешно создать новую командировку с участниками', async () => {
      const tripData = {
        organizationId: testOrganizationId,
        startDate: '2025-12-01',
        endDate: '2025-12-05',
        destination: 'Москва',
        transport: 'car',
        participants: [testEmployeeId1, testEmployeeId2]
      };

      const response = await makeProtectedRequest('post', '/api/trips', tripData);
      expect(response.status).toBe(201);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBe(2); // По одной записи для каждого участника
      
      const firstTrip = response.body[0];
      expect(firstTrip).toHaveProperty('id');
      expect(firstTrip.destination).toBe('Москва');
      expect(firstTrip.groupId).toBeDefined();
      
      // Проверяем что обе командировки имеют одинаковый groupId
      expect(response.body[0].groupId).toBe(response.body[1].groupId);
    });

    it('должен вернуть ошибку 400, если не указаны обязательные поля', async () => {
      const invalidData = {
        organizationId: testOrganizationId,
        startDate: '2025-12-01'
        // Отсутствуют endDate, destination, participants
      };

      const response = await makeProtectedRequest('post', '/api/trips', invalidData);
      expect(response.status).toBe(400);
      expect(response.body.errors.length).toBeGreaterThan(0);
    });

    it('должен вернуть ошибку 409 при конфликте дат сотрудника', async () => {
      // Создаем первую командировку
      const firstTrip = {
        organizationId: testOrganizationId,
        startDate: '2025-12-01',
        endDate: '2025-12-05',
        destination: 'Москва',
        transport: 'car',
        participants: [testEmployeeId1]
      };
      await makeProtectedRequest('post', '/api/trips', firstTrip);

      // Пытаемся создать пересекающуюся командировку
      const conflictingTrip = {
        organizationId: testOrganizationId,
        startDate: '2025-12-03',
        endDate: '2025-12-07',
        destination: 'Санкт-Петербург',
        transport: 'plane',
        participants: [testEmployeeId1]
      };

      const response = await makeProtectedRequest('post', '/api/trips', conflictingTrip);
      expect(response.status).toBe(409);
      expect(response.body.errors[0].message).toContain('уже занят');
    });

    it('должен вернуть ошибку 400, если endDate раньше startDate', async () => {
      const invalidTrip = {
        organizationId: testOrganizationId,
        startDate: '2025-12-05',
        endDate: '2025-12-01',
        destination: 'Москва',
        transport: 'car',
        participants: [testEmployeeId1]
      };

      const response = await makeProtectedRequest('post', '/api/trips', invalidTrip);
      expect(response.status).toBe(400);
    });
  });

  describe('GET /api/trips', () => {
    it('должен вернуть пустой массив, если командировок нет', async () => {
      const response = await makeProtectedRequest('get', '/api/trips');
      expect(response.status).toBe(200);
      expect(response.body).toEqual([]);
    });

    it('должен вернуть массив всех командировок с участниками', async () => {
      // Создаем две командировки
      const trip1 = {
        organizationId: testOrganizationId,
        startDate: '2025-12-01',
        endDate: '2025-12-05',
        destination: 'Москва',
        transport: 'car',
        participants: [testEmployeeId1]
      };
      const trip2 = {
        organizationId: testOrganizationId,
        startDate: '2025-12-10',
        endDate: '2025-12-15',
        destination: 'Казань',
        transport: 'train',
        participants: [testEmployeeId2]
      };

      await makeProtectedRequest('post', '/api/trips', trip1);
      await makeProtectedRequest('post', '/api/trips', trip2);

      const response = await makeProtectedRequest('get', '/api/trips');
      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(2);
      expect(response.body[0]).toHaveProperty('participants');
      expect(Array.isArray(response.body[0].participants)).toBe(true);
    });
  });

  describe('PUT /api/trips/:id', () => {
    it('должен успешно обновить командировку', async () => {
      const tripData = {
        organizationId: testOrganizationId,
        startDate: '2025-12-01',
        endDate: '2025-12-05',
        destination: 'Москва',
        transport: 'car',
        participants: [testEmployeeId1]
      };

      const createResponse = await makeProtectedRequest('post', '/api/trips', tripData);
      const tripId = createResponse.body[0].id; // Берём id из первого элемента массива

      const updateData = {
        organizationId: testOrganizationId,
        startDate: '2025-12-01',
        endDate: '2025-12-05',
        destination: 'Санкт-Петербург',
        transport: 'plane',
        participants: [testEmployeeId1]
      };

      const response = await makeProtectedRequest('put', `/api/trips/${tripId}`, updateData);
      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body[0].destination).toBe('Санкт-Петербург');
      expect(response.body[0].transport).toBe('plane');
    });

    it('должен вернуть ошибку 404 при обновлении несуществующей командировки', async () => {
      const updateData = {
        organizationId: testOrganizationId,
        startDate: '2025-12-01',
        endDate: '2025-12-05',
        destination: 'Москва',
        transport: 'car',
        participants: [testEmployeeId1]
      };

      const response = await makeProtectedRequest('put', '/api/trips/99999', updateData);
      expect(response.status).toBe(404);
    });
  });

  describe('DELETE /api/trips/:id', () => {
    it('должен успешно удалить командировку и её участников', async () => {
      const tripData = {
        organizationId: testOrganizationId,
        startDate: '2025-12-01',
        endDate: '2025-12-05',
        destination: 'Москва',
        transport: 'car',
        participants: [testEmployeeId1]
      };

      const createResponse = await makeProtectedRequest('post', '/api/trips', tripData);
      const tripId = createResponse.body[0].id; // Берём id из первого элемента массива

      const response = await makeProtectedRequest('delete', `/api/trips/${tripId}`);
      expect(response.status).toBe(200);

      // Проверяем что командировка удалена
      const tripInDb = await knex('trips').where({ id: tripId }).first();
      expect(tripInDb).toBeUndefined();
    });

    it('должен вернуть ошибку 404 при удалении несуществующей командировки', async () => {
      const response = await makeProtectedRequest('delete', '/api/trips/99999');
      expect(response.status).toBe(404);
    });
  });

  describe('Бизнес-логика командировок', () => {
    it('должен корректно рассчитывать пересечения дат', async () => {
      const trip1 = {
        organizationId: testOrganizationId,
        startDate: '2025-12-01',
        endDate: '2025-12-10',
        destination: 'Москва',
        transport: 'car',
        participants: [testEmployeeId1]
      };
      await makeProtectedRequest('post', '/api/trips', trip1);

      // Попытка создать командировку в последний день первой
      const trip2 = {
        organizationId: testOrganizationId,
        startDate: '2025-12-10',
        endDate: '2025-12-15',
        destination: 'Казань',
        transport: 'train',
        participants: [testEmployeeId1]
      };
      const response2 = await makeProtectedRequest('post', '/api/trips', trip2);
      expect(response2.status).toBe(409); // Конфликт, так как 10.12 входит в обе командировки

      // Командировка сразу после первой должна пройти
      const trip3 = {
        organizationId: testOrganizationId,
        startDate: '2025-12-11',
        endDate: '2025-12-15',
        destination: 'Казань',
        transport: 'train',
        participants: [testEmployeeId1]
      };
      const response3 = await makeProtectedRequest('post', '/api/trips', trip3);
      expect(response3.status).toBe(201);
    });

    it('должен позволять разным сотрудникам иметь пересекающиеся командировки', async () => {
      const trip1 = {
        organizationId: testOrganizationId,
        startDate: '2025-12-01',
        endDate: '2025-12-10',
        destination: 'Москва',
        transport: 'car',
        participants: [testEmployeeId1]
      };
      await makeProtectedRequest('post', '/api/trips', trip1);

      const trip2 = {
        organizationId: testOrganizationId,
        startDate: '2025-12-05',
        endDate: '2025-12-15',
        destination: 'Казань',
        transport: 'train',
        participants: [testEmployeeId2]
      };
      const response = await makeProtectedRequest('post', '/api/trips', trip2);
      expect(response.status).toBe(201);
    });
  });
});


