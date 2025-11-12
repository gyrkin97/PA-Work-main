// =agreed
// File: controllers/edsController.js
// Description: Контроллер для обработки HTTP-запросов модуля ЭЦП.
// Версия 4.0: Улучшена обработка ошибок уникальности (UNIQUE constraint).
// ===================================================================

const edsService = require('../services/edsService');
const eventLogService = require('../services/eventLogService');

class EdsController {

  /**
   * Обрабатывает запрос на получение всех записей ЭЦП.
   */
  async getAll(req, res, next) {
    try {
      const signatures = await edsService.getAll();
      return res.status(200).json(signatures);
    } catch (error) {
      console.error('Ошибка в edsController.getAll:', error);
      // Передаем ошибку в централизованный обработчик ошибок Express
      next(error);
    }
  }

  /**
   * Обрабатывает запрос на получение одной записи ЭЦП по ID.
   */
  async getById(req, res, next) {
    try {
      const { id } = req.params;
      const signature = await edsService.getById(id);
      
      if (signature) {
        return res.status(200).json(signature);
      } else {
        // Если запись не найдена, отправляем корректный статус 404
        return res.status(404).json({ errors: [{ message: 'Запись ЭЦП с таким ID не найдена.' }] });
      }
    } catch (error) {
      console.error('Ошибка в edsController.getById:', error);
      next(error);
    }
  }

  /**
   * Обрабатывает запрос на получение статистики по ЭЦП для дашборда.
   */
  async getEdsStats(req, res, next) {
    try {
        const stats = await edsService.getEdsStats();
        return res.status(200).json(stats);
    } catch (error) {
        console.error("Ошибка в edsController.getEdsStats:", error);
        next(error);
    }
  }

  /**
   * Обрабатывает запрос на создание новой записи ЭЦП.
   */
  async create(req, res, next) {
    try {
      const { _csrf, ...data } = req.body; // Исключаем _csrf из данных
      const newSignatureResult = await edsService.create(data);
      // Knex с returning('*') всегда возвращает массив. Проверяем его.
      const newSignature = newSignatureResult ? newSignatureResult[0] : null;

      if (!newSignature) {
          // Если по какой-то причине запись не создалась, но ошибки не было,
          // отправляем общую серверную ошибку.
          throw new Error('Не удалось получить данные о созданной записи из БД.');
      }

      // Логируем событие создания ЭЦП
      await eventLogService.logEvent({
        userId: req.session?.user?.id || null,
        userName: req.session?.user?.name || 'Система',
        adminId: req.session?.user?.id || null,
        adminName: req.session?.user?.name || 'Система',
        type: 'create',
        category: 'system',
        title: 'Добавление ЭЦП',
        description: `Добавлена ЭЦП для сотрудника: ${data.fio || 'Неизвестно'}`,
        status: 'success',
        ipAddress: req.ip,
        metadata: {
          edsId: newSignature.id,
          employeeName: data.fio,
          ecpNumber: data.ecpNumber
        }
      });

      // Отправляем статус 201 Created с созданным объектом
      return res.status(201).json(newSignature);
    } catch (error) {
      console.error('Ошибка в edsController.create:', error);
      
      // Проверяем, является ли ошибка ошибкой уникальности для поля ecp_number
      if (error.code === 'SQLITE_CONSTRAINT' && error.message.includes('digital_signatures.ecp_number')) {
          // Если да, отправляем понятное сообщение об ошибке с кодом 409 (Conflict)
          return res.status(409).json({ errors: [{ message: 'Сотрудник с таким номером ЭЦП уже существует.' }] });
      }

      // Для всех остальных ошибок, передаем их в глобальный обработчик
      next(error);
    }
  }

  /**
   * Обрабатывает запрос на обновление существующей записи ЭЦП.
   */
  async update(req, res, next) {
    try {
      const { id } = req.params;
      const { _csrf, ...data } = req.body; // Исключаем _csrf из данных
      console.log('[EDS Update] ID:', id);
      console.log('[EDS Update] Clean Data (without _csrf):', JSON.stringify(data, null, 2));
      
      const updatedSignatureResult = await edsService.update(id, data);
      console.log('[EDS Update] Result:', updatedSignatureResult);
      
      const updatedSignature = updatedSignatureResult ? updatedSignatureResult[0] : null;
      
      if (updatedSignature) {
        // Логируем событие обновления ЭЦП
        await eventLogService.logEvent({
          userId: req.session?.user?.id || null,
          userName: req.session?.user?.name || 'Система',
          adminId: req.session?.user?.id || null,
          adminName: req.session?.user?.name || 'Система',
          type: 'update',
          category: 'system',
          title: 'Обновление ЭЦП',
          description: `Обновлена ЭЦП для сотрудника: ${data.fio || 'Неизвестно'}`,
          status: 'success',
          ipAddress: req.ip,
          metadata: {
            edsId: id,
            employeeName: data.fio
          }
        });

        return res.status(200).json(updatedSignature);
      } else {
        return res.status(404).json({ errors: [{ message: 'Не удалось найти запись для обновления.' }] });
      }
    } catch (error) {
      console.error('Ошибка в edsController.update:', error);

      // Проверяем, является ли ошибка ошибкой уникальности для поля ecp_number
      if (error.code === 'SQLITE_CONSTRAINT' && error.message.includes('digital_signatures.ecp_number')) {
          // Если да, отправляем понятное сообщение об ошибке с кодом 409 (Conflict)
          return res.status(409).json({ errors: [{ message: 'Этот номер ЭЦП уже присвоен другому сотруднику.' }] });
      }
      
      // Для всех остальных ошибок, передаем их в глобальный обработчик
      next(error);
    }
  }

  /**
   * Обрабатывает запрос на удаление записи ЭЦП.
   */
  async delete(req, res, next) {
    try {
      const { id } = req.params;
      
      // Получаем информацию об ЭЦП перед удалением для логирования
      const signature = await edsService.getById(id);
      
      const deletedRows = await edsService.delete(id);
      
      if (deletedRows > 0) {
        // Логируем событие удаления ЭЦП
        await eventLogService.logEvent({
          userId: req.session?.user?.id || null,
          userName: req.session?.user?.name || 'Система',
          adminId: req.session?.user?.id || null,
          adminName: req.session?.user?.name || 'Система',
          type: 'delete',
          category: 'system',
          title: 'Удаление ЭЦП',
          description: `Удалена ЭЦП для сотрудника: ${signature?.fio || 'Неизвестно'}`,
          status: 'success',
          ipAddress: req.ip,
          metadata: {
            edsId: id,
            employeeName: signature?.fio
          }
        });

        // Успешное удаление. Отправляем статус 200 с подтверждением
        return res.status(200).json({ message: 'Запись успешно удалена.' });
      } else {
        return res.status(404).json({ errors: [{ message: 'Запись для удаления не найдена.' }] });
      }
    } catch (error) {
      console.error('Ошибка в edsController.delete:', error);
      next(error);
    }
  }
}

// Экспортируем единственный экземпляр класса (Singleton)
module.exports = new EdsController();