// ===================================================================
// Файл: __tests__/dashboard.test.js
// Описание: Интеграционные тесты для дашборда и статистики
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

describe('Интеграционные тесты для дашборда (/api/stats)', () => {
  let agent;
  let testUserId;
  let testOrganizationId;
  let testEmployeeId1;
  let testEmployeeId2;

  beforeAll(async () => {
    // Применяем миграции
    await knex.migrate.latest();
    
    // Создаем агента для сохранения сессии
    agent = request.agent(app);

    // Создаем тестового пользователя
    const hashedPassword = await bcrypt.hash('testpassword', 10);
    const userId = await createTestUser(knex, {
      name: 'testuser_dashboard',
      position: 'Администратор',
      password: hashedPassword,
    });
    testUserId = userId;

    // Логинимся
    const loginRes = await agent
      .post('/api/login')
      .send({ name: 'testuser_dashboard', password: 'testpassword' });

    expect(loginRes.status).toBe(200);

    // Создаем тестовую организацию
    const [orgId] = await knex('organizations').insert({
      name: 'Тестовая организация для статистики',
      color: '#00FF00'
    });
    testOrganizationId = typeof orgId === 'object' ? orgId.id : orgId;

    // Создаем тестовых сотрудников
    const [emp1] = await knex('employees').insert({
      lastName: 'Статистов',
      firstName: 'Первый',
      patronymic: 'Тестович',
      position: 'Инженер'
    });
    testEmployeeId1 = typeof emp1 === 'object' ? emp1.id : emp1;

    const [emp2] = await knex('employees').insert({
      lastName: 'Статистов',
      firstName: 'Второй',
      patronymic: 'Тестович',
      position: 'Техник'
    });
    testEmployeeId2 = typeof emp2 === 'object' ? emp2.id : emp2;
  });

  afterAll(async () => {
    await knex('trip_participants').del();
    await knex('trips').del();
    await knex('employees').del();
    await knex('organizations').del();
    await knex('users').del();
    await knex.destroy();
  });

  beforeEach(async () => {
    // Очищаем командировки перед каждым тестом
    await knex('trip_participants').del();
    await knex('trips').del();
  });

  describe('GET /api/stats', () => {
    it('должен вернуть общую статистику по умолчанию (текущий год)', async () => {
      const res = await agent.get('/api/stats');

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('summary');
      expect(res.body.summary).toHaveProperty('totalTrips');
      expect(res.body.summary).toHaveProperty('totalCities');
      expect(res.body.summary).toHaveProperty('totalEmployees');
      expect(res.body).toHaveProperty('ranking');
      expect(res.body).toHaveProperty('transport');
      expect(res.body).toHaveProperty('monthly');
      expect(res.body).toHaveProperty('records');
    });

    it('должен вернуть статистику за указанный год', async () => {
      // Создаем командировки для разных лет
      const currentYear = new Date().getFullYear();
      
      // Командировка текущего года
      const [trip1] = await knex('trips').insert({
        organizationId: testOrganizationId,
        startDate: `${currentYear}-01-01`,
        endDate: `${currentYear}-01-05`,
        destination: 'Город А',
        status: 'completed'
      });

      await knex('trip_participants').insert({
        tripId: typeof trip1 === 'object' ? trip1.id : trip1,
        employeeId: testEmployeeId1
      });

      // Командировка прошлого года
      const [trip2] = await knex('trips').insert({
        organizationId: testOrganizationId,
        startDate: `${currentYear - 1}-01-01`,
        endDate: `${currentYear - 1}-01-05`,
        destination: 'Город Б',
        status: 'completed'
      });

      await knex('trip_participants').insert({
        tripId: typeof trip2 === 'object' ? trip2.id : trip2,
        employeeId: testEmployeeId2
      });

      // Получаем статистику за текущий год
      const resCurrentYear = await agent.get(`/api/stats?year=${currentYear}`);
      expect(resCurrentYear.status).toBe(200);
      expect(resCurrentYear.body.summary.totalTrips).toBeGreaterThanOrEqual(1);

      // Получаем статистику за прошлый год
      const resPastYear = await agent.get(`/api/stats?year=${currentYear - 1}`);
      expect(resPastYear.status).toBe(200);
      expect(resPastYear.body.summary.totalTrips).toBeGreaterThanOrEqual(1);
    });

    it('должен вернуть ошибку 400 при невалидном формате года', async () => {
      const res = await agent.get('/api/stats?year=abc');

      expect(res.status).toBe(400);
      expect(res.body.errors).toBeDefined();
      expect(res.body.errors[0].message).toContain('четырехзначным числом');
    });

    it('должен подсчитать количество командировок', async () => {
      // Создаем несколько командировок
      const currentYear = new Date().getFullYear();
      
      for (let i = 0; i < 3; i++) {
        const [tripId] = await knex('trips').insert({
          organizationId: testOrganizationId,
          startDate: `${currentYear}-01-${String(i + 1).padStart(2, '0')}`,
          endDate: `${currentYear}-01-${String(i + 5).padStart(2, '0')}`,
          destination: `Город ${i}`,
          status: 'completed'
        });

        await knex('trip_participants').insert({
          tripId: typeof tripId === 'object' ? tripId.id : tripId,
          employeeId: testEmployeeId1
        });
      }

      const res = await agent.get(`/api/stats?year=${currentYear}`);
      
      expect(res.status).toBe(200);
      expect(res.body.summary.totalTrips).toBeGreaterThanOrEqual(3);
    });

    it('должен вернуть списки самых посещаемых организаций и активных сотрудников', async () => {
      const currentYear = new Date().getFullYear();
      
      // Создаем несколько командировок
      const [tripId] = await knex('trips').insert({
        organizationId: testOrganizationId,
        startDate: `${currentYear}-01-01`,
        endDate: `${currentYear}-01-05`,
        destination: 'Тестовый город',
        status: 'completed'
      });

      await knex('trip_participants').insert({
        tripId: typeof tripId === 'object' ? tripId.id : tripId,
        employeeId: testEmployeeId1
      });

      const res = await agent.get(`/api/stats?year=${currentYear}`);
      
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.ranking)).toBe(true);
      expect(res.body.transport).toBeDefined();
    });
  });

  describe('GET /api/stats/geography', () => {
    it('должен вернуть географическую статистику', async () => {
      const currentYear = new Date().getFullYear();
      
      // Создаем командировки в разные места
      const destinations = ['Москва', 'Санкт-Петербург', 'Новосибирск'];
      
      for (const destination of destinations) {
        const [tripId] = await knex('trips').insert({
          organizationId: testOrganizationId,
          startDate: `${currentYear}-01-01`,
          endDate: `${currentYear}-01-05`,
          destination: destination,
          status: 'completed'
        });

        await knex('trip_participants').insert({
          tripId: typeof tripId === 'object' ? tripId.id : tripId,
          employeeId: testEmployeeId1
        });
      }

      const res = await agent.get(`/api/stats/geography?year=${currentYear}`);
      
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('topCities');
      expect(res.body).toHaveProperty('totalTrips');
      expect(Array.isArray(res.body.topCities)).toBe(true);
      expect(res.body.topCities.length).toBeGreaterThan(0);
    });

    it('должен фильтровать статистику по сотруднику', async () => {
      const currentYear = new Date().getFullYear();
      
      // Создаем командировки для разных сотрудников
      const [trip1] = await knex('trips').insert({
        organizationId: testOrganizationId,
        startDate: `${currentYear}-01-01`,
        endDate: `${currentYear}-01-05`,
        destination: 'Москва',
        status: 'completed'
      });

      await knex('trip_participants').insert({
        tripId: typeof trip1 === 'object' ? trip1.id : trip1,
        employeeId: testEmployeeId1
      });

      const [trip2] = await knex('trips').insert({
        organizationId: testOrganizationId,
        startDate: `${currentYear}-01-10`,
        endDate: `${currentYear}-01-15`,
        destination: 'Санкт-Петербург',
        status: 'completed'
      });

      await knex('trip_participants').insert({
        tripId: typeof trip2 === 'object' ? trip2.id : trip2,
        employeeId: testEmployeeId2
      });

      const res = await agent.get(`/api/stats/geography?year=${currentYear}&employeeId=${testEmployeeId1}`);
      
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('topCities');
      expect(Array.isArray(res.body.topCities)).toBe(true);
    });

    it('должен вернуть ошибку 400 при невалидном формате года', async () => {
      const res = await agent.get('/api/stats/geography?year=2024a');

      expect(res.status).toBe(400);
      expect(res.body.errors).toBeDefined();
    });
  });

  describe('GET /api/eds/stats', () => {
    beforeEach(async () => {
      // Очищаем ЭЦП
      await knex('digital_signatures').del();
    });

    it('должен вернуть статистику по ЭЦП', async () => {
      // Создаем несколько ЭЦП
      await knex('digital_signatures').insert([
        {
          fio: 'Тестов А.А.',
          position_key: 'engineer',
          position_name: 'Инженер',
          inn: '111111111111',
          ecp_number: 'ECP-STATS-1',
          date_from: '2024-01-01',
          date_to: '2025-01-01'
        },
        {
          fio: 'Тестов Б.Б.',
          position_key: 'manager',
          position_name: 'Менеджер',
          inn: '222222222222',
          ecp_number: 'ECP-STATS-2',
          date_from: '2024-06-01',
          date_to: '2025-06-01'
        }
      ]);

      const res = await agent.get('/api/eds/stats');

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('total');
      expect(res.body.total).toBeGreaterThanOrEqual(2);
    });
  });

  describe('Требование авторизации для статистики', () => {
    it('неавторизованный пользователь не должен получить доступ к статистике', async () => {
      const unauthAgent = request.agent(app);
      
      const endpoints = [
        '/api/stats',
        '/api/stats/geography',
        '/api/eds/stats'
      ];

      for (const endpoint of endpoints) {
        const res = await unauthAgent.get(endpoint);
        expect([401, 302]).toContain(res.status);
      }
    });
  });

  describe('Комплексный сценарий работы с дашбордом', () => {
    it('должен показать полную статистику после создания командировок', async () => {
      const currentYear = new Date().getFullYear();
      
      // Создаем организацию
      const [orgId] = await knex('organizations').insert({
        name: 'Комплексная организация',
        color: '#FF0000'
      });
      const organizationId = typeof orgId === 'object' ? orgId.id : orgId;

      // Создаем сотрудника
      const [empId] = await knex('employees').insert({
        lastName: 'Комплексный',
        firstName: 'Тест',
        patronymic: 'Тестович',
        position: 'Специалист'
      });
      const employeeId = typeof empId === 'object' ? empId.id : empId;

      // Создаем командировку на текущую дату (чтобы сотрудник считался активным)
      const today = new Date();
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      
      const [tripId] = await knex('trips').insert({
        organizationId: organizationId,
        employeeId: employeeId, // Добавляем employeeId для подсчёта активных сотрудников
        startDate: today.toISOString().split('T')[0],
        endDate: tomorrow.toISOString().split('T')[0],
        destination: 'Комплексный город',
        status: 'completed',
        transport: 'Самолет'
      });

      await knex('trip_participants').insert({
        tripId: typeof tripId === 'object' ? tripId.id : tripId,
        employeeId: employeeId
      });

      // Получаем общую статистику
      const statsRes = await agent.get(`/api/stats?year=${currentYear}`);
      expect(statsRes.status).toBe(200);
      expect(statsRes.body.summary.totalTrips).toBeGreaterThan(0);
      expect(statsRes.body.summary.totalCities).toBeGreaterThan(0);
      expect(statsRes.body.summary.totalEmployees).toBeGreaterThan(0);

      // Получаем географическую статистику
      const geoRes = await agent.get(`/api/stats/geography?year=${currentYear}`);
      expect(geoRes.status).toBe(200);
      expect(geoRes.body).toHaveProperty('topCities');
      expect(Array.isArray(geoRes.body.topCities)).toBe(true);

      // Получаем статистику по конкретному сотруднику
      const empGeoRes = await agent.get(`/api/stats/geography?year=${currentYear}&employeeId=${employeeId}`);
      expect(empGeoRes.status).toBe(200);
      expect(empGeoRes.body).toHaveProperty('topCities');
      expect(Array.isArray(empGeoRes.body.topCities)).toBe(true);
    });
  });
});
