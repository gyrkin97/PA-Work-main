// ===================================================================
// Файл: public/js/maintenance/index.js (ФИНАЛЬНАЯ ВЕРСИЯ 2.0)
// Описание: Главный файл-оркестратор модуля "Техническое обслуживание".
// Добавлена загрузка данных пользователя для новой шапки.
// ===================================================================

// Импортируем общие модули
import { getEquipment, clearCache } from '../common/api-client.js'; 
import { fetchUserData } from '../dashboard/userData.js';
import { subscribe } from '../common/sse-client.js';

// Импортируем дочерние компоненты этого модуля
import { initHeader } from './header.js';
import { initEquipmentTable, renderTable, clearTable } from './equipmentTable.js';
import { initEquipmentModal } from './equipmentModal.js';

// --- Локальное состояние модуля (кэш данных с сервера) ---
let allEquipment = [];
let currentYear = new Date().getFullYear();
let currentSearchQuery = '';

/**
 * Функция для полной перезагрузки данных с сервера и перерисовки UI.
 * Является коллбэком для дочерних компонентов.
 */
export async function reloadData() {
    const tableContainer = document.querySelector('#mainTable tbody');
    if (tableContainer) {
        tableContainer.innerHTML = '<tr><td colspan="18" style="text-align: center; padding: 20px;">Загрузка данных...</td></tr>';
    }

    try {
        // Очищаем кэш перед загрузкой, чтобы получить свежие данные
        clearCache('/api/maintenance/equipment');
        
        // Загружаем свежие данные с сервера
        console.log('[API] Запрос к /api/maintenance/equipment...');
        allEquipment = await getEquipment();
        console.log('[API] Получено оборудования:', allEquipment.length);
        console.log('[API] Данные:', allEquipment.map(e => ({ id: e.id, name: e.name, serial: e.serial })));
        // Применяем текущие фильтры и отрисовываем таблицу
        applyFiltersAndRender();
    } catch (error) {
        console.error("Ошибка загрузки данных ТО:", error);
        // В случае ошибки показываем сообщение в таблице
        clearTable("Ошибка загрузки данных. Попробуйте обновить страницу.");
        // Глобальный обработчик ошибок в api-client.js также покажет toast-уведомление
    }
}

/**
 * Применяет текущие фильтры (поиск) к данным и запускает перерисовку таблицы.
 */
export function applyFiltersAndRender() {
    const filtered = currentSearchQuery
        ? allEquipment.filter(item => 
            (item.name || '').toLowerCase().includes(currentSearchQuery) ||
            (item.serial || '').toLowerCase().includes(currentSearchQuery)
          )
        : allEquipment;
    
    console.log(`[Render] Всего оборудования: ${allEquipment.length}, после фильтра: ${filtered.length}`);
    if (allEquipment.length !== filtered.length) {
        console.log(`[Render] Поисковый запрос: "${currentSearchQuery}"`);
    }
    
    // Передаем отфильтрованные данные и текущий год для отрисовки
    renderTable(filtered, currentYear, allEquipment);
}

/**
 * Обновляет текущий год и перерисовывает таблицу.
 * @param {number} year - Новый выбранный год.
 */
export function setYear(year) {
    currentYear = year;
    // При смене года перерисовываем с учетом текущего поискового запроса
    applyFiltersAndRender();
}

/**
 * Обновляет текущий поисковый запрос.
 * @param {string} query - Новый поисковый запрос.
 */
export function setSearchQuery(query) {
    currentSearchQuery = query.toLowerCase().trim();
    applyFiltersAndRender();
}

/**
 * Возвращает данные по конкретному оборудованию.
 * Используется модальным окном для получения данных для редактирования.
 * @param {number} equipmentId - ID оборудования.
 * @returns {object|undefined}
 */
export function getEquipmentById(equipmentId) {
    return allEquipment.find(item => item.id === equipmentId);
}

/**
 * Главная функция инициализации модуля.
 */
async function initialize() {
    console.log('Initializing Maintenance Module...');

    // Загружаем данные пользователя для шапки в первую очередь
    await fetchUserData();

    // Инициализируем все дочерние компоненты, передавая им необходимые коллбэки
    initHeader(setYear, setSearchQuery);
    initEquipmentTable(reloadData, getEquipmentById);
    initEquipmentModal(reloadData);

    // Загружаем основные данные для таблицы
    await reloadData();
    
    console.log('Maintenance Module initialized successfully.');
}

/**
 * Настройка автоматического обновления данных каждые 30 секунд
 */
function setupAutoRefresh() {
    // Подписываемся на SSE события через единый клиент
    subscribe('maintenance-updated', () => {
        console.log('[SSE] Обновляю данные ТО...');
        reloadData();
    });
    
    // Дополнительно перезагружаем данные каждые 30 секунд на случай потери SSE соединения
    setInterval(() => {
        console.log('[Auto-refresh] Обновление данных ТО...');
        reloadData();
    }, 30000); // 30 секунд
}

// Запускаем все после полной загрузки DOM
document.addEventListener('DOMContentLoaded', () => {
    initialize();
    setupAutoRefresh();
});