// ===================================================================
// Файл: public/js/utils/session-monitor.js
// Описание: Мониторинг сессии пользователя
// ===================================================================

import { handleApiError } from './api-error-handler.js';

let monitoringInterval = null;

/**
 * Запускает мониторинг сессии пользователя
 * Проверяет каждые 10 секунд, что пользователь еще существует в системе
 */
export function startSessionMonitoring() {
    // Предотвращаем множественные запуски
    if (monitoringInterval) {
        return;
    }
    
    console.log('[SessionMonitor] Запуск мониторинга сессии');
    
    monitoringInterval = setInterval(async () => {
        try {
            const response = await fetch('/api/current-user', {
                credentials: 'include'
            });
            
            // Проверяем на критические ошибки (404, 401)
            handleApiError(response, 'SessionMonitor');
            
        } catch (error) {
            console.error('[SessionMonitor] Ошибка при проверке сессии:', error);
            // Не перенаправляем при сетевых ошибках, чтобы не выбрасывать пользователя
        }
    }, 10000); // Проверка каждые 10 секунд
}

/**
 * Останавливает мониторинг сессии
 */
export function stopSessionMonitoring() {
    if (monitoringInterval) {
        clearInterval(monitoringInterval);
        monitoringInterval = null;
        console.log('[SessionMonitor] Мониторинг остановлен');
    }
}
