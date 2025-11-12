// ===================================================================
// Файл: controllers/employeeController.js (ФИНАЛЬНАЯ УПРОЩЕННАЯ ВЕРСИЯ)
// ===================================================================
// Убраны предварительные проверки на дубликаты. Логика теперь полностью
// полагается на обработку ошибок UNIQUE constraint от базы данных,
// что делает код более простым и надежным.
// ===================================================================

const { sendEvent } = require('../event-emitter');

module.exports = (employeeService) => ({
    /**
     * Получает всех сотрудников.
     */
    getAllEmployees: async (req, res, next) => {
        try {
            const employees = await employeeService.getAll();
            res.json(employees);
        } catch (err) {
            console.error("Ошибка при получении списка сотрудников:", err);
            next(err);
        }
    },

    /**
     * Создает нового сотрудника.
     */
    createEmployee: async (req, res, next) => {
        try {
            // Фильтруем CSRF токен перед отправкой в БД
            const { _csrf, ...cleanData } = req.body;
            
            // Нормализуем patronymic - пустая строка остается пустой строкой
            const employeeData = { 
                ...cleanData, 
                patronymic: cleanData.patronymic === undefined ? null : cleanData.patronymic 
            };
            const newEmployee = await employeeService.create(employeeData);
            sendEvent({}, 'trips-updated');
            res.status(201).json(newEmployee);
        } catch (err) {
            // Явно отлавливаем ошибку уникальности от БД
            if (err.code === 'SQLITE_CONSTRAINT' && err.message.includes('UNIQUE constraint failed')) {
                console.warn('Контроллер поймал ошибку UNIQUE constraint при создании.');
                return res.status(409).json({ errors: [{ message: 'Сотрудник с таким ФИО уже существует.' }] });
            }
            console.error("Ошибка при создании сотрудника:", err);
            next(err);
        }
    },

    /**
     * Обновляет данные сотрудника.
     */
    updateEmployee: async (req, res, next) => {
        const { id } = req.params;
        try {
            // Фильтруем CSRF токен перед отправкой в БД
            const { _csrf, ...cleanData } = req.body;
            
            // Нормализуем patronymic - пустая строка остается пустой строкой
            // чтобы UNIQUE constraint работал корректно (NULL != NULL в SQLite)
            const employeeData = { 
                ...cleanData, 
                patronymic: cleanData.patronymic === undefined ? null : cleanData.patronymic 
            };
            const updatedEmployee = await employeeService.update(id, employeeData);
            
            if (!updatedEmployee) {
                return res.status(404).json({ errors: [{ message: 'Сотрудник не найден.' }] });
            }
            
            sendEvent({}, 'trips-updated');
            res.status(200).json(updatedEmployee);
        } catch (err) {
            // Явно отлавливаем ошибку уникальности от БД
            if (err.code === 'SQLITE_CONSTRAINT' && err.message.includes('UNIQUE constraint failed')) {
                console.warn('Контроллер поймал ошибку UNIQUE constraint при обновлении.');
                return res.status(409).json({ errors: [{ message: 'Другой сотрудник с таким ФИО уже существует.' }] });
            }
            console.error("Ошибка при обновлении сотрудника:", err);
            next(err);
        }
    },

    /**
     * "Удаляет" сотрудника (помечает как уволенного).
     */
    deleteEmployee: async (req, res, next) => {
        const { id } = req.params;
        try {
            // Вместо физического удаления помечаем сотрудника как уволенного
            const updatedEmployee = await employeeService.markAsFired(id);
            if (!updatedEmployee) {
                return res.status(404).json({ errors: [{ message: 'Сотрудник не найден.' }] });
            }
            sendEvent({}, 'trips-updated');
            res.status(200).json({ message: 'Сотрудник помечен как уволенный.' });
        } catch (err) {
            console.error("Ошибка при пометке сотрудника как уволенного:", err);
            next(err);
        }
    },

    /**
     * Получает полный профиль сотрудника.
     */
    getEmployeeProfile: async (req, res, next) => {
        try {
            const employeeId = parseInt(req.params.id, 10);
            const fullProfile = await employeeService.getFullEmployeeProfile(employeeId);
            if (!fullProfile) {
                return res.status(404).json({ errors: [{ message: 'Сотрудник не найден.' }] });
            }
            res.json(fullProfile);
        } catch (err) {
            console.error(`Ошибка при получении профиля для сотрудника ID ${req.params.id}:`, err);
            next(err);
        }
    },

    /**
     * Получает все командировки сотрудника.
     */
    getEmployeeTrips: async (req, res, next) => {
        try {
            const employeeId = parseInt(req.params.id, 10);
            const trips = await employeeService.getTripsForEmployee(employeeId);
            res.json(trips);
        } catch (err) {
            console.error(`Ошибка при получении командировок для сотрудника ID ${req.params.id}:`, err);
            next(err);
        }
    }
});