// ===================================================================
// Файл: controllers/tripController.js (ФИНАЛЬНАЯ ВЕРСИЯ ПОСЛЕ РЕФАКТОРИНГА)
// ===================================================================
// Контроллер переведен на стиль "фабрики функций" и полностью использует
// сервисный слой для работы с базой данных.
// ===================================================================

const { sendEvent } = require('../event-emitter');
const eventLogService = require('../services/eventLogService');

module.exports = (tripService, employeeService) => ({
    /**
     * Получает все командировки.
     */
    getAllTrips: async (req, res, next) => {
        try {
            const trips = await tripService.getAll(req.query);
            res.json(trips);
        } catch (err) {
            console.error("Ошибка при получении командировок:", err);
            next(err);
        }
    },

    /**
     * Создает новую командировку.
     */
    createTrip: async (req, res, next) => {
        try {
            const { _csrf, ...cleanData } = req.body;
            const { participants, startDate, endDate } = cleanData;
            
            const conflictingEmployee = await tripService.findConflictingEmployee(participants, startDate, endDate);
            if (conflictingEmployee) {
                const fullName = `${conflictingEmployee.lastName} ${conflictingEmployee.firstName}`;
                return res.status(409).json({ errors: [{ message: `Сотрудник ${fullName} уже занят в указанный период.` }] });
            }
            
            const createdTrips = await tripService.create(cleanData);
            
            // Логируем событие создания командировки
            const participantCount = participants?.length || 0;
            await eventLogService.logEvent({
                userId: req.session?.user?.id || null,
                userName: req.session?.user?.name || 'Система',
                adminId: req.session?.user?.id || null,
                adminName: req.session?.user?.name || 'Система',
                type: 'create',
                category: 'system',
                title: 'Создание командировки',
                description: `Создана командировка: ${cleanData.destination || 'Неизвестно'} (${participantCount} участник${participantCount !== 1 ? 'ов' : ''})`,
                status: 'success',
                ipAddress: req.ip,
                metadata: {
                    tripId: createdTrips[0]?.id,
                    destination: cleanData.destination,
                    participantCount
                }
            });

            employeeService.invalidateGlobalRecordsCache();
            sendEvent({}, 'trips-updated');
            return res.status(201).json(createdTrips);

        } catch (err) {
            console.error("Ошибка при создании командировки:", err);
            next(err);
        }
    },

    /**
     * Обновляет командировку.
     */
    updateTrip: async (req, res, next) => {
        const tripId = req.params.id;
        const { _csrf, ...cleanData } = req.body;
        const { participants, startDate, endDate } = cleanData;
        try {
            const conflictingEmployee = await tripService.findConflictingEmployee(participants, startDate, endDate, { excludeTripId: tripId });
            if (conflictingEmployee) {
                const fullName = `${conflictingEmployee.lastName} ${conflictingEmployee.firstName}`;
                return res.status(409).json({ errors: [{ message: `Сотрудник ${fullName} уже занят в указанный период.` }] });
            }
            
            const finalUpdatedTrip = await tripService.update(tripId, cleanData);
            if (!finalUpdatedTrip) {
                 return res.status(404).json({ errors: [{ message: 'Командировка для обновления не найдена.' }] });
            }

            // Логируем событие обновления командировки
            const participantCount = participants?.length || 0;
            await eventLogService.logEvent({
                userId: req.session?.user?.id || null,
                userName: req.session?.user?.name || 'Система',
                adminId: req.session?.user?.id || null,
                adminName: req.session?.user?.name || 'Система',
                type: 'update',
                category: 'system',
                title: 'Обновление командировки',
                description: `Обновлена командировка: ${cleanData.destination || 'Неизвестно'}`,
                status: 'success',
                ipAddress: req.ip,
                metadata: {
                    tripId,
                    destination: cleanData.destination,
                    participantCount
                }
            });

            employeeService.invalidateGlobalRecordsCache();
            sendEvent({}, 'trips-updated');
            return res.status(200).json(finalUpdatedTrip);

        } catch (err) {
            console.error("Ошибка при обновлении командировки:", err);
            next(err);
        }
    },

    /**
     * Удаляет командировку.
     */
    deleteTrip: async (req, res, next) => {
        const { id } = req.params;
        try {
            // Получаем информацию о командировке перед удалением
            const trip = await tripService.getById(id);
            
            const numDeleted = await tripService.deleteById(id);
            if (numDeleted === 0) {
                return res.status(404).json({ errors: [{ message: 'Командировка не найдена.' }] });
            }
            
            // Логируем событие удаления командировки
            await eventLogService.logEvent({
                userId: req.session?.user?.id || null,
                userName: req.session?.user?.name || 'Система',
                adminId: req.session?.user?.id || null,
                adminName: req.session?.user?.name || 'Система',
                type: 'delete',
                category: 'system',
                title: 'Удаление командировки',
                description: `Удалена командировка: ${trip?.destination || 'Неизвестно'}`,
                status: 'success',
                ipAddress: req.ip,
                metadata: {
                    tripId: id,
                    destination: trip?.destination
                }
            });

            employeeService.invalidateGlobalRecordsCache();
            sendEvent({}, 'trips-updated');
            return res.status(200).json({ message: 'Командировка успешно удалена.' });
        } catch (err) {
            console.error("Ошибка при удалении командировки:", err);
            next(err);
        }
    }
});