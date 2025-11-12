// ===================================================================
// Файл: public/js/trips/orgModal.js (ФИНАЛЬНАЯ УЛУЧШЕННАЯ ВЕРСИЯ)
// ===================================================================
//
// Этот модуль содержит всю логику для модального окна "Управление организациями",
// включая отображение списка, поиск, добавление новых организаций с проверкой
// на дубликаты и продвинутым алгоритмом выбора цвета.

import { state, mutations } from './state.js';
import { api } from '../common/api-client.js';
import { populateTripModal } from './modals/tripFormModal.js';
import { renderCalendar } from './calendar.js';

// Получаем ссылку на DOM-элемент модального окна
const modal = document.getElementById('organizations-modal');

// --- НАЧАЛО ИЗМЕНЕНИЙ: Продвинутый генератор цвета ---

// 1. Создаем глобальные переменные для нашего алгоритма
let colorIndex = 0; // Независимый счетчик, который будет только расти
const hueOffset = Math.random() * 360; // Случайная точка старта на цветовом круге

/**
 * Объект, инкапсулирующий всю логику для управления организациями.
 */
const orgManagementLogic = {
    /**
     * Проверяет, существует ли уже организация с таким названием (без учета регистра).
     * @param {string} name - Название организации для проверки.
     * @param {number} excludeId - ID организации, которую нужно исключить из проверки (при редактировании).
     * @returns {boolean} - true, если организация существует.
     */
    organizationExists(name, excludeId = null) {
        const normalizedInput = name.trim().toLowerCase();
        console.log('Проверка дубликата:', normalizedInput, 'excludeId:', excludeId);
        console.log('Все организации:', state.organizations.map(o => ({ id: o.id, name: o.name, normalized: o.name.toLowerCase() })));
        const exists = state.organizations.some(org => {
            if (excludeId && org.id === excludeId) return false; // Исключаем текущую организацию при редактировании
            return org.name.toLowerCase() === normalizedInput;
        });
        console.log('Существует?', exists);
        return exists;
    },

    /**
     * --- НОВЫЙ СУПЕР-АЛГОРИТМ ГЕНЕРАЦИИ ЦВЕТА ---
     * Возвращает процедурно сгенерированный, визуально различимый цвет в формате HSL.
     * Использует "золотой угол", случайную начальную точку и независимый счетчик.
     * @returns {string} - Цвет в формате HSL.
     */
    getNextColor() {
        const goldenAngle = 137.508;
        
        // 1. Оттенок (Hue): используем случайный сдвиг и независимый счетчик.
        const hue = (hueOffset + colorIndex * goldenAngle) % 360;

        // 2. Насыщенность (Saturation): варьируется в диапазоне 65-95%.
        const saturation = (colorIndex * 5) % 31 + 65;

        // 3. Светлота (Lightness): варьируется в диапазоне 40-60%.
        const lightness = (colorIndex * 7) % 21 + 40;

        return `hsl(${hue.toFixed(0)}, ${saturation}%, ${lightness}%)`;
    },

    // --- КОНЕЦ ИЗМЕНЕНИЙ в getNextColor ---

    /**
     * Фильтрует список организаций по поисковому запросу.
     * @param {string} query - Поисковый запрос.
     * @returns {Array<object>} - Отфильтрованный массив организаций.
     */
    filterOrganizations(query) {
        console.log('Фильтрация организаций, запрос:', query);
        console.log('Всего организаций в state:', state.organizations.length);
        
        if (!query.trim()) {
            return state.organizations;
        }
        const searchTerms = query.toLowerCase().split(' ').filter(term => term);
        const filtered = state.organizations.filter(org => {
            const orgName = org.name.toLowerCase();
            return searchTerms.every(term => orgName.includes(term));
        });
        
        console.log('Найдено организаций:', filtered.length);
        return filtered;
    },

    /**
     * Оборачивает найденные в тексте совпадения в тег <span class="search-highlight">
     * для визуальной подсветки при поиске.
     * @param {string} text - Исходный текст (название организации).
     * @param {string} query - Поисковый запрос.
     * @returns {string} - HTML-строка с подсвеченными совпадениями.
     */
    highlightMatches(text, query) {
        if (!query.trim()) {
            return text;
        }
        const searchTerms = query.toLowerCase().split(' ').filter(term => term);
        let result = text;
        searchTerms.forEach(term => {
            const regex = new RegExp(`(${term})`, 'gi');
            result = result.replace(regex, '<span class="search-highlight">$1</span>');
        });
        return result;
    },

    /**
     * Рендерит (отрисовывает) список организаций в модальном окне.
     */
    render() {
        const list = document.getElementById('organizations-list-managed');
        const resultsInfo = document.getElementById('org-search-results-info');
        const filteredOrgs = this.filterOrganizations(state.orgManagement.searchQuery);

        if (resultsInfo) {
            if (state.orgManagement.searchQuery.trim()) {
                resultsInfo.innerHTML = filteredOrgs.length === 0 
                    ? `По запросу "<strong>${state.orgManagement.searchQuery}</strong>" ничего не найдено`
                    : `Найдено организаций: <strong>${filteredOrgs.length}</strong>`;
            } else {
                resultsInfo.innerHTML = `Всего организаций: <strong>${state.organizations.length}</strong>`;
            }
        }

        if (!list) return;
        
        if (filteredOrgs.length === 0) {
            const emptyMessage = state.orgManagement.searchQuery.trim() ? 'Ничего не найдено' : 'Организации не добавлены';
            list.innerHTML = `<div class="empty-state"><div class="empty-state-icon"><i class="fas fa-building"></i></div><div>${emptyMessage}</div></div>`;
             return;
        }

        list.innerHTML = filteredOrgs.map(org => {
            const highlightedName = this.highlightMatches(org.name, state.orgManagement.searchQuery);
            return `
                <li class="organization-item" data-id="${org.id}">
                    <span class="color-dot" style="background-color: ${org.color}"></span>
                    <span class="organization-name">${highlightedName}</span>
                    <div class="item-actions">
                        <button class="js-edit-org-btn" data-id="${org.id}" title="Редактировать"></button>
                        <button class="js-delete-btn" data-id="${org.id}" title="Удалить организацию"></button>
                    </div>
                </li>`;
        }).join('');
    },
    
    /**
     * Обновляет превью цвета и проверяет на дубликаты при вводе в форме.
     */
    updateFormStateOnInput() {
        const nameInput = document.getElementById('org-form-name');
        const name = nameInput.value.trim();
        const errorElement = document.getElementById('org-name-error');
        const submitButton = document.getElementById('org-submit-button');
        const form = document.getElementById('org-form');
        const editingId = form ? parseInt(form.dataset.editingOrgId, 10) : null;

        if (name) {
            const newColor = this.getNextColor();
            document.getElementById('org-color-preview').style.backgroundColor = newColor;
            document.getElementById('org-color-text').textContent = `Авто-цвет`;

            if (this.organizationExists(name, editingId)) {
                nameInput.classList.add('error');
                if (errorElement) {
                    errorElement.style.display = 'flex';
                    document.getElementById('org-error-text').textContent = 'Организация с таким названием уже существует';
                }
                if (submitButton) submitButton.disabled = true;
            } else {
                nameInput.classList.remove('error');
                if (errorElement) errorElement.style.display = 'none';
                if (submitButton) submitButton.disabled = false;
            }
        } else {
            this.resetFormState();
        }
    },
    
    /**
     * Сбрасывает интерактивные элементы формы.
     */
    resetFormState() {
         document.getElementById('org-color-preview').style.backgroundColor = 'transparent';
         document.getElementById('org-color-text').textContent = 'Цвет будет выбран автоматически';
         const nameInput = document.getElementById('org-form-name');
         nameInput.classList.remove('error');
         const errorElement = document.getElementById('org-name-error');
         if(errorElement) errorElement.style.display = 'none';
         const submitButton = document.getElementById('org-submit-button');
         if (submitButton) submitButton.disabled = false;
    },

    /**
     * Полностью сбрасывает форму добавления организации.
     */
    resetForm() {
        const form = document.getElementById('organization-form-managed');
        if (form) form.reset();
        this.resetFormState();
    }
};

/**
 * Устанавливает все обработчики событий для модального окна управления организациями.
 */
export function setupOrgModal() {
    if (!modal) return;
    
    // --- НАЧАЛО ИЗМЕНЕНИЙ: Инициализация счетчика ---
    // 2. При первой настройке модального окна, устанавливаем счетчик равным
    //    количеству уже существующих организаций.
    colorIndex = state.organizations.length;
    // --- КОНЕЦ ИЗМЕНЕНИЙ ---

    const searchInput = modal.querySelector('#org-search-input');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            state.orgManagement.searchQuery = e.target.value;
            orgManagementLogic.render();
        });
    }
    
    const nameInput = modal.querySelector('#org-form-name');
    if (nameInput) {
        nameInput.addEventListener('input', () => {
            orgManagementLogic.updateFormStateOnInput();
        });
    }

    const form = modal.querySelector('#organization-form-managed');
    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const submitButton = form.querySelector('#org-submit-button');
            const currentNameInput = form.querySelector('#org-form-name');
            const name = currentNameInput.value.trim();
            const editingId = form.dataset.editingOrgId ? parseInt(form.dataset.editingOrgId, 10) : null;
            
            if (!name || orgManagementLogic.organizationExists(name, editingId)) return;
            
            try {
                if (submitButton) {
                    submitButton.disabled = true;
                    submitButton.textContent = editingId ? 'Сохранение...' : 'Добавление...';
                }

                if (editingId) {
                    // Редактирование существующей организации
                    const updatedOrg = await api.put(`/api/organizations/${editingId}`, { name });
                    mutations.updateOrganization(updatedOrg);
                    toast.success(`Организация "${updatedOrg.name}" успешно обновлена!`);
                } else {
                    // Добавление новой организации
                    const newOrgData = { name, color: orgManagementLogic.getNextColor() };
                    const addedOrg = await api.post('/api/organizations', newOrgData);
                    mutations.addOrganization(addedOrg);
                    colorIndex++;
                    toast.success(`Организация "${addedOrg.name}" успешно добавлена!`);
                }

                populateTripModal();
                renderCalendar();
                orgManagementLogic.render();
                orgManagementLogic.resetForm();
                
                // Сбрасываем режим редактирования
                delete form.dataset.editingOrgId;
                const formTitle = modal.querySelector('#org-form-title');
                const cancelBtn = document.getElementById('org-cancel-edit-btn');
                if (formTitle) formTitle.textContent = 'Добавить новую организацию';
                if (submitButton) submitButton.innerHTML = '<i class="fas fa-plus"></i> Добавить организацию';
                if (cancelBtn) cancelBtn.style.display = 'none';

            } catch(error) {
                let errorMessage = editingId ? 'Не удалось обновить организацию.' : 'Не удалось добавить организацию.';
                if (error.errors && Array.isArray(error.errors) && error.errors.length > 0) {
                    errorMessage = error.errors[0].message; 
                } else if (error.message) {
                    errorMessage = error.message;
                }
                toast.error(errorMessage);
            } finally {
                if (submitButton) {
                    submitButton.disabled = false;
                    submitButton.textContent = editingId ? 'Сохранить изменения' : 'Добавить организацию';
                }
            }
        });
    }
    
    // Обработчик клика по кнопке редактирования
    document.body.addEventListener('click', (e) => {
        const editButton = e.target.closest('.js-edit-org-btn');
        if (!editButton) return;
        
        const orgId = parseInt(editButton.dataset.id, 10);
        const org = state.organizations.find(o => o.id === orgId);
        if (!org) return;
        
        // Заполняем форму данными организации
        const form = document.getElementById('organization-form-managed');
        const nameInput = document.getElementById('org-form-name');
        const formTitle = modal.querySelector('#org-form-title');
        const submitButton = form.querySelector('#org-submit-button');
        const cancelBtn = document.getElementById('org-cancel-edit-btn');
        
        if (form) form.dataset.editingOrgId = orgId;
        if (nameInput) nameInput.value = org.name;
        if (formTitle) formTitle.textContent = 'Редактировать организацию';
        if (submitButton) submitButton.innerHTML = '<i class="fas fa-save"></i> Сохранить изменения';
        if (cancelBtn) cancelBtn.style.display = 'block';
        
        // Обновляем превью цвета
        document.getElementById('org-color-preview').style.backgroundColor = org.color;
        document.getElementById('org-color-text').textContent = 'Текущий цвет';
        
        // Скроллим к форме
        const formContainer = modal.querySelector('.org-add-section');
        if (formContainer) formContainer.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });
    
    // Обработчик кнопки отмены редактирования
    const cancelEditBtn = document.getElementById('org-cancel-edit-btn');
    if (cancelEditBtn) {
        cancelEditBtn.addEventListener('click', () => {
            const form = document.getElementById('organization-form-managed');
            const formTitle = modal.querySelector('#org-form-title');
            const submitButton = form.querySelector('#org-submit-button');
            
            // Сбрасываем форму
            orgManagementLogic.resetForm();
            
            // Сбрасываем режим редактирования
            delete form.dataset.editingOrgId;
            if (formTitle) formTitle.textContent = 'Добавить новую организацию';
            if (submitButton) submitButton.innerHTML = '<i class="fas fa-plus"></i> Добавить организацию';
            cancelEditBtn.style.display = 'none';
        });
    }
}

// Экспортируем функцию рендера для вызова извне
export const renderOrgList = orgManagementLogic.render.bind(orgManagementLogic);