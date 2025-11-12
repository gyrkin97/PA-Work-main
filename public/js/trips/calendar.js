// ===================================================================
// File: public/js/trips/calendar.js (ВЕРСИЯ С ИНДИВИДУАЛЬНЫМИ КОМАНДИРОВКАМИ)
// ===================================================================

import { state } from './state.js';
import { utils } from './trip-helpers.js';

/**
 * Форматирует ФИО в формат "Фамилия И. О.".
 * @param {string} lastName - Фамилия.
 * @param {string} firstName - Имя.
 * @param {string} patronymic - Отчество (может быть пустым).
 * @returns {string} - Отформатированное ФИО.
 */
function formatNameToInitials(lastName, firstName, patronymic) {
    if (!lastName || !firstName) {
        return `${lastName || ''} ${firstName || ''}`.trim();
    }
    const firstNameInitial = firstName.charAt(0).toUpperCase();
    if (patronymic) {
        const patronymicInitial = patronymic.charAt(0).toUpperCase();
        return `${lastName} ${firstNameInitial}. ${patronymicInitial}.`;
    }
    return `${lastName} ${firstNameInitial}.`;
}

/**
 * Определяет текущий статус сотрудника (в офисе, в командировке, в отпуске).
 * @param {object} employee - Объект сотрудника.
 * @returns {object} - Объект со статусом { type: 'office'|'trip'|'vacation', icon: 'fa-...', className: '...', title: '...' }
 */
function getEmployeeStatus(employee) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Проверяем отпуск
    const activeVacation = (employee.vacations || []).find(vacation => {
        const startDate = new Date(vacation.startDate);
        const endDate = new Date(vacation.endDate);
        startDate.setHours(0, 0, 0, 0);
        endDate.setHours(23, 59, 59, 999);
        return today >= startDate && today <= endDate;
    });
    
    if (activeVacation) {
        return {
            type: 'vacation',
            icon: 'fa-umbrella-beach',
            className: 'status-vacation',
            title: 'В отпуске'
        };
    }
    
    // Проверяем командировку
    const activeTrip = utils.getEmployeeTrips(employee.id).find(trip => {
        const startDate = new Date(trip.startDate);
        const endDate = new Date(trip.endDate);
        startDate.setHours(0, 0, 0, 0);
        endDate.setHours(23, 59, 59, 999);
        return today >= startDate && today <= endDate;
    });
    
    if (activeTrip) {
        return {
            type: 'trip',
            icon: 'fa-plane',
            className: 'status-trip',
            title: 'В командировке'
        };
    }
    
    // По умолчанию - в офисе
    return {
        type: 'office',
        icon: 'fa-building',
        className: 'status-office',
        title: 'В офисе'
    };
}

function setupTripExpansion(tripItem, contentSpan) {
    const overflowAmount = contentSpan.scrollWidth - contentSpan.clientWidth;
    if (overflowAmount <= 0) {
        return;
    }

    const baseWidth = tripItem.offsetWidth;
    const expandedWidth = baseWidth + overflowAmount + 16;

    tripItem.dataset.baseWidth = String(baseWidth);
    tripItem.dataset.expandedWidth = String(expandedWidth);

    if (tripItem.dataset.expandableSetup === 'true') {
        return;
    }

    const handleMouseEnter = () => {
        const width = Number(tripItem.dataset.expandedWidth || expandedWidth);
        tripItem.style.width = `${width}px`;
        tripItem.style.right = 'auto';
        tripItem.classList.add('trip-item--expanded');
    };

    const handleMouseLeave = () => {
        tripItem.style.width = '';
        tripItem.style.right = '';
        tripItem.classList.remove('trip-item--expanded');
    };

    tripItem.addEventListener('mouseenter', handleMouseEnter);
    tripItem.addEventListener('mouseleave', handleMouseLeave);
    tripItem.dataset.expandableSetup = 'true';
}

// --- ЭЛЕМЕНТЫ DOM ---
const currentMonthDiv = document.querySelector('.current-month');
const scheduleHeader = document.getElementById('schedule-header-grid');
const pickerYearEl = document.getElementById('picker-year');
const pickerMonthsGrid = document.getElementById('picker-months-grid');

/**
 * Рендерит шапку календаря с названием месяца и днями недели.
 */
function renderCalendarHeader() {
    const year = state.currentDate.getFullYear();
    const month = state.currentDate.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const today = new Date();

    const monthYearString = state.currentDate.toLocaleString('ru-RU', { month: 'long', year: 'numeric' });
    if(currentMonthDiv) currentMonthDiv.textContent = monthYearString;
    
    if(!scheduleHeader) return;

    scheduleHeader.innerHTML = '';
    const headerFragment = document.createDocumentFragment();

    const firstHeaderCell = document.createElement('div');
    firstHeaderCell.className = 'schedule-header-cell';
    firstHeaderCell.innerHTML = '<div>Сотрудник/Дата</div>';
    headerFragment.appendChild(firstHeaderCell);

    for (let i = 1; i <= daysInMonth; i++) {
        const dayDate = new Date(year, month, i);
        const dayName = dayDate.toLocaleString('ru-RU', { weekday: 'short' });
        const isWeekend = dayDate.getDay() === 0 || dayDate.getDay() === 6;
        const isToday = today.toDateString() === dayDate.toDateString();
        
        const dayCell = document.createElement('div');
        dayCell.className = 'schedule-header-cell';
        if (isWeekend) dayCell.classList.add('weekend');
        if (isToday) dayCell.classList.add('today');
        dayCell.innerHTML = `<div class="day-number">${i}</div><div class="day-name">${dayName}</div>`;
        headerFragment.appendChild(dayCell);
    }

    scheduleHeader.appendChild(headerFragment);
    // Растягиваем ячейки чтобы влезли в контейнер, минимум 40px
    scheduleHeader.style.gridTemplateColumns = `250px repeat(${daysInMonth}, minmax(40px, 1fr))`;
}
/**
 * Рендерит одну строку в календаре для одного сотрудника со всеми его командировками и отпусками.
 * @param {object} employee - Объект сотрудника.
 * @returns {HTMLElement} - Сгенерированный DOM-элемент строки.
 */
function renderEmployeeRow(employee) {
    const year = state.currentDate.getFullYear();
    const month = state.currentDate.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstDayOfMonth = new Date(year, month, 1);
    const lastDayOfMonth = new Date(year, month, daysInMonth);
    const today = new Date();

    const row = document.createElement('div');
    row.className = 'employee-row';
    row.style.gridTemplateColumns = `250px repeat(${daysInMonth}, minmax(40px, 1fr))`; // Растягиваем ячейки
    
    // Добавляем класс для уволенных сотрудников
    if (employee.status === 'fired') {
        row.classList.add('employee-fired');
    }
    
    const nameCell = document.createElement('div');
    nameCell.className = 'employee-cell';

    const fullName = `${employee.lastName} ${employee.firstName} ${employee.patronymic || ''}`.trim();
    const formattedName = formatNameToInitials(employee.lastName, employee.firstName, employee.patronymic);
    
    // Получаем текущий статус сотрудника
    const status = getEmployeeStatus(employee);

    const nameDiv = document.createElement('div');
    nameDiv.className = 'employee-name-full';
    nameDiv.setAttribute('data-employee-id', employee.id);
    nameDiv.setAttribute('data-full-name', fullName);
    
    // Добавляем статусный индикатор
    const statusIndicator = document.createElement('span');
    statusIndicator.className = `employee-status-indicator ${status.className}`;
    statusIndicator.innerHTML = `<i class="fas ${status.icon}"></i>`;
    statusIndicator.setAttribute('title', status.title);
    
    const nameText = document.createElement('span');
    nameText.textContent = formattedName;
    
    nameDiv.appendChild(statusIndicator);
    nameDiv.appendChild(nameText); 
    
    const positionDiv = document.createElement('div');
    positionDiv.className = 'employee-position';
    positionDiv.textContent = employee.position;
    
    nameCell.appendChild(nameDiv);
    nameCell.appendChild(positionDiv);
    row.appendChild(nameCell);
    
    for (let i = 1; i <= daysInMonth; i++) {
        const dayDate = new Date(year, month, i);
        const isWeekend = dayDate.getDay() === 0 || dayDate.getDay() === 6;
        const isToday = today.toDateString() === dayDate.toDateString();
        const dayCell = document.createElement('div');
        dayCell.className = 'day-cell';
        if (isWeekend) dayCell.classList.add('weekend');
        if (isToday) dayCell.classList.add('today');
        row.appendChild(dayCell);
    }
    
    // --- ОТРИСОВКА ОТПУСКОВ (логика не меняется) ---
    const employeeVacations = (employee.vacations || []).filter(vacation => {
        const vacStart = new Date(vacation.startDate);
        const vacEnd = new Date(vacation.endDate);
        return vacStart <= lastDayOfMonth && vacEnd >= firstDayOfMonth;
    });

    employeeVacations.forEach(vacation => {
        const startDate = new Date(vacation.startDate);
        const endDate = new Date(vacation.endDate);
        const visibleStart = Math.max(1, startDate.getMonth() === month ? startDate.getDate() : 1);
        const visibleEnd = Math.min(daysInMonth, endDate.getMonth() === month ? endDate.getDate() : daysInMonth);
        const duration = visibleEnd - visibleStart + 1;

        if (duration > 0) {
            const vacationItem = document.createElement('div');
            vacationItem.className = 'trip-item vacation-item';
            vacationItem.innerHTML = `<div class="trip-item__content"><i class="fas fa-umbrella-beach"></i><span>Отпуск</span></div>`;
            vacationItem.style.gridColumn = `${visibleStart + 1} / span ${duration}`;
            vacationItem.dataset.vacationId = vacation.id;

            const startsInThisMonth = startDate.getMonth() === month;
            const endsInThisMonth = endDate.getMonth() === month;
            if (!startsInThisMonth) vacationItem.classList.add('starts-before');
            if (!endsInThisMonth) vacationItem.classList.add('ends-after');
    
            const dynamicStatus = utils.getVacationDynamicStatus(vacation);
            vacationItem.classList.add(dynamicStatus.className);
            
            row.appendChild(vacationItem);

            setTimeout(() => {
                const content = vacationItem.querySelector('.trip-item__content > span');
                if (content && content.scrollWidth > content.clientWidth) {
                    vacationItem.classList.add('trip-item--expandable');
                    setupTripExpansion(vacationItem, content);
                }
            }, 0);
        }
    });

    // --- ОТРИСОВКА КОМАНДИРОВОК ---
    const employeeTrips = utils.getEmployeeTrips(employee.id).filter(trip => {
        const tripStart = new Date(trip.startDate);
        const tripEnd = new Date(trip.endDate);
        return tripStart <= lastDayOfMonth && tripEnd >= firstDayOfMonth;
    });
    
    employeeTrips.forEach(trip => {
        const startDate = new Date(trip.startDate);
        const endDate = new Date(trip.endDate);
        const startsInThisMonth = startDate.getMonth() === month;
        const endsInThisMonth = endDate.getMonth() === month;
        const visibleStart = startsInThisMonth ? startDate.getDate() : 1;
        const visibleEnd = endsInThisMonth ? endDate.getDate() : daysInMonth;
        const duration = visibleEnd - visibleStart + 1;

        if (duration > 0) {
            const organization = state.organizations.find(o => o.id === trip.organizationId);
            const tripItem = document.createElement('div');
            tripItem.className = 'trip-item';

            if (!startsInThisMonth) tripItem.classList.add('starts-before');
            if (!endsInThisMonth) tripItem.classList.add('ends-after');

            let transportIconHtml = '';
            if (trip.transport) {
                const icons = { car: 'fa-car', train: 'fa-train', plane: 'fa-plane' };
                if (icons[trip.transport]) {
                    transportIconHtml = `<i class="fas ${icons[trip.transport]}"></i>`;
                }
            }
            
            const tripColor = organization ? organization.color : '#3498db';
            tripItem.innerHTML = `<div class="trip-item__content">${transportIconHtml}<span>${trip.destination}</span></div>`;
            tripItem.style.setProperty('--trip-color', tripColor);
            tripItem.style.backgroundColor = tripColor;
            tripItem.style.gridColumn = `${visibleStart + 1} / span ${duration}`;
            
            // Сохраняем ID командировки
            tripItem.dataset.tripId = trip.id; 
            
            // Для групповых командировок создаем виртуальный объект с массивом participants для тултипа
            if (trip.groupId) {
                const groupTrips = state.trips.filter(t => t.groupId === trip.groupId);
                const participantIds = groupTrips.map(t => t.employeeId).filter(id => id != null);
                tripItem.tripDataForTooltip = {
                    ...trip,
                    participants: participantIds
                };
            } else {
                // Для одиночных командировок создаем массив с одним участником
                tripItem.tripDataForTooltip = {
                    ...trip,
                    participants: trip.employeeId ? [trip.employeeId] : []
                };
            }

            const dynamicStatus = utils.getTripDynamicStatus(trip);
            tripItem.classList.add(dynamicStatus.className);
            row.appendChild(tripItem);

            // После добавления в DOM проверяем, обрезан ли текст
            setTimeout(() => {
                const content = tripItem.querySelector('.trip-item__content > span');
                if (content && content.scrollWidth > content.clientWidth) {
                    tripItem.classList.add('trip-item--expandable');
                    setupTripExpansion(tripItem, content);
                }
            }, 0);
        }
    });
    
    return row;
}

/**
 * Основная функция рендеринга всего календаря.
 */
export function renderCalendar() {
    renderCalendarHeader();
    
    const scheduleBody = document.getElementById('schedule-body-grid');
    if (!scheduleBody) return;

    const fragment = document.createDocumentFragment();

    if (state.employees.length === 0) {
        const emptyMessage = document.createElement('div');
        emptyMessage.style.textAlign = 'center';
        emptyMessage.style.padding = '50px';
        emptyMessage.style.gridColumn = '1 / -1';
        emptyMessage.textContent = 'Нет сотрудников для отображения.';
        fragment.appendChild(emptyMessage);
    } else {
        state.employees.forEach(employee => {
            const row = renderEmployeeRow(employee);
            fragment.appendChild(row);
        });
    }

    // Сохраняем текущую позицию скролла
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
    
    // Используем replaceChildren для замены содержимого БЕЗ замены самого элемента
    // Это сохраняет все event listeners
    scheduleBody.replaceChildren(fragment);
    
    // Восстанавливаем позицию скролла в следующем кадре
    requestAnimationFrame(() => {
        window.scrollTo(0, scrollTop);
    });
}


/**
 * Обновляет одну конкретную строку сотрудника, не перерисовывая весь календарь.
 * @param {number} employeeId - ID сотрудника для обновления.
 */
export function updateEmployeeRow(employeeId) {
    const employee = state.employees.find(e => e.id === employeeId);
    if (!employee) return;

    const scheduleBody = document.getElementById('schedule-body-grid');
    if (!scheduleBody) return;

    const existingRow = scheduleBody.querySelector(`[data-employee-id="${employeeId}"]`)?.closest('.employee-row');
    const newRow = renderEmployeeRow(employee);
    
    if (existingRow) {
        // Мгновенная замена без анимации
        existingRow.replaceWith(newRow);
    } else {
        // Если строки нет, просто добавляем
        scheduleBody.appendChild(newRow);
    }
}

/**
 * Отрисовывает содержимое выпадающего списка выбора месяца.
 * @param {number} year - Год для отображения.
 */
export function renderMonthPicker(year) {
    if(!pickerYearEl || !pickerMonthsGrid) return;

    pickerYearEl.textContent = year;
    pickerMonthsGrid.innerHTML = '';
    const months = ['Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн', 'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек'];
    
    const currentYear = state.currentDate.getFullYear();
    const currentMonth = state.currentDate.getMonth();

    months.forEach((monthName, index) => {
        const monthEl = document.createElement('div');
        monthEl.className = 'picker-month';
        monthEl.textContent = monthName;
        monthEl.dataset.month = index;
        
        if (index === currentMonth && year === currentYear) {
            monthEl.classList.add('active');
        }
        
        pickerMonthsGrid.appendChild(monthEl);
    });
}