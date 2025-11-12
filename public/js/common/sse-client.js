// ===================================================================
// Файл: public/js/common/sse-client.js
// Описание: Единый SSE клиент для всего приложения
// ===================================================================

let eventSource = null;
let eventListeners = {};

/**
 * Инициализирует SSE соединение (только один раз)
 */
export function initSSE() {
    if (eventSource) {
        console.log('[SSE] Соединение уже установлено');
        return eventSource;
    }

    if (typeof(EventSource) === "undefined") {
        console.warn("[SSE] EventSource не поддерживается браузером");
        return null;
    }

    console.log('[SSE] Создаю новое соединение...');
    eventSource = new EventSource('/api/events');
    
    eventSource.onopen = () => {
        console.log('[SSE] ✅ Соединение успешно установлено');
    };
    
    eventSource.onmessage = (e) => {
        console.log('[SSE] 📨 Получено сообщение (onmessage):', e.data, 'event:', e.type);
    };
    
    eventSource.onerror = (err) => {
        console.error('[SSE] ❌ Ошибка соединения:', err);
        console.error('[SSE] readyState:', eventSource?.readyState);
        // Не закрываем соединение - браузер автоматически переподключится
    };

    return eventSource;
}

/**
 * Подписывается на событие
 */
export function subscribe(eventName, callback) {
    console.log(`[SSE] subscribe() вызван для события: "${eventName}"`);
    const source = initSSE();
    if (!source) {
        console.warn(`[SSE] Не удалось подписаться на "${eventName}" - нет соединения`);
        return;
    }

    // Сохраняем callback для возможности отписки
    if (!eventListeners[eventName]) {
        console.log(`[SSE] Создаю первый слушатель для события: "${eventName}"`);
        eventListeners[eventName] = [];
        
        // Добавляем реальный слушатель только один раз для каждого типа события
        source.addEventListener(eventName, (e) => {
            console.log(`[SSE] 📨 Получено событие: ${eventName}`, 'данные:', e.data);
            console.log(`[SSE] Вызываю ${eventListeners[eventName].length} callback(s)`);
            // Вызываем все зарегистрированные callbacks
            eventListeners[eventName].forEach(cb => {
                try {
                    cb(e);
                } catch (error) {
                    console.error(`[SSE] Ошибка в обработчике ${eventName}:`, error);
                }
            });
        });
        console.log(`[SSE] addEventListener для "${eventName}" зарегистрирован`);
    }

    eventListeners[eventName].push(callback);
    console.log(`[SSE] Callback добавлен. Всего callbacks для "${eventName}": ${eventListeners[eventName].length}`);
}

/**
 * Отписывается от события
 */
export function unsubscribe(eventName, callback) {
    if (!eventListeners[eventName]) return;
    
    eventListeners[eventName] = eventListeners[eventName].filter(cb => cb !== callback);
    console.log(`[SSE] Подписка на событие "${eventName}" удалена`);
}

/**
 * Закрывает SSE соединение
 */
export function closeSSE() {
    if (eventSource) {
        eventSource.close();
        eventSource = null;
        eventListeners = {};
        console.log('[SSE] Соединение закрыто');
    }
}
