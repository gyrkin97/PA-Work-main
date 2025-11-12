// ===================================================================
// File: public/js/eds/signatureModal.js (НОВЫЙ КОМПОНЕНТ, ПОЛНАЯ ВЕРСИЯ)
// ===================================================================

import { saveSignature } from '../common/api-client.js';
import { reloadAndRenderList } from './signatureList.js';
import DatePicker from '../components/datepicker.js';

// --- Элементы DOM ---
const modal = document.getElementById('employeeModal');
const elements = {
    modalTitle: document.getElementById('modalTitle'),
    form: document.getElementById('employeeForm'),
    fioInput: document.getElementById('fio'),
    positionSelect: document.getElementById('position'),
    innInput: document.getElementById('inn'),
    ecpNumberInput: document.getElementById('ecpNumber'),
    dateFromInput: document.getElementById('dateFrom'),
    dateToInput: document.getElementById('dateTo'),
    saveBtn: document.getElementById('saveBtn'),
    closeBtn: document.getElementById('closeModalBtn'),
};

let currentEditId = null;

// --- Управление состоянием модального окна ---
function openModal() {
    if (modal) {
        modal.classList.add('active');
        document.body.style.overflow = 'hidden';
    }
}

function closeModal() {
    if (modal) {
        modal.classList.remove('active');
        document.body.style.overflow = 'auto';
    }
}

/**
 * Открывает модальное окно для создания (employeeData = null) или редактирования.
 * @param {object|null} employeeData - Данные сотрудника для редактирования.
 */
export function openSignatureModal(employeeData = null) {
    elements.form.reset();
    currentEditId = employeeData ? employeeData.id : null;

    // Убедимся, что календари инициализированы перед использованием
    let fromDateInstance = elements.dateFromInput._datepickerInstance;
    let toDateInstance = elements.dateToInput._datepickerInstance;
    
    if (!fromDateInstance) {
        fromDateInstance = new DatePicker(elements.dateFromInput);
    }
    if (!toDateInstance) {
        toDateInstance = new DatePicker(elements.dateToInput);
    }
    
    if (employeeData) {
        elements.modalTitle.textContent = 'Редактировать сотрудника';
        elements.fioInput.value = employeeData.fio;
        elements.positionSelect.value = employeeData.position_key;
        elements.innInput.value = employeeData.inn;
        elements.ecpNumberInput.value = employeeData.ecp_number;
        
        // Устанавливаем даты (формат: yyyy-mm-dd из БД)
        if (employeeData.date_from) {
            fromDateInstance.setDate(employeeData.date_from, false);
        }
        if (employeeData.date_to) {
            toDateInstance.setDate(employeeData.date_to, false);
        }

    } else {
        elements.modalTitle.textContent = 'Добавить сотрудника';
        fromDateInstance.setDate(null, false);
        toDateInstance.setDate(null, false);
    }
    openModal();
}

/**
 * Обрабатывает сохранение данных из формы.
 */
async function handleSave() {
    if (!elements.form.checkValidity()) {
        elements.form.reportValidity();
        return;
    }

    const fromDateInstance = elements.dateFromInput._datepickerInstance;
    const toDateInstance = elements.dateToInput._datepickerInstance;
    
    if (!fromDateInstance || !toDateInstance) {
        window.toast.error('Ошибка: календари не инициализированы');
        return;
    }
    
    const selectedOption = elements.positionSelect.options[elements.positionSelect.selectedIndex];

    const employeeData = {
        fio: elements.fioInput.value.trim(),
        position_key: elements.positionSelect.value,
        position_name: selectedOption.text,
        inn: elements.innInput.value.trim(),
        ecp_number: elements.ecpNumberInput.value.trim(),
        date_from: fromDateInstance.getFormattedDate(),
        date_to: toDateInstance.getFormattedDate(),
    };
    
    // Валидация дат
    if (!employeeData.date_from || !employeeData.date_to) {
        window.toast.error('Пожалуйста, заполните даты действия ЭЦП');
        return;
    }
    
    console.log('[Client] Отправляем на сервер:', employeeData);
    console.log('[Client] ID:', currentEditId);
    
    const originalBtnText = elements.saveBtn.textContent;
    elements.saveBtn.disabled = true;
    elements.saveBtn.textContent = 'Сохранение...';

    try {
        await saveSignature(employeeData, currentEditId);
        window.toast.success(currentEditId ? 'Данные успешно обновлены!' : 'Сотрудник успешно добавлен!');
        closeModal();
        await reloadAndRenderList();
    } catch (error) {
        console.error('Ошибка сохранения ЭЦП:', error);
    } finally {
        elements.saveBtn.disabled = false;
        elements.saveBtn.textContent = originalBtnText;
    }
}

/**
 * Инициализирует все обработчики событий для модального окна.
 */
export function initSignatureModal() {
    // Инициализация календарей для полей дат
    if (!elements.dateFromInput._datepickerInstance) {
        new DatePicker(elements.dateFromInput);
    }
    if (!elements.dateToInput._datepickerInstance) {
        new DatePicker(elements.dateToInput);
    }

    // Кнопка "Добавить сотрудника" в шапке
    document.getElementById('addEmployeeBtn').addEventListener('click', () => openSignatureModal(null));
    
    // Кнопки внутри модального окна
    elements.saveBtn.addEventListener('click', handleSave);
    elements.closeBtn.addEventListener('click', closeModal);

    // Закрытие по клику на фон
    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeModal();
    });

    // Закрытие по клавише Escape
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && modal.classList.contains('active')) {
            closeModal();
        }
    });

    // Автоматическое обновление даты "Срок до" при изменении "Срок от"
    elements.dateFromInput.addEventListener('change', () => {
        const fromDateInstance = elements.dateFromInput._datepickerInstance;
        const toDateInstance = elements.dateToInput._datepickerInstance;
        if (!fromDateInstance || !toDateInstance) return;

        const fromDate = fromDateInstance.getDate();
        if (fromDate) {
            const newToDate = new Date(fromDate.getTime());
            newToDate.setFullYear(newToDate.getFullYear() + 1);
            newToDate.setDate(newToDate.getDate() - 1);
            toDateInstance.setDate(newToDate, true);
        } else {
            toDateInstance.setDate(null, true);
        }
    });
}