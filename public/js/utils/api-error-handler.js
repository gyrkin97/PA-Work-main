// ===================================================================
// Файл: public/js/utils/api-error-handler.js
// Описание: Обработка ошибок API и перенаправления
// ===================================================================

/**
 * Обрабатывает ошибки от API и выполняет необходимые перенаправления
 * @param {Response} response - Объект ответа fetch
 * @param {string} context - Контекст вызова для логирования
 */
export function handleApiError(response, context = 'API') {
    if (!response.ok) {
        console.error(`Ошибка ${context}:`, response.status, response.statusText);
        
        if (response.status === 404) {
            // Пользователь удален из системы
            console.warn('Пользователь был удален из системы');
            window.location.href = '/access-denied';
            return true;
        } else if (response.status === 401) {
            // Пользователь не авторизован
            console.warn('Сессия истекла или пользователь не авторизован');
            window.location.href = '/';
            return true;
        }
    }
    return false;
}

/**
 * Безопасный fetch с автоматической обработкой ошибок пользователя
 * @param {string} url - URL для запроса
 * @param {Object} options - Опции fetch
 * @param {string} context - Контекст для логирования
 * @returns {Promise<Response|null>} Response или null если произошло перенаправление
 */
export async function safeFetch(url, options = {}, context = 'API') {
    try {
        const response = await fetch(url, {
            credentials: 'include',
            ...options
        });
        
        // Проверяем на критические ошибки
        if (handleApiError(response, context)) {
            return null;
        }
        
        return response;
    } catch (error) {
        console.error(`Ошибка сети при ${context}:`, error);
        throw error;
    }
}
