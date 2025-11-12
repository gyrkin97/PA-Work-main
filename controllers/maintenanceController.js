// ===================================================================
// Файл: controllers/maintenanceController.js (ФИНАЛЬНАЯ ВЕРСИЯ ПОСЛЕ РЕФАКТОРИНГА)
// ===================================================================
// Контроллер переведен на стиль "фабрики функций".
// ===================================================================

const { sendEvent } = require('../event-emitter');
const eventLogService = require('../services/eventLogService');

module.exports = (maintenanceService) => ({
    /**
     * Получает всё оборудование с их видами ТО.
     */
    getAllEquipment: async (req, res, next) => {
        try {
            const equipmentList = await maintenanceService.getAllEquipment();
            res.json(equipmentList);
        } catch (error) {
            console.error("Ошибка при получении оборудования:", error);
            next(error);
        }
    },

    /**
     * Создает новое оборудование.
     */
    createEquipment: async (req, res, next) => {
        try {
            // Фильтруем CSRF токен перед отправкой в БД
            const { _csrf, ...cleanData } = req.body;
            const equipmentData = cleanData;
            
            const newEquipment = await maintenanceService.createEquipment(equipmentData);
            
            // Логируем событие добавления оборудования
            const currentUser = req.session.user;
            if (currentUser) {
                try {
                    await eventLogService.logEvent({
                        type: 'create',
                        category: 'system',
                        title: 'Добавление оборудования',
                        userId: currentUser.id,
                        userName: currentUser.name || 'Система',
                        adminId: currentUser.id,
                        adminName: currentUser.name || 'Система',
                        description: `Добавлено оборудование в ТО: ${equipmentData.name || 'без названия'}`,
                        ipAddress: req.ip || req.connection.remoteAddress,
                        status: 'success',
                        metadata: { equipmentId: newEquipment.id, equipmentName: equipmentData.name }
                    });
                } catch (logError) {
                    console.error('Ошибка при логировании создания оборудования:', logError);
                }
            }
            
            console.log('[SSE] Отправляю событие maintenance-updated после создания оборудования');
            sendEvent({}, 'maintenance-updated');
            res.status(201).json(newEquipment);
        } catch (error) {
            console.error("Ошибка при создании оборудования:", error);
            if (error.message.includes('уже существует')) {
                return res.status(409).json({ errors: [{ message: error.message }] });
            }
            next(error);
        }
    },

    /**
     * Обновляет оборудование.
     */
    updateEquipment: async (req, res, next) => {
        try {
            const { id } = req.params;
            
            // Фильтруем CSRF токен перед отправкой в БД
            const { _csrf, ...cleanData } = req.body;
            const equipmentData = cleanData;
            
            const updatedEquipment = await maintenanceService.updateEquipment(id, equipmentData);
            
            if (!updatedEquipment) {
                return res.status(404).json({ errors: [{ message: 'Оборудование для обновления не найдено.' }] });
            }
            
            // Логируем событие обновления оборудования
            const currentUser = req.session.user;
            if (currentUser) {
                try {
                    await eventLogService.logEvent({
                        type: 'update',
                        category: 'system',
                        title: 'Обновление оборудования',
                        userId: currentUser.id,
                        userName: currentUser.name || 'Система',
                        adminId: currentUser.id,
                        adminName: currentUser.name || 'Система',
                        description: `Обновлено оборудование в ТО: ${equipmentData.name || 'без названия'}`,
                        ipAddress: req.ip || req.connection.remoteAddress,
                        status: 'success',
                        metadata: { equipmentId: id, equipmentName: equipmentData.name }
                    });
                } catch (logError) {
                    console.error('Ошибка при логировании обновления оборудования:', logError);
                }
            }
            
            sendEvent({}, 'maintenance-updated');
            res.status(200).json(updatedEquipment);
        } catch (error) {
            console.error(`Ошибка при обновлении оборудования ID ${req.params.id}:`, error);
            if (error.message.includes('уже существует')) {
                return res.status(409).json({ errors: [{ message: error.message }] });
            }
            next(error);
        }
    },

    /**
     * Удаляет оборудование.
     */
    deleteEquipment: async (req, res, next) => {
        try {
            const { id } = req.params;
            
            // Получаем информацию об оборудовании перед удалением
            const equipment = await maintenanceService.getEquipmentById(id);
            
            const success = await maintenanceService.deleteEquipment(id);
            
            if (!success) {
                return res.status(404).json({ errors: [{ message: 'Оборудование для удаления не найдено.' }] });
            }
            
            // Логируем событие удаления оборудования
            const currentUser = req.session.user;
            if (currentUser && equipment) {
                try {
                    await eventLogService.logEvent({
                        type: 'delete',
                        category: 'system',
                        title: 'Удаление оборудования',
                        userId: currentUser.id,
                        userName: currentUser.name || 'Система',
                        adminId: currentUser.id,
                        adminName: currentUser.name || 'Система',
                        description: `Удалено оборудование из ТО: ${equipment.name || 'без названия'}`,
                        ipAddress: req.ip || req.connection.remoteAddress,
                        status: 'success',
                        metadata: { equipmentId: id, equipmentName: equipment.name }
                    });
                } catch (logError) {
                    console.error('Ошибка при логировании удаления оборудования:', logError);
                }
            }
            
            sendEvent({}, 'maintenance-updated');
            res.status(200).json({ message: 'Оборудование и связанные ТО успешно удалены.' });
        } catch (error) {
            console.error(`Ошибка при удалении оборудования ID ${req.params.id}:`, error);
            next(error);
        }
    }
});