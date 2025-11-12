// ===================================================================
// File: public/js/verification/main.js (Полная итоговая версия)
// Description: Главный скрипт и точка входа для страницы "График поверки".
//              Инициализирует все компоненты модуля.
// ===================================================================

import { fetchUserData } from '../dashboard/userData.js';
import { initializeVerificationList, reloadAndRenderList } from './verificationList.js';
import { initializeVerificationModal } from './verificationModal.js';
import { registerAdminErrorCallback } from '../common/api-client.js';
import { subscribe } from '../common/sse-client.js';
// Импортируем modals.js чтобы инициализация обработчиков произошла автоматически
import '../common/modals.js';

/**
 * Главная функция инициализации страницы "График поверки".
 * Вызывается после полной загрузки DOM.
 */
async function initializeVerificationPage() {
    // 1. Регистрируем глобальный обработчик ошибок API для этого модуля.
    //    Все ошибки, перехваченные в api-client, будут выводиться через toast.error.
    registerAdminErrorCallback((message) => {
        if (window.toast && typeof window.toast.error === 'function') {
            window.toast.error(message);
        } else {
            console.error('Admin API Error:', message);
        }
    });
    
    // 2. Загружаем данные пользователя для отображения в шапке страницы.
    await fetchUserData();

    // 3. Инициализируем основные компоненты страницы:
    //    - обработчики событий для списка (сортировка, фильтрация, клики)
    //    - обработчики событий для модальных окон (открытие, закрытие, сохранение)
    initializeVerificationList();
    initializeVerificationModal();

    // 4. Запускаем первоначальную загрузку данных с сервера и отрисовку списка оборудования.
    reloadAndRenderList();
    
    // 5. Настраиваем автоматическое обновление данных каждые 30 секунд
    setupAutoRefresh();
}

/**
 * Настраивает автоматическое обновление данных каждые 30 секунд.
 * Это позволяет всем пользователям видеть изменения, внесённые другими, без ручного обновления страницы.
 */
function setupAutoRefresh() {
    // Подписываемся на SSE события через единый клиент
    subscribe('verification-updated', () => {
        console.log('[SSE] Обновляю данные поверки...');
        reloadAndRenderList();
    });
    
    // Дополнительно перезагружаем данные каждые 30 секунд на случай потери SSE соединения
    setInterval(() => {
        console.log('[Auto-refresh] Обновление данных поверки...');
        reloadAndRenderList();
    }, 30000); // 30 секунд
}

// Запускаем всю логику после того, как HTML-структура страницы будет готова.
document.addEventListener('DOMContentLoaded', initializeVerificationPage);