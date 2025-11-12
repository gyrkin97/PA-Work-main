// ===================================================================
// File: public/js/dashboard/userData.js (ПОЛНАЯ ИСПРАВЛЕННАЯ ВЕРСИЯ)
// ===================================================================

import { handleApiError } from '../utils/api-error-handler.js';

function getInitials(fullName) {
    if (!fullName || typeof fullName !== 'string') return '--';
    const parts = fullName.trim().split(' ');
    if (parts.length >= 2 && parts[0] && parts[1]) {
        return (parts[0][0] + parts[1][0]).toUpperCase();
    } else if (parts.length === 1 && parts[0].length > 0) {
        return parts[0].substring(0, 2).toUpperCase();
    }
    return '--';
}

/**
 * Возвращает приветствие в зависимости от времени суток
 */
function getGreeting() {
    const hour = new Date().getHours();
    
    if (hour >= 6 && hour < 12) {
        return 'Доброе утро';
    } else if (hour >= 12 && hour < 18) {
        return 'Добрый день';
    } else if (hour >= 18 && hour < 23) {
        return 'Добрый вечер';
    } else {
        return 'Доброй ночи';
    }
}

/**
 * Извлекает имя из полного ФИО
 */
function getFirstName(fullName) {
    if (!fullName || typeof fullName !== 'string') return '';
    const parts = fullName.trim().split(' ');
    return parts.length >= 2 ? parts[1] : parts[0];
}

export async function fetchUserData() {
    try {
        // Используем корректный URL и ОБЯЗАТЕЛЬНО credentials: 'include'
        const response = await fetch('/api/current-user', {
            credentials: 'include'
        });
        
        // Используем общую обработку ошибок
        if (handleApiError(response, 'fetchUserData')) {
            return; // Функция уже выполнила перенаправление
        }
        
        const user = await response.json();

        // Сохраняем роль пользователя глобально для других скриптов
        window.currentUserRole = user.role;

        // Безопасно обновляем элементы, проверяя их наличие
        const userNameEl = document.querySelector('.user-name');
        const userRoleEl = document.querySelector('.user-role');
        const userAvatarEl = document.querySelector('.user-avatar');
        const greetingEl = document.getElementById('greeting-text');

        if (userNameEl) userNameEl.textContent = user.name;
        if (userRoleEl) userRoleEl.textContent = user.position;
        if (userAvatarEl) userAvatarEl.textContent = getInitials(user.name);
        
        // Обновляем приветствие
        if (greetingEl) {
            const firstName = getFirstName(user.name);
            greetingEl.textContent = `${getGreeting()}, ${firstName}!`;
        }

    } catch (error) {
        console.error('Ошибка при загрузке данных пользователя:', error);
        // При любой ошибке (включая сетевую) перенаправляем на вход
        window.location.href = '/';
    }
}