// ===================================================================
// Файл: __tests__/adminTests.test.js
// Описание: Расширенные тесты для админки тестирования
// ===================================================================

const path = require('path');
const knex = require('knex');

jest.mock('../event-emitter', () => ({
  sendEvent: jest.fn(),
  initializeSSE: jest.fn(),
}));

const { sendEvent } = require('../event-emitter');
const createTestService = require('../services/testService');
const createQuestionService = require('../services/questionService');
const createResultService = require('../services/resultService');

const MIGRATIONS_DIR = path.resolve(__dirname, '..', 'migrations');

function buildUuid(suffix) {
  return `00000000-0000-0000-0000-00000000000${suffix}`;
}

describe('Расширенные тесты админки тестирования', () => {
  let db;
  let testService;
  let questionService;
  let resultService;

  beforeAll(async () => {
    db = knex({
      client: 'sqlite3',
      connection: { filename: ':memory:' },
      useNullAsDefault: true,
    });
    await db.migrate.latest({ directory: MIGRATIONS_DIR });

    testService = createTestService(db);
    questionService = createQuestionService(db);
    resultService = createResultService(db);
  });

  afterEach(async () => {
    await db('answers').del();
    await db('results').del();
    await db('options').del();
    await db('questions').del();
    await db('test_settings').del();
    await db('tests').del();
    jest.clearAllMocks();
  });

  afterAll(async () => {
    await db.destroy();
  });

  describe('Создание и управление тестами', () => {
    it('должен успешно создать тест с настройками', async () => {
      const testId = buildUuid(1);
      await db('tests').insert({ id: testId, name: 'Тест по охране труда', is_active: true });
      await db('test_settings').insert({
        test_id: testId,
        duration_minutes: 30,
        questions_per_test: 10,
        passing_score: 7
      });

      const test = await db('tests').where({ id: testId }).first();
      expect(test.name).toBe('Тест по охране труда');
      expect(test.is_active).toBe(1);

      const settings = await db('test_settings').where({ test_id: testId }).first();
      expect(settings.duration_minutes).toBe(30);
      expect(settings.questions_per_test).toBe(10);
      expect(settings.passing_score).toBe(7);
    });

    it('должен обновить название теста', async () => {
      const testId = buildUuid(1);
      await db('tests').insert({ id: testId, name: 'Старое название', is_active: true });
      await db('test_settings').insert({
        test_id: testId,
        duration_minutes: 30,
        questions_per_test: 10,
        passing_score: 7
      });

      await testService.renameTest(testId, 'Новое название');

      const test = await db('tests').where({ id: testId }).first();
      expect(test.name).toBe('Новое название');
    });

    it('должен обновить статус теста', async () => {
      const testId = buildUuid(2);
      await db('tests').insert({ id: testId, name: 'Тест', is_active: true });
      await db('test_settings').insert({
        test_id: testId,
        duration_minutes: 30,
        questions_per_test: 10,
        passing_score: 7
      });

      await testService.updateTestStatus(testId, false);

      const test = await db('tests').where({ id: testId }).first();
      expect(test.is_active).toBe(0);
    });

    it('должен обновить настройки теста', async () => {
      const testId = buildUuid(3);
      await db('tests').insert({ id: testId, name: 'Тест', is_active: true });
      await db('test_settings').insert({
        test_id: testId,
        duration_minutes: 30,
        questions_per_test: 10,
        passing_score: 7
      });

      await testService.saveTestSettings(testId, {
        duration_minutes: 45,
        questions_per_test: 15,
        passing_score: 10
      });

      const settings = await db('test_settings').where({ test_id: testId }).first();
      expect(settings.duration_minutes).toBe(45);
      expect(settings.questions_per_test).toBe(15);
      expect(settings.passing_score).toBe(10);
    });

    it('должен удалить тест и все связанные данные', async () => {
      const testId = buildUuid(4);
      await db('tests').insert({ id: testId, name: 'Тест для удаления', is_active: true });
      await db('test_settings').insert({
        test_id: testId,
        duration_minutes: 30,
        questions_per_test: 10,
        passing_score: 7
      });

      const questionId = buildUuid('Q1');
      await db('questions').insert({
        id: questionId,
        test_id: testId,
        text: 'Вопрос для удаления',
        type: 'checkbox',
        correct_option_key: JSON.stringify(['A'])
      });

      await testService.deleteTest(testId);

      const test = await db('tests').where({ id: testId }).first();
      expect(test).toBeUndefined();

      const questions = await db('questions').where({ test_id: testId });
      expect(questions).toHaveLength(0);
    });
  });

  describe('Создание и управление вопросами', () => {
    let testId;

    beforeEach(async () => {
      testId = buildUuid(10);
      await db('tests').insert({ id: testId, name: 'Тест для вопросов', is_active: true });
      await db('test_settings').insert({
        test_id: testId,
        duration_minutes: 30,
        questions_per_test: 10,
        passing_score: 7
      });
    });

    it('должен создать вопрос с одиночным выбором', async () => {
      const questionData = {
        text: 'Какой ответ правильный?',
        type: 'radio',
        correct: ['A'],
        options: [
          { key: 'A', text: 'Правильный ответ' },
          { key: 'B', text: 'Неправильный ответ' }
        ]
      };

      const questionId = await questionService.create(testId, questionData);
      expect(questionId).toBeDefined();

      const question = await db('questions').where({ id: questionId }).first();
      expect(question.text).toBe('Какой ответ правильный?');
      expect(question.type).toBe('radio');
    });

    it('должен создать вопрос с множественным выбором', async () => {
      const questionData = {
        text: 'Выберите все правильные ответы',
        type: 'checkbox',
        correct: ['A', 'C'],
        options: [
          { text: 'Правильный 1' },
          { text: 'Неправильный' },
          { text: 'Правильный 2' }
        ]
      };

      const questionId = await questionService.create(testId, questionData);
      const question = await db('questions').where({ id: questionId }).first();
      expect(JSON.parse(question.correct_option_key)).toEqual(['A', 'C']);

      const options = await db('options').where({ question_id: questionId });
      expect(options).toHaveLength(3);
    });

    it('должен создать вопрос с текстовым вводом', async () => {
      const questionData = {
        text: 'Опишите процедуру',
        type: 'text_input',
        correct: []
      };

      const questionId = await questionService.create(testId, questionData);
      const question = await db('questions').where({ id: questionId }).first();
      expect(question.type).toBe('text_input');
    });

    it('должен обновить вопрос и его варианты ответов', async () => {
      const questionId = buildUuid('Q2');
      await db('questions').insert({
        id: questionId,
        test_id: testId,
        text: 'Старый текст вопроса',
        type: 'radio',
        correct_option_key: JSON.stringify(['A'])
      });

      await questionService.update({
        id: questionId,
        text: 'Новый текст вопроса',
        type: 'checkbox',
        correct: ['A', 'B'],
        options: [
          { text: 'Новый вариант А' },
          { text: 'Новый вариант Б' },
          { text: 'Новый вариант В' }
        ]
      });

      const question = await db('questions').where({ id: questionId }).first();
      expect(question.text).toBe('Новый текст вопроса');
      expect(question.type).toBe('checkbox');

      const options = await db('options').where({ question_id: questionId });
      expect(options).toHaveLength(3);
      expect(options.find(o => o.text === 'Новый вариант В')).toBeDefined();
    });

    it('должен удалить вопрос и его варианты ответов', async () => {
      const questionId = buildUuid('Q3');
      await db('questions').insert({
        id: questionId,
        test_id: testId,
        text: 'Вопрос для удаления',
        type: 'radio',
        correct_option_key: JSON.stringify(['A'])
      });

      await questionService.deleteByIds([questionId]);

      const question = await db('questions').where({ id: questionId }).first();
      expect(question).toBeUndefined();
    });
  });

  describe('Работа с результатами тестов', () => {
    let testId;

    beforeEach(async () => {
      testId = buildUuid(20);
      await db('tests').insert({ id: testId, name: 'Тест для результатов', is_active: true });
      await db('test_settings').insert({
        test_id: testId,
        duration_minutes: 30,
        questions_per_test: 10,
        passing_score: 7
      });
    });

    it('должен получить все результаты для теста', async () => {
      await db('results').insert([
        {
          test_id: testId,
          fio: 'Иванов Иван',
          score: 8,
          total: 10,
          percentage: 80,
          status: 'completed',
          passed: true,
          date: new Date().toISOString()
        },
        {
          test_id: testId,
          fio: 'Петров Петр',
          score: 5,
          total: 10,
          percentage: 50,
          status: 'completed',
          passed: false,
          date: new Date().toISOString()
        }
      ]);

      const results = await resultService.getPaginatedResults(testId, {
        page: 1,
        limit: 10
      });
      expect(results.results).toHaveLength(2);
      expect(results.totalPages).toBe(1);
    });

    it('должен фильтровать результаты по поиску', async () => {
      await db('results').insert([
        {
          test_id: testId,
          fio: 'Иванов Иван Иванович',
          score: 8,
          total: 10,
          percentage: 80,
          status: 'completed',
          passed: true,
          date: new Date().toISOString()
        },
        {
          test_id: testId,
          fio: 'Петров Петр Петрович',
          score: 5,
          total: 10,
          percentage: 50,
          status: 'completed',
          passed: false,
          date: new Date().toISOString()
        }
      ]);

      const results = await resultService.getPaginatedResults(testId, {
        search: 'Иванов',
        page: 1,
        limit: 10
      });
      expect(results.results).toHaveLength(1);
      expect(results.results[0].fio).toContain('Иванов');
    });

    it('должен сортировать результаты', async () => {
      await db('results').insert([
        {
          test_id: testId,
          fio: 'Аааа',
          score: 5,
          total: 10,
          percentage: 50,
          status: 'completed',
          passed: false,
          date: new Date('2025-01-01').toISOString()
        },
        {
          test_id: testId,
          fio: 'Яяяя',
          score: 8,
          total: 10,
          percentage: 80,
          status: 'completed',
          passed: true,
          date: new Date('2025-01-02').toISOString()
        }
      ]);

      const resultsByFio = await resultService.getPaginatedResults(testId, {
        sort: 'fio',
        order: 'asc',
        page: 1,
        limit: 10
      });
      expect(resultsByFio.results[0].fio).toBe('Аааа');

      const resultsByDate = await resultService.getPaginatedResults(testId, {
        sort: 'date',
        order: 'desc',
        page: 1,
        limit: 10
      });
      expect(resultsByDate.results[0].fio).toBe('Яяяя');
    });

    it('должен массово удалить результаты', async () => {
      const [id1] = await db('results').insert({
        test_id: testId,
        fio: 'Первый',
        score: 5,
        total: 10,
        percentage: 50,
        status: 'completed',
        passed: false,
        date: new Date().toISOString()
      });
      const [id2] = await db('results').insert({
        test_id: testId,
        fio: 'Второй',
        score: 8,
        total: 10,
        percentage: 80,
        status: 'completed',
        passed: true,
        date: new Date().toISOString()
      });

      const resultId1 = typeof id1 === 'object' ? id1.id : id1;
      const resultId2 = typeof id2 === 'object' ? id2.id : id2;

      const deletedCount = await resultService.deleteByIds([resultId1, resultId2]);
      expect(deletedCount).toBe(2);

      const results = await db('results').whereIn('id', [resultId1, resultId2]);
      expect(results).toHaveLength(0);
    });
  });

  describe('Статистика и аналитика', () => {
    it('должен корректно рассчитывать статистику теста', async () => {
      const testId = buildUuid(30);
      await db('tests').insert({ id: testId, name: 'Тест для статистики', is_active: true });
      await db('test_settings').insert({
        test_id: testId,
        duration_minutes: 30,
        questions_per_test: 10,
        passing_score: 7
      });

      // Добавляем результаты
      await db('results').insert([
        {
          test_id: testId,
          fio: 'Сдал 1',
          score: 8,
          total: 10,
          percentage: 80,
          status: 'completed',
          passed: true,
          date: new Date().toISOString()
        },
        {
          test_id: testId,
          fio: 'Сдал 2',
          score: 9,
          total: 10,
          percentage: 90,
          status: 'completed',
          passed: true,
          date: new Date().toISOString()
        },
        {
          test_id: testId,
          fio: 'Не сдал',
          score: 5,
          total: 10,
          percentage: 50,
          status: 'completed',
          passed: false,
          date: new Date().toISOString()
        },
        {
          test_id: testId,
          fio: 'На проверке',
          score: 0,
          total: 10,
          percentage: 0,
          status: 'pending_review',
          passed: false,
          date: new Date().toISOString()
        }
      ]);

      const analytics = await testService.getTestAnalytics(testId);

      expect(analytics.summaryStats.totalAttempts).toBe(4);
      expect(analytics.summaryStats.passRate).toBe(67); // 2 из 3 завершенных
      expect(analytics.summaryStats.averagePercentage).toBe(73); // (80 + 90 + 50) / 3
    });

    it('должен корректно определять самые сложные вопросы', async () => {
      const testId = buildUuid(31);
      await db('tests').insert({ id: testId, name: 'Тест сложности', is_active: true });
      await db('test_settings').insert({
        test_id: testId,
        duration_minutes: 30,
        questions_per_test: 2,
        passing_score: 1
      });

      const q1 = buildUuid('Q1');
      const q2 = buildUuid('Q2');
      await db('questions').insert([
        { id: q1, test_id: testId, text: 'Легкий вопрос', type: 'radio', correct_option_key: JSON.stringify(['A']) },
        { id: q2, test_id: testId, text: 'Сложный вопрос', type: 'radio', correct_option_key: JSON.stringify(['A']) }
      ]);

      const [r1] = await db('results').insert({
        test_id: testId,
        fio: 'Тестовый',
        score: 1,
        total: 2,
        percentage: 50,
        status: 'completed',
        passed: false,
        date: new Date().toISOString()
      });
      const resultId = typeof r1 === 'object' ? r1.id : r1;

      // Первый вопрос - 100% правильных ответов
      await db('answers').insert([
        { result_id: resultId, question_id: q1, user_answer: '["A"]', is_correct: true, review_status: 'auto' },
        { result_id: resultId, question_id: q2, user_answer: '["B"]', is_correct: false, review_status: 'auto' }
      ]);

      const analytics = await testService.getTestAnalytics(testId);
      
      expect(analytics.mostDifficultQuestions).toHaveLength(2);
      // Самый сложный вопрос должен быть первым (0% правильных ответов)
      expect(analytics.mostDifficultQuestions[0].text).toBe('Сложный вопрос');
    });
  });
});
