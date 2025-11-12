// ===================================================================
// Файл: services/eventLogService.js
// Описание: Сервис для логирования системных событий
// ===================================================================

const { knex } = require('../config/database');
const { sendEvent } = require('../event-emitter');

/**
 * Логирование события в систему
 */
async function logEvent({
    type,           // 'login', 'logout', 'register', 'approved', 'rejected', 'role-change', 'password-change', 'delete', 'failed-login'
    category,       // 'auth', 'user', 'security', 'system'
    title,
    userId = null,
    userName,
    description,
    ipAddress = null,
    adminId = null,
    adminName = null,
    status,         // 'success', 'warning', 'danger', 'info', 'pending'
    metadata = null
}) {
    try {
        const timestamp = new Date().toISOString();
        
        // Сохраняем в БД
        const [eventId] = await knex('system_events').insert({
            type,
            category,
            title,
            user_id: userId,
            user_name: userName,
            description,
            timestamp: timestamp,
            ip_address: ipAddress,
            admin_id: adminId,
            admin_name: adminName,
            status,
            metadata: metadata ? JSON.stringify(metadata) : null
        });
        
        console.log(`[EventLog] Событие сохранено: ${type} - ${title} (ID: ${eventId})`);
        
        // Отправляем событие через SSE всем подключенным клиентам
        try {
            sendEvent({
                id: eventId,
                type,
                category,
                title,
                user_name: userName,
                description,
                timestamp,
                ip_address: ipAddress,
                admin_name: adminName,
                status
            }, 'newEvent');
            console.log(`[EventLog] SSE событие отправлено: ${type} - ${title}`);
        } catch (sseError) {
            console.error('Ошибка при отправке SSE события:', sseError);
        }
    } catch (error) {
        console.error('Ошибка при логировании события:', error);
        // Не прерываем выполнение, если логирование не удалось
    }
}

/**
 * Получение всех событий с фильтрацией
 */
async function getEvents({ 
    type = null, 
    category = null, 
    period = 'month',
    search = null,
    limit = 100,
    offset = 0 
}) {
    try {
        let query = knex('system_events')
            .select('*')
            .orderBy('timestamp', 'desc');

        // Фильтр по типу
        if (type && type !== 'all') {
            query = query.where('type', type);
        }

        // Фильтр по категории
        if (category && category !== 'all') {
            query = query.where('category', category);
        }

        // Фильтр по периоду
        if (period && period !== 'all') {
            const now = new Date();
            let startDate;

            if (period === 'today') {
                startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            } else if (period === 'week') {
                startDate = new Date(now - 7 * 24 * 60 * 60 * 1000);
            } else if (period === 'month') {
                startDate = new Date(now - 30 * 24 * 60 * 60 * 1000);
            }

            if (startDate) {
                query = query.where('timestamp', '>=', startDate.toISOString());
            }
        }

        // Поиск по имени пользователя
        if (search) {
            query = query.where(function() {
                this.where('user_name', 'like', `%${search}%`)
                    .orWhere('description', 'like', `%${search}%`);
            });
        }

        // Пагинация
        query = query.limit(limit).offset(offset);

        const events = await query;

        // Преобразуем metadata из JSON
        return events.map(event => ({
            ...event,
            metadata: event.metadata ? JSON.parse(event.metadata) : null
        }));
    } catch (error) {
        console.error('Ошибка при получении событий:', error);
        return [];
    }
}

/**
 * Получение количества событий
 */
async function getEventsCount({ type = null, category = null, period = 'month', search = null }) {
    try {
        let query = knex('system_events').count('* as count');

        if (type && type !== 'all') {
            query = query.where('type', type);
        }

        if (category && category !== 'all') {
            query = query.where('category', category);
        }

        if (period && period !== 'all') {
            const now = new Date();
            let startDate;

            if (period === 'today') {
                startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            } else if (period === 'week') {
                startDate = new Date(now - 7 * 24 * 60 * 60 * 1000);
            } else if (period === 'month') {
                startDate = new Date(now - 30 * 24 * 60 * 60 * 1000);
            }

            if (startDate) {
                query = query.where('timestamp', '>=', startDate.toISOString());
            }
        }

        if (search) {
            query = query.where(function() {
                this.where('user_name', 'like', `%${search}%`)
                    .orWhere('description', 'like', `%${search}%`);
            });
        }

        const result = await query.first();
        return result ? result.count : 0;
    } catch (error) {
        console.error('Ошибка при подсчете событий:', error);
        return 0;
    }
}

/**
 * Удаление старых событий (опционально, для очистки)
 */
async function cleanOldEvents(daysToKeep = 90) {
    try {
        const cutoffDate = new Date(Date.now() - daysToKeep * 24 * 60 * 60 * 1000);
        const deleted = await knex('system_events')
            .where('timestamp', '<', cutoffDate.toISOString())
            .delete();
        
        console.log(`Удалено старых событий: ${deleted}`);
        return deleted;
    } catch (error) {
        console.error('Ошибка при очистке старых событий:', error);
        return 0;
    }
}

module.exports = {
    logEvent,
    getEvents,
    getEventsCount,
    cleanOldEvents
};
