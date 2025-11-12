// ===================================================================
// Файл: public/js/admin/admin-panel.js
// Описание: Логика админ-панели управления пользователями
// ===================================================================

let currentUserRow = null;
let selectedRole = 'user';
let usersData = {
    totalUsers: 0,
    activeUsers: 0,
    pendingUsers: 0,
    securityEvents: 0,
    users: []
};

/**
 * Определение пола по ФИО
 * @param {string} fio - Полное имя
 * @returns {string} - 'male', 'female', или 'unknown'
 */
function getGenderByName(fio) {
    if (!fio) return 'unknown';
    const parts = fio.trim().split(' ');
    if (parts.length < 2) return 'unknown';
    
    const surname = parts[0];
    const name = parts[1];
    const patronymic = parts[2] || '';
    
    // Проверка по отчеству (наиболее надежный способ)
    if (patronymic) {
        if (patronymic.endsWith('ович') || patronymic.endsWith('евич')) return 'male';
        if (patronymic.endsWith('овна') || patronymic.endsWith('евна')) return 'female';
    }
    
    // Проверка по фамилии
    if (surname.endsWith('ов') || surname.endsWith('ев') || surname.endsWith('ин')) return 'male';
    if (surname.endsWith('ова') || surname.endsWith('ева') || surname.endsWith('ина')) return 'female';
    if (surname.endsWith('ский')) return 'male';
    if (surname.endsWith('ская')) return 'female';
    
    // Проверка по имени
    const maleExceptions = ['никита', 'илья', 'лука', 'фома', 'кузьма'];
    if (maleExceptions.includes(name.toLowerCase())) return 'male';
    if (name.endsWith('а') || name.endsWith('я')) return 'female';
    
    return 'male'; // По умолчанию мужской
}

// Состояние сортировки для каждой таблицы и колонки
let sortState = {
    table1: {},  // Главная таблица
    table2: {}   // Таблица во вкладке "Пользователи"
};

/**
 * Сортировка данных
 * @param {string} tableId - ID таблицы
 * @param {number} columnIndex - Индекс колонки
 * @param {string} columnKey - Ключ данных (name, position, date, status, role)
 */
function sortTable(tableId, columnIndex, columnKey) {
    const currentState = sortState[tableId][columnKey] || 'none';
    let nextState;
    
    // Цикл: none -> asc -> desc -> none
    if (currentState === 'none') {
        nextState = 'asc';
    } else if (currentState === 'asc') {
        nextState = 'desc';
    } else {
        nextState = 'none';
    }
    
    // Обновляем состояние
    sortState[tableId][columnKey] = nextState;
    
    // Сортируем данные
    if (nextState === 'none') {
        // Возвращаем исходный порядок (по ID)
        usersData.users.sort((a, b) => b.id - a.id);
    } else {
        usersData.users.sort((a, b) => {
            let aVal = a[columnKey];
            let bVal = b[columnKey];
            
            // Для дат преобразуем в Date объекты
            if (columnKey === 'date') {
                const parseDate = (dateStr) => {
                    if (dateStr === '-') return new Date(0);
                    const parts = dateStr.split('.');
                    return new Date(parts[2], parts[1] - 1, parts[0]);
                };
                aVal = parseDate(aVal);
                bVal = parseDate(bVal);
            }
            
            // Сравнение
            if (aVal < bVal) return nextState === 'asc' ? -1 : 1;
            if (aVal > bVal) return nextState === 'asc' ? 1 : -1;
            return 0;
        });
    }
    
    // Обновляем иконки сортировки
    updateSortIcons(tableId, columnIndex, nextState);
    
    // Перерисовываем таблицу
    renderUsersTable();
}

/**
 * Обновление иконок сортировки
 */
function updateSortIcons(tableId, columnIndex, state) {
    const table = document.getElementById(tableId === 'table1' ? 'usersTableBody' : 'usersTableBody2').closest('table');
    const headers = table.querySelectorAll('th');
    const header = headers[columnIndex];
    
    if (!header) return;
    
    // Удаляем все иконки из других заголовков
    headers.forEach(h => {
        const icon = h.querySelector('.sort-icon');
        if (icon) icon.remove();
    });
    
    // Добавляем иконку к текущему заголовку
    let icon = header.querySelector('.sort-icon');
    if (!icon) {
        icon = document.createElement('i');
        icon.className = 'fas sort-icon';
        header.style.cursor = 'pointer';
        header.appendChild(icon);
    }
    
    // Устанавливаем класс иконки в зависимости от состояния
    if (state === 'asc') {
        icon.className = 'fas fa-sort-up sort-icon';
    } else if (state === 'desc') {
        icon.className = 'fas fa-sort-down sort-icon';
    } else {
        icon.remove();
    }
}

/**
 * Загрузка данных пользователей с сервера
 */
async function loadUsersFromServer() {
    try {
        const response = await fetch('/api/admin/users');
        if (!response.ok) throw new Error('Ошибка загрузки пользователей');
        
        const users = await response.json();
        usersData.users = users.map(user => {
            // Форматируем дату регистрации
            let formattedDate = '-';
            if (user.registrationDate) {
                const date = new Date(user.registrationDate);
                formattedDate = date.toLocaleDateString('ru-RU', {
                    year: 'numeric',
                    month: '2-digit',
                    day: '2-digit'
                });
            }
            
            return {
                id: user.id,
                name: user.name,
                full_name: user.name, // Добавляем для совместимости
                position: user.position,
                email: '-', // Пока нет email в БД
                date: formattedDate,
                status: user.status || 'active',
                role: user.role || 'user',
                registrationDate: user.registrationDate // ВАЖНО: сохраняем оригинальную дату
            };
        });
        
        return usersData.users;
    } catch (error) {
        console.error('Ошибка при загрузке пользователей:', error);
        return [];
    }
}

/**
 * Загрузка статистики с сервера
 */
async function loadStatsFromServer() {
    try {
        const response = await fetch('/api/admin/stats');
        if (!response.ok) throw new Error('Ошибка загрузки статистики');
        
        const stats = await response.json();
        usersData.totalUsers = stats.totalUsers;
        usersData.activeUsers = stats.activeUsers;
        usersData.pendingUsers = stats.pendingUsers;
        usersData.securityEvents = stats.securityEvents;
        
        return stats;
    } catch (error) {
        console.error('Ошибка при загрузке статистики:', error);
        return usersData;
    }
}

/**
 * Загрузка данных текущего пользователя
 */
async function loadCurrentUser() {
    try {
        const response = await fetch('/api/current-user');
        if (!response.ok) throw new Error('Ошибка загрузки данных пользователя');
        const user = await response.json();
        
        // Сохраняем роль текущего пользователя глобально
        window.currentUserRole = user.role || 'user';
        
        // Обновляем аватар с инициалами
        const avatar = document.getElementById('userAvatar');
        if (avatar && user.name) {
            const initials = user.name.split(' ')
                .map(word => word[0])
                .slice(0, 2)
                .join('')
                .toUpperCase();
            avatar.textContent = initials;
        }
        
        // Обновляем имя
        const userName = document.getElementById('userName');
        if (userName) {
            userName.textContent = user.name || 'Пользователь';
        }
        
        // Обновляем должность
        const userRole = document.getElementById('userRole');
        if (userRole) {
            userRole.textContent = user.position || 'Должность не указана';
        }
    } catch (error) {
        console.error('Ошибка при загрузке данных пользователя:', error);
    }
}

/**
 * Обновление статистики на главной странице
 * ОТКЛЮЧЕНО: статистика теперь не отображается на главной странице
 */
function updateStats() {
    // Закомментировано - элементы удалены из HTML
    // document.getElementById('totalUsers').textContent = usersData.totalUsers.toLocaleString();
    // document.getElementById('activeUsers').textContent = usersData.activeUsers.toLocaleString();
    // document.getElementById('pendingUsers').textContent = usersData.pendingUsers.toLocaleString();
    // document.getElementById('securityEvents').textContent = usersData.securityEvents.toLocaleString();
}

/**
 * Блокировка пользователя
 */
function blockUser(button) {
    const row = button.closest('tr');
    const userId = parseInt(row.dataset.id);
    
    const userIndex = usersData.users.findIndex(user => user.id === userId);
    if (userIndex !== -1) {
        usersData.users.splice(userIndex, 1);
        usersData.activeUsers--;
        usersData.securityEvents++;
        updateStats();
        row.remove();
        showNotification('Пользователь успешно заблокирован!');
    }
}

/**
 * Подтверждение регистрации пользователя
 */
function confirmRegistration(button) {
    const row = button.closest('tr');
    const userId = parseInt(row.dataset.id);
    const statusCell = row.cells[3];
    const roleCell = row.cells[4];
    const actionsCell = row.cells[5];
    
    const user = usersData.users.find(user => user.id === userId);
    if (user) {
        user.status = "active";
        usersData.pendingUsers--;
        usersData.activeUsers++;
        updateStats();
        
        statusCell.innerHTML = '<span class="status status-success">Активен</span>';
        roleCell.innerHTML = '<span class="role-badge" onclick="showRoleModal(this)"><i class="fas fa-user"></i> Пользователь</span>';
        actionsCell.innerHTML = '<button class="btn btn-danger btn-small" onclick="blockUser(this)"><i class="fas fa-user-slash"></i> Заблокировать</button>';
        
        showNotification('Регистрация подтверждена! Теперь можно назначить роль пользователю.');
    }
}

/**
 * Открытие модального окна добавления пользователя
 */
function openAddUserModal() {
    document.getElementById('addUserModal').style.display = 'flex';
}

/**
 * Закрытие модального окна добавления пользователя
 */
function closeAddUserModal() {
    document.getElementById('addUserModal').style.display = 'none';
    document.getElementById('newUserName').value = '';
    document.getElementById('newUserEmail').value = '';
    document.getElementById('newUserRole').value = 'user';
}

/**
 * Добавление нового пользователя
 */
function addNewUser() {
    const name = document.getElementById('newUserName').value.trim();
    const email = document.getElementById('newUserEmail').value.trim();
    const role = document.getElementById('newUserRole').value;
    
    if (!name || !email) {
        showNotification('Заполните все обязательные поля!', 'error');
        return;
    }
    
    const newUserId = Math.max(...usersData.users.map(u => u.id)) + 1;
    const currentDate = new Date();
    const formattedDate = `${currentDate.getDate().toString().padStart(2, '0')}.${(currentDate.getMonth() + 1).toString().padStart(2, '0')}.${currentDate.getFullYear()}`;
    
    const newUser = {
        id: newUserId,
        name: name,
        email: email,
        date: formattedDate,
        status: "pending",
        role: null
    };
    
    usersData.users.push(newUser);
    usersData.totalUsers++;
    usersData.pendingUsers++;
    updateStats();
    
    addUserToTable(newUser, document.getElementById('usersTableBody'));
    addUserToTable(newUser, document.getElementById('usersTableBody2'));
    
    closeAddUserModal();
    showNotification('Пользователь успешно добавлен!');
}

/**
 * Добавление пользователя в таблицу
 */
function addUserToTable(user, tableBody) {
    const newRow = document.createElement('tr');
    newRow.dataset.id = user.id;
    
    const initials = user.name.split(' ').slice(0, 2).map(n => n[0]).join('');
    
    // Определяем пол по ФИО
    const gender = getGenderByName(user.name);
    
    // Определяем иконку и текст роли
    let roleIcon = 'fa-user';
    let roleText = 'Пользователь';
    let roleClass = '';
    
    if (user.role === 'admin') {
        roleIcon = 'fa-user-shield';
        roleText = 'Модератор';
        roleClass = 'role-admin';
    } else if (user.role === 'superadmin') {
        roleIcon = 'fa-crown';
        roleText = 'Администратор';
        roleClass = 'role-superadmin';
    }
    
    // Определяем статус пользователя
    let statusBadge = '<span class="status status-success">Активен</span>';
    let actionButtons = '';
    
    const currentUserRole = window.currentUserRole || 'user';
    
    if (user.status === 'pending') {
        statusBadge = '<span class="status status-pending">Ожидает подтверждения</span>';
        if (currentUserRole === 'superadmin') {
            actionButtons = `
                <div class="user-actions">
                    <button type="button" class="btn-icon approve" onclick="approveUser(this)" title="Подтвердить"><i class="fas fa-check"></i></button>
                    <button type="button" class="btn-icon reject" onclick="rejectUser(this)" title="Отклонить"><i class="fas fa-times"></i></button>
                </div>
            `;
        }
    } else if (user.status === 'active') {
        statusBadge = '<span class="status status-success">Активен</span>';
        if (currentUserRole === 'superadmin') {
            actionButtons = `<div class="user-actions"><button type="button" class="btn-icon delete" onclick="deleteUser(this)" title="Удалить"><i class="fas fa-trash-alt"></i></button></div>`;
        }
    } else if (user.status === 'rejected') {
        statusBadge = '<span class="status status-error">Отклонен</span>';
    }
    
    newRow.innerHTML = `
        <td>
            <div class="user">
                <div class="user-avatar-small avatar-${gender}">${initials}</div>
                <span>${user.name}</span>
            </div>
        </td>
        <td>${user.position || '-'}</td>
        <td>${user.date}</td>
        <td>${statusBadge}</td>
        <td><span class="role-badge ${roleClass}" data-role="${user.role}"><i class="fas ${roleIcon}"></i> ${roleText}</span></td>
        <td>${actionButtons}</td>
    `;
    
    // Добавляем обработчик клика для суперадминов только на активных пользователей
    if (currentUserRole === 'superadmin' && user.status === 'active') {
        newRow.style.cursor = 'pointer';
        newRow.addEventListener('click', function(e) {
            // Игнорируем клики на кнопки действий
            if (e.target.closest('.btn-icon') || e.target.closest('.user-actions')) {
                return;
            }
            showRoleModal(this);
        });
    }
    
    tableBody.appendChild(newRow);
}

/**
 * Открытие модального окна назначения роли
 */
function showRoleModal(element) {
    // Получаем строку таблицы
    const row = element.closest('tr');
    
    if (!row) {
        console.error('Row not found!');
        return;
    }
    
    currentUserRow = row;
    const userId = parseInt(row.dataset.id);
    
    // Получаем имя пользователя из span внутри div.user
    const userSpan = row.cells[0]?.querySelector('.user span');
    const userName = userSpan?.textContent || row.cells[0]?.textContent.trim() || 'Имя не найдено';
    const currentRole = row.querySelector('.role-badge')?.dataset.role || 'user';
    
    // Используем уникальный ID для поля в модальном окне
    const userNameInput = document.getElementById('modalUserName');
    if (userNameInput) {
        userNameInput.value = userName;
    }
    
    // Выбираем текущую роль пользователя
    document.querySelectorAll('.role-option').forEach(option => {
        option.classList.remove('selected');
        if (option.dataset.role === currentRole) {
            option.classList.add('selected');
        }
    });
    selectedRole = currentRole;
    
    document.getElementById('roleModal').style.display = 'flex';
}

/**
 * Закрытие модального окна назначения роли
 */
function closeRoleModal() {
    document.getElementById('roleModal').style.display = 'none';
}

/**
 * Выбор роли
 */
function selectRole(element) {
    document.querySelectorAll('.role-option').forEach(option => {
        option.classList.remove('selected');
    });
    element.classList.add('selected');
    selectedRole = element.getAttribute('data-role');
}

/**
 * Назначение роли пользователю
 */
async function assignRole() {
    if (!currentUserRow) return;
    
    const userId = parseInt(currentUserRow.dataset.id);
    const userName = currentUserRow.cells[0].querySelector('.user span').textContent;
    
    try {
        // Получаем CSRF токен
        let csrfToken = document.cookie.split('; ').find(row => row.startsWith('_csrf='))?.split('=')[1];
        if (!csrfToken) {
            const csrfResponse = await fetch('/api/csrf-token', { credentials: 'include' });
            if (csrfResponse.ok) {
                csrfToken = (await csrfResponse.json())?.csrfToken;
            }
        }
        
        // Отправляем запрос на сервер для изменения роли
        const response = await fetch(`/api/admin/users/${userId}/role`, {
            method: 'PUT',
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json',
                'x-csrf-token': csrfToken
            },
            body: JSON.stringify({ 
                role: selectedRole,
                _csrf: csrfToken
            })
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Ошибка изменения роли');
        }
        
        // Обновляем роль в локальных данных
        const user = usersData.users.find(u => u.id === userId);
        if (user) {
            user.role = selectedRole;
        }
        
        // Обновляем отображение роли в строке
        const roleCell = currentUserRow.cells[4];
        let roleIcon = 'fa-user';
        let roleText = 'Пользователь';
        let roleClass = '';
        
        if (selectedRole === 'admin') {
            roleIcon = 'fa-user-shield';
            roleText = 'Модератор';
            roleClass = 'role-admin';
        } else if (selectedRole === 'superadmin') {
            roleIcon = 'fa-crown';
            roleText = 'Администратор';
            roleClass = 'role-superadmin';
        }
        
        roleCell.innerHTML = `<span class="role-badge ${roleClass}" data-role="${selectedRole}"><i class="fas ${roleIcon}"></i> ${roleText}</span>`;
        
        closeRoleModal();
        
        // Обновляем ленту событий
        if (typeof refreshEvents === 'function') {
            await refreshEvents();
        }
        
        showNotification(`Роль пользователя "${userName}" успешно изменена`);
        
    } catch (error) {
        console.error('Ошибка при изменении роли:', error);
        showNotification(error.message || 'Ошибка при изменении роли', 'error');
    }
}

/**
 * Показать уведомление
 */
function showNotification(message, type = 'success') {
    const notification = document.getElementById('notification');
    document.getElementById('notificationText').textContent = message;
    
    if (type === 'error') {
        notification.style.background = 'var(--error-color)';
    } else {
        notification.style.background = 'var(--success-color)';
    }
    
    notification.style.display = 'flex';
    
    setTimeout(() => {
        notification.style.display = 'none';
    }, 3000);
}

/**
 * Рендер таблицы пользователей
 */
async function renderUsersTable() {
    const tableBody1 = document.getElementById('usersTableBody');
    const tableBody2 = document.getElementById('usersTableBody2');
    
    // Загружаем пользователей с сервера ПЕРЕД очисткой таблицы
    await loadUsersFromServer();
    
    // Создаем временные фрагменты для минимизации перерисовки
    const fragment1 = document.createDocumentFragment();
    const fragment2 = document.createDocumentFragment();
    
    usersData.users.forEach(user => {
        addUserToTable(user, fragment1);
        addUserToTable(user, fragment2);
    });
    
    // Очищаем и заполняем таблицы одной операцией (только если элементы существуют)
    if (tableBody1) {
        tableBody1.innerHTML = '';
        tableBody1.appendChild(fragment1);
    }
    
    if (tableBody2) {
        tableBody2.innerHTML = '';
        tableBody2.appendChild(fragment2);
    }
}

/**
 * Инициализация при загрузке страницы
 */
document.addEventListener('DOMContentLoaded', async function() {
    // Загружаем данные текущего пользователя в шапку
    await loadCurrentUser();
    
    // Загружаем статистику и пользователей
    await loadStatsFromServer();
    await renderUsersTable();
    updateStats();
    
    // Загружаем сохраненные настройки
    loadSettings();
    
    // Инициализируем ленту событий
    initializeEvents();
    
    // Автоматическое обновление данных каждые 5 секунд
    setInterval(async () => {
        await loadStatsFromServer();
        await renderUsersTable();
        updateStats();
    }, 5000);
    
    // Навигация по разделам
    document.querySelectorAll('.nav-links a').forEach(link => {
        link.addEventListener('click', function(e) {
            const sectionId = this.getAttribute('data-section');
            if (!sectionId) return; // Пропускаем ссылки без data-section (например, "К порталу")
            
            e.preventDefault();
            
            document.querySelectorAll('.nav-links a').forEach(a => {
                a.classList.remove('active');
            });
            this.classList.add('active');
            
            document.querySelectorAll('.content-section').forEach(section => {
                section.classList.remove('active');
            });
            
            const targetSection = document.getElementById(sectionId);
            if (targetSection) {
                targetSection.classList.add('active');
                
                // Загружаем аналитику при открытии раздела
                if (sectionId === 'analytics') {
                    console.log('Клик по сайдбару - загрузка аналитики');
                    loadAnalytics();
                }
            }
        });
    });
    
    // Навигация по карточкам на главной странице
    document.querySelectorAll('.feature-card[data-section]').forEach(card => {
        card.addEventListener('click', function() {
            const sectionId = this.getAttribute('data-section');
            console.log('Клик по карточке:', sectionId);
            if (!sectionId) return;
            
            // Переключаем активную ссылку в сайдбаре
            document.querySelectorAll('.nav-links a').forEach(a => {
                a.classList.remove('active');
                if (a.getAttribute('data-section') === sectionId) {
                    a.classList.add('active');
                    console.log('Активирована ссылка:', sectionId);
                }
            });
            
            // Переключаем активную секцию
            document.querySelectorAll('.content-section').forEach(section => {
                section.classList.remove('active');
            });
            
            const targetSection = document.getElementById(sectionId);
            if (targetSection) {
                targetSection.classList.add('active');
                console.log('Открыта секция:', sectionId);
                
                // Загружаем аналитику при открытии раздела
                if (sectionId === 'analytics') {
                    loadAnalytics();
                }
            } else {
                console.error('Секция не найдена:', sectionId);
            }
        });
    });
    
    // Навигация по карточкам на главной странице
    document.querySelectorAll('.feature-card[data-section]').forEach(card => {
        card.addEventListener('click', function() {
            const sectionId = this.getAttribute('data-section');
            console.log('Клик по карточке:', sectionId);
            if (!sectionId) return;
            
            // Переключаем активную ссылку в сайдбаре
            document.querySelectorAll('.nav-links a').forEach(a => {
                a.classList.remove('active');
                if (a.getAttribute('data-section') === sectionId) {
                    a.classList.add('active');
                    console.log('Активирована ссылка:', sectionId);
                }
            });
            
            // Переключаем активную секцию
            document.querySelectorAll('.content-section').forEach(section => {
                section.classList.remove('active');
            });
            
            const targetSection = document.getElementById(sectionId);
            if (targetSection) {
                targetSection.classList.add('active');
                console.log('Открыта секция:', sectionId);
            } else {
                console.error('Секция не найдена:', sectionId);
            }
        });
    });
    
    // Закрытие модальных окон при клике вне их
    window.onclick = function(event) {
        const roleModal = document.getElementById('roleModal');
        
        if (event.target === roleModal) {
            closeRoleModal();
        }
    }
});

/**
 * Удаление пользователя (только для суперадминов)
 */
async function deleteUser(button) {
    const row = button.closest('tr');
    const userId = parseInt(row.dataset.id);
    const userName = row.querySelector('.user span').textContent;
    
    if (!confirm(`Вы уверены, что хотите удалить пользователя "${userName}"?`)) {
        return;
    }
    
    try {
        // Получаем CSRF токен
        let csrfToken = document.cookie.split('; ').find(row => row.startsWith('_csrf='))?.split('=')[1];
        if (!csrfToken) {
            const csrfResponse = await fetch('/api/csrf-token', { credentials: 'include' });
            if (csrfResponse.ok) {
                csrfToken = (await csrfResponse.json())?.csrfToken;
            }
        }
        
        const response = await fetch(`/api/admin/users/${userId}`, {
            method: 'DELETE',
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json',
                'x-csrf-token': csrfToken
            }
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Ошибка удаления пользователя');
        }
        
        // Удаляем из массива данных
        const userIndex = usersData.users.findIndex(u => u.id === userId);
        if (userIndex !== -1) {
            usersData.users.splice(userIndex, 1);
            usersData.totalUsers--;
        }
        
        // Обновляем статистику
        await loadStatsFromServer();
        updateStats();
        
        // Перерисовываем таблицы
        await renderUsersTable();
        
        // Обновляем ленту событий
        if (typeof refreshEvents === 'function') {
            await refreshEvents();
        }
        
        showNotification('Пользователь успешно удален');
    } catch (error) {
        console.error('Ошибка при удалении пользователя:', error);
        showNotification(error.message || 'Ошибка при удалении пользователя', 'error');
    }
}

// --- ПОДТВЕРЖДЕНИЕ РЕГИСТРАЦИИ ---
async function approveUser(button) {
    const row = button.closest('tr');
    const userId = parseInt(row.dataset.id);
    const userName = row.querySelector('.user span').textContent;
    
    if (!confirm(`Подтвердить регистрацию пользователя "${userName}"?`)) {
        return;
    }
    
    try {
        // Получаем CSRF токен
        let csrfToken = document.cookie.split('; ').find(row => row.startsWith('_csrf='))?.split('=')[1];
        if (!csrfToken) {
            const csrfResponse = await fetch('/api/csrf-token', { credentials: 'include' });
            if (csrfResponse.ok) {
                csrfToken = (await csrfResponse.json())?.csrfToken;
            }
        }
        
        const response = await fetch(`/api/admin/users/${userId}/approve`, {
            method: 'POST',
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json',
                'x-csrf-token': csrfToken
            },
            body: JSON.stringify({
                _csrf: csrfToken
            })
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Ошибка подтверждения регистрации');
        }
        
        // Обновляем статус в массиве данных
        const user = usersData.users.find(u => u.id === userId);
        if (user) {
            user.status = 'active';
        }
        
        // Обновляем статистику
        await loadStatsFromServer();
        updateStats();
        
        // Перерисовываем таблицы
        await renderUsersTable();
        
        // Обновляем ленту событий
        if (typeof refreshEvents === 'function') {
            await refreshEvents();
        }
        
        showNotification('Регистрация пользователя подтверждена');
    } catch (error) {
        console.error('Ошибка при подтверждении регистрации:', error);
        showNotification(error.message || 'Ошибка при подтверждении регистрации', 'error');
    }
}

// --- ОТКЛОНЕНИЕ РЕГИСТРАЦИИ ---
async function rejectUser(button) {
    const row = button.closest('tr');
    const userId = parseInt(row.dataset.id);
    const userName = row.querySelector('.user span').textContent;
    
    if (!confirm(`Отклонить регистрацию пользователя "${userName}"? Пользователь будет удален из системы.`)) {
        return;
    }
    
    try {
        // Получаем CSRF токен
        let csrfToken = document.cookie.split('; ').find(row => row.startsWith('_csrf='))?.split('=')[1];
        if (!csrfToken) {
            const csrfResponse = await fetch('/api/csrf-token', { credentials: 'include' });
            if (csrfResponse.ok) {
                csrfToken = (await csrfResponse.json())?.csrfToken;
            }
        }
        
        const response = await fetch(`/api/admin/users/${userId}/reject`, {
            method: 'POST',
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json',
                'x-csrf-token': csrfToken
            },
            body: JSON.stringify({
                _csrf: csrfToken
            })
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Ошибка отклонения регистрации');
        }
        
        // Удаляем из массива данных
        const userIndex = usersData.users.findIndex(u => u.id === userId);
        if (userIndex !== -1) {
            usersData.users.splice(userIndex, 1);
            usersData.totalUsers--;
        }
        
        // Обновляем статистику
        await loadStatsFromServer();
        updateStats();
        
        // Перерисовываем таблицы
        await renderUsersTable();
        
        // Обновляем ленту событий
        if (typeof refreshEvents === 'function') {
            await refreshEvents();
        }
        
        showNotification('Регистрация пользователя отклонена');
    } catch (error) {
        console.error('Ошибка при отклонении регистрации:', error);
        showNotification(error.message || 'Ошибка при отклонении регистрации', 'error');
    }
}

// === АНАЛИТИКА АДМИН-ПАНЕЛИ ===
let registrationChart = null;
let statusChart = null;
let rolesChart = null;
let currentPeriod = 30;

/**
 * Загрузка и отображение аналитики админ-панели
 */
async function loadAnalytics() {
    console.log('=== ЗАГРУЗКА АНАЛИТИКИ ===');
    try {
        // Загружаем полные данные о пользователях
        console.log('Загрузка пользователей...');
        await loadUsersFromServer();
        console.log('Загружено пользователей:', usersData.users.length);
        console.log('Данные пользователей:', usersData.users);
        
        // Загружаем статистику
        console.log('Загрузка статистики...');
        await loadStatsFromServer();
        console.log('Статистика:', usersData);
        
        // Обновляем метрики
        console.log('Обновление метрик...');
        updateMetric('totalUsers', usersData.totalUsers);
        updateMetric('activeUsers', usersData.activeUsers);
        updateMetric('pendingUsers', usersData.pendingUsers);
        
        // Процент активных пользователей
        const activePercent = usersData.totalUsers > 0 
            ? Math.round((usersData.activeUsers / usersData.totalUsers) * 100) 
            : 0;
        updateMetric('activePercent', activePercent);
        
        // Подсчитываем администраторов и суперадминов
        const adminCount = usersData.users.filter(u => u.role === 'admin').length;
        const superAdminCount = usersData.users.filter(u => u.role === 'superadmin').length;
        updateMetric('adminCount', adminCount);
        updateMetric('superAdminCount', superAdminCount);
        
        // Регистрации за месяц и неделю
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        
        const monthRegistrations = usersData.users.filter(u => {
            if (!u.registrationDate) return false;
            // registrationDate хранится как timestamp
            const regDate = new Date(u.registrationDate);
            return regDate >= thirtyDaysAgo;
        }).length;
        
        const weekRegistrations = usersData.users.filter(u => {
            if (!u.registrationDate) return false;
            const regDate = new Date(u.registrationDate);
            return regDate >= sevenDaysAgo;
        }).length;
        
        updateMetric('monthRegistrations', monthRegistrations);
        updateMetric('weekRegistrations', weekRegistrations);
        updateMetric('usersChange', monthRegistrations);
        
        // Загружаем графики
        await loadRegistrationChart(currentPeriod);
        
        // Загружаем детализацию
        loadRolesDetails();
        loadPositionsDetails();
        
    } catch (error) {
        console.error('Ошибка при загрузке аналитики:', error);
    }
}

/**
 * Переключение периода графика регистраций
 */
function switchRegistrationPeriod(period) {
    currentPeriod = period;
    
    // Обновляем активную кнопку
    document.querySelectorAll('.btn-chart').forEach(btn => {
        btn.classList.remove('active');
        if (parseInt(btn.getAttribute('data-period')) === period) {
            btn.classList.add('active');
        }
    });
    
    loadRegistrationChart(period);
}

/**
 * Обновление значения метрики
 */
function updateMetric(id, value) {
    const element = document.getElementById(id);
    if (element) {
        element.textContent = value;
    }
}

/**
 * Загрузка и отрисовка графика регистраций
 */
async function loadRegistrationChart(days = 30) {
    try {
        const daysAgo = new Date();
        daysAgo.setDate(daysAgo.getDate() - days);
        
        const registrationsByDate = new Map();
        
        // Инициализируем все даты нулями
        for (let i = days - 1; i >= 0; i--) {
            const date = new Date();
            date.setDate(date.getDate() - i);
            const dateString = date.toISOString().split('T')[0];
            registrationsByDate.set(dateString, 0);
        }
        
        // Подсчитываем регистрации
        usersData.users.forEach(user => {
            if (user.registrationDate) {
                // registrationDate хранится как timestamp
                const regDate = new Date(user.registrationDate);
                if (regDate >= daysAgo) {
                    const dateString = regDate.toISOString().split('T')[0];
                    if (registrationsByDate.has(dateString)) {
                        registrationsByDate.set(dateString, registrationsByDate.get(dateString) + 1);
                    }
                }
            }
        });
        
        const labels = [];
        const data = [];
        
        registrationsByDate.forEach((count, date) => {
            const d = new Date(date);
            labels.push(d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' }));
            data.push(count);
        });
        
        // Уничтожаем предыдущий график если существует
        if (registrationChart) {
            registrationChart.destroy();
        }
        
        const ctx = document.getElementById('registrationChart');
        if (!ctx) return;
        
        // Создаем градиент
        const gradient = ctx.getContext('2d').createLinearGradient(0, 0, 0, 300);
        gradient.addColorStop(0, 'rgba(16, 185, 129, 0.3)');
        gradient.addColorStop(1, 'rgba(16, 185, 129, 0.0)');
        
        registrationChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Новые регистрации',
                    data: data,
                    borderColor: '#10b981',
                    backgroundColor: gradient,
                    borderWidth: 3,
                    fill: true,
                    tension: 0.4,
                    pointRadius: 5,
                    pointBackgroundColor: '#10b981',
                    pointBorderColor: '#fff',
                    pointBorderWidth: 2,
                    pointHoverRadius: 7
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: true,
                        position: 'top',
                        labels: {
                            font: {
                                size: 12,
                                family: "'Inter', sans-serif",
                                weight: '500'
                            },
                            padding: 15,
                            usePointStyle: true
                        }
                    },
                    tooltip: {
                        backgroundColor: 'rgba(0, 0, 0, 0.8)',
                        padding: 12,
                        titleFont: {
                            size: 14,
                            family: "'Inter', sans-serif"
                        },
                        bodyFont: {
                            size: 13,
                            family: "'Inter', sans-serif"
                        },
                        cornerRadius: 8
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            precision: 0,
                            font: {
                                size: 11,
                                family: "'Inter', sans-serif"
                            }
                        },
                        grid: {
                            color: 'rgba(0, 0, 0, 0.05)'
                        }
                    },
                    x: {
                        ticks: {
                            font: {
                                size: 10,
                                family: "'Inter', sans-serif"
                            },
                            maxRotation: 45,
                            minRotation: 45
                        },
                        grid: {
                            display: false
                        }
                    }
                }
            }
        });
    } catch (error) {
        console.error('Ошибка при загрузке графика регистраций:', error);
    }
}

/**
 * Загрузка детализации по должностям
 */
function loadPositionsDetails() {
    // Подсчитываем пользователей по должностям
    const positionsMap = new Map();
    
    usersData.users.forEach(user => {
        if (user.position) {
            const count = positionsMap.get(user.position) || 0;
            positionsMap.set(user.position, count + 1);
        }
    });
    
    // Сортируем по количеству
    const sortedPositions = Array.from(positionsMap.entries())
        .sort((a, b) => b[1] - a[1]);
    
    const container = document.getElementById('positionsList');
    
    if (!container) return;
    
    if (sortedPositions.length === 0) {
        container.innerHTML = '<p style="color: var(--text-light); text-align: center; padding: 20px;">Нет данных о должностях</p>';
        return;
    }
    
    // Цвета для должностей
    const colors = [
        '#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', 
        '#10b981', '#06b6d4', '#6366f1', '#8b5cf6',
        '#d946ef', '#f43f5e'
    ];
    
    container.innerHTML = sortedPositions.map((item, index) => {
        const [position, count] = item;
        const color = colors[index % colors.length];
        const percentage = ((count / usersData.users.length) * 100).toFixed(1);
        
        return `
            <div class="role-detail-item">
                <div class="role-detail-icon" style="background: ${color};">
                    <i class="fas fa-briefcase"></i>
                </div>
                <div class="role-detail-info">
                    <div class="role-detail-name">${position}</div>
                    <div class="role-detail-desc">${percentage}% от всех сотрудников</div>
                </div>
                <div class="role-detail-count" style="color: ${color};">${count}</div>
            </div>
        `;
    }).join('');
}

/**
 * Загрузка детализации ролей
 */
function loadRolesDetails() {
    const roleCounts = {
        user: usersData.users.filter(u => u.role === 'user').length,
        admin: usersData.users.filter(u => u.role === 'admin').length,
        superadmin: usersData.users.filter(u => u.role === 'superadmin').length
    };
    
    const container = document.getElementById('rolesList');
    
    if (!container) return;
    
    const roleInfo = [
        {
            role: 'Пользователи',
            count: roleCounts.user,
            icon: 'fa-user',
            color: '#3b82f6',
            description: 'Обычные пользователи системы'
        },
        {
            role: 'Администраторы',
            count: roleCounts.admin,
            icon: 'fa-user-shield',
            color: '#8b5cf6',
            description: 'Управление пользователями'
        },
        {
            role: 'Суперадмины',
            count: roleCounts.superadmin,
            icon: 'fa-crown',
            color: '#ec4899',
            description: 'Полный доступ к системе'
        }
    ];
    
    container.innerHTML = roleInfo.map(item => `
        <div class="role-detail-item">
            <div class="role-detail-icon" style="background: ${item.color};">
                <i class="fas ${item.icon}"></i>
            </div>
            <div class="role-detail-info">
                <div class="role-detail-name">${item.role}</div>
                <div class="role-detail-desc">${item.description}</div>
            </div>
            <div class="role-detail-count" style="color: ${item.color};">${item.count}</div>
        </div>
    `).join('');
}

/**
 * Получение инициалов из имени
 */
function getInitials(name) {
    if (!name) return '??';
    const parts = name.trim().split(' ');
    if (parts.length >= 2) {
        return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
}

// ===================================================================
// УПРАВЛЕНИЕ НАСТРОЙКАМИ СИСТЕМЫ
// ===================================================================

/**
 * Сохранение настроек системы
 */
async function saveSettings() {
    const settings = {
        general: {
            orgName: document.getElementById('orgName')?.value,
            adminEmail: document.getElementById('adminEmail')?.value,
            timezone: document.getElementById('timezone')?.value
        },
        security: {
            autoApprove: document.getElementById('autoApprove')?.checked,
            twoFactor: document.getElementById('twoFactor')?.checked,
            sessionDays: parseInt(document.getElementById('sessionDays')?.value) || 7,
            minPasswordLength: parseInt(document.getElementById('minPasswordLength')?.value) || 8
        },
        modules: {
            trips: document.getElementById('moduleTrips')?.checked,
            testing: document.getElementById('moduleTesting')?.checked,
            maintenance: document.getElementById('moduleMaintenance')?.checked,
            verification: document.getElementById('moduleVerification')?.checked,
            eds: document.getElementById('moduleEDS')?.checked
        },
        notifications: {
            email: document.getElementById('emailNotifications')?.checked,
            push: document.getElementById('pushNotifications')?.checked,
            registration: document.getElementById('registrationNotifications')?.checked
        }
    };

    try {
        // Здесь можно отправить настройки на сервер
        // const response = await fetch('/api/admin/settings', {
        //     method: 'POST',
        //     headers: { 'Content-Type': 'application/json' },
        //     body: JSON.stringify(settings)
        // });
        
        // Временно сохраняем в localStorage
        localStorage.setItem('systemSettings', JSON.stringify(settings));
        
        showNotification('Настройки успешно сохранены!', 'success');
        console.log('Сохраненные настройки:', settings);
    } catch (error) {
        console.error('Ошибка при сохранении настроек:', error);
        showNotification('Ошибка при сохранении настроек', 'error');
    }
}

/**
 * Сброс настроек к значениям по умолчанию
 */
function resetSettings() {
    if (!confirm('Вы уверены, что хотите сбросить все настройки к значениям по умолчанию?')) {
        return;
    }

    // Общие настройки
    if (document.getElementById('orgName')) {
        document.getElementById('orgName').value = "ООО 'Прибор Автоматика'";
    }
    if (document.getElementById('adminEmail')) {
        document.getElementById('adminEmail').value = 'admin@pribor-avtomatika.ru';
    }
    if (document.getElementById('timezone')) {
        document.getElementById('timezone').value = 'Europe/Moscow';
    }

    // Безопасность
    if (document.getElementById('autoApprove')) {
        document.getElementById('autoApprove').checked = false;
    }
    if (document.getElementById('twoFactor')) {
        document.getElementById('twoFactor').checked = false;
    }
    if (document.getElementById('sessionDays')) {
        document.getElementById('sessionDays').value = 7;
    }
    if (document.getElementById('minPasswordLength')) {
        document.getElementById('minPasswordLength').value = 8;
    }

    // Уведомления
    if (document.getElementById('emailNotifications')) {
        document.getElementById('emailNotifications').checked = true;
    }
    if (document.getElementById('pushNotifications')) {
        document.getElementById('pushNotifications').checked = false;
    }
    if (document.getElementById('registrationNotifications')) {
        document.getElementById('registrationNotifications').checked = true;
    }

    // Удаляем сохраненные настройки
    localStorage.removeItem('systemSettings');
    
    showNotification('Настройки сброшены к значениям по умолчанию', 'success');
}

/**
 * Загрузка сохраненных настроек
 */
function loadSettings() {
    try {
        const savedSettings = localStorage.getItem('systemSettings');
        if (!savedSettings) return;

        const settings = JSON.parse(savedSettings);

        // Загружаем общие настройки
        if (settings.general) {
            if (settings.general.orgName && document.getElementById('orgName')) {
                document.getElementById('orgName').value = settings.general.orgName;
            }
            if (settings.general.adminEmail && document.getElementById('adminEmail')) {
                document.getElementById('adminEmail').value = settings.general.adminEmail;
            }
            if (settings.general.timezone && document.getElementById('timezone')) {
                document.getElementById('timezone').value = settings.general.timezone;
            }
        }

        // Загружаем настройки безопасности
        if (settings.security) {
            if (document.getElementById('autoApprove')) {
                document.getElementById('autoApprove').checked = settings.security.autoApprove || false;
            }
            if (document.getElementById('twoFactor')) {
                document.getElementById('twoFactor').checked = settings.security.twoFactor || false;
            }
            if (settings.security.sessionDays && document.getElementById('sessionDays')) {
                document.getElementById('sessionDays').value = settings.security.sessionDays;
            }
            if (settings.security.minPasswordLength && document.getElementById('minPasswordLength')) {
                document.getElementById('minPasswordLength').value = settings.security.minPasswordLength;
            }
        }

        // Загружаем настройки уведомлений
        if (settings.notifications) {
            if (document.getElementById('emailNotifications')) {
                document.getElementById('emailNotifications').checked = settings.notifications.email !== false;
            }
            if (document.getElementById('pushNotifications')) {
                document.getElementById('pushNotifications').checked = settings.notifications.push || false;
            }
            if (document.getElementById('registrationNotifications')) {
                document.getElementById('registrationNotifications').checked = settings.notifications.registration !== false;
            }
        }

        console.log('Настройки загружены из localStorage');
    } catch (error) {
        console.error('Ошибка при загрузке настроек:', error);
    }
}

// ===================================================================
// ЛЕНТА СОБЫТИЙ (УВЕДОМЛЕНИЯ)
// ===================================================================

// Массив событий (в реальности будет загружаться с сервера)
let systemEvents = [];
let filteredEvents = [];

/**
 * Генерация тестовых событий для демонстрации
 */
function generateMockEvents() {
    const events = [
        {
            id: 1,
            type: 'login',
            category: 'auth',
            title: 'Вход в систему',
            user: 'Гуркин Никита Олегович',
            description: 'Успешная аутентификация',
            timestamp: new Date(Date.now() - 1000 * 60 * 5),
            ip: '192.168.1.45',
            status: 'success'
        },
        {
            id: 2,
            type: 'register',
            category: 'user',
            title: 'Новая регистрация',
            user: 'Лопатина Виктория Валерьевна',
            description: 'Запрос на регистрацию нового пользователя',
            timestamp: new Date(Date.now() - 1000 * 60 * 15),
            ip: '192.168.1.78',
            status: 'pending'
        },
        {
            id: 3,
            type: 'approved',
            category: 'user',
            title: 'Пользователь одобрен',
            user: 'Майер Леонид Владимирович',
            description: 'Регистрация подтверждена администратором',
            timestamp: new Date(Date.now() - 1000 * 60 * 30),
            admin: 'Гуркин Никита Олегович',
            status: 'success'
        },
        {
            id: 4,
            type: 'role-change',
            category: 'user',
            title: 'Изменение роли',
            user: 'Ефремов Дмитрий Александрович',
            description: 'Роль изменена с "Пользователь" на "Администратор"',
            timestamp: new Date(Date.now() - 1000 * 60 * 45),
            admin: 'Гуркин Никита Олегович',
            status: 'warning'
        },
        {
            id: 5,
            type: 'password-change',
            category: 'security',
            title: 'Смена пароля',
            user: 'Аньимов Юрий Сергеевич',
            description: 'Пользователь изменил пароль',
            timestamp: new Date(Date.now() - 1000 * 60 * 60),
            ip: '192.168.1.92',
            status: 'info'
        },
        {
            id: 6,
            type: 'logout',
            category: 'auth',
            title: 'Выход из системы',
            user: 'Майер Леонид Владимирович',
            description: 'Завершение сеанса работы',
            timestamp: new Date(Date.now() - 1000 * 60 * 90),
            ip: '192.168.1.56',
            status: 'info'
        },
        {
            id: 7,
            type: 'rejected',
            category: 'user',
            title: 'Регистрация отклонена',
            user: 'Иванов Иван Иванович',
            description: 'Запрос на регистрацию отклонен администратором',
            timestamp: new Date(Date.now() - 1000 * 60 * 120),
            admin: 'Гуркин Никита Олегович',
            status: 'danger'
        },
        {
            id: 8,
            type: 'failed-login',
            category: 'security',
            title: 'Неудачная попытка входа',
            user: 'Неизвестный пользователь',
            description: 'Попытка входа с неверными учетными данными',
            timestamp: new Date(Date.now() - 1000 * 60 * 150),
            ip: '192.168.1.123',
            status: 'danger'
        },
        {
            id: 9,
            type: 'delete',
            category: 'user',
            title: 'Удаление пользователя',
            user: 'Петров Петр Петрович',
            description: 'Пользователь удален из системы',
            timestamp: new Date(Date.now() - 1000 * 60 * 180),
            admin: 'Гуркин Никита Олегович',
            status: 'danger'
        },
        {
            id: 10,
            type: 'login',
            category: 'auth',
            title: 'Вход в систему',
            user: 'Ефремов Дмитрий Александрович',
            description: 'Успешная аутентификация',
            timestamp: new Date(Date.now() - 1000 * 60 * 240),
            ip: '192.168.1.67',
            status: 'success'
        }
    ];
    
    return events;
}

/**
 * Получение иконки для типа события
 */
function getEventIcon(type) {
    const icons = {
        'login': 'fa-sign-in-alt',
        'logout': 'fa-sign-out-alt',
        'register': 'fa-user-plus',
        'approve': 'fa-check-circle',
        'reject': 'fa-times-circle',
        'role_change': 'fa-user-shield',
        'password_change': 'fa-key',
        'delete': 'fa-trash-alt',
        'failed_login': 'fa-exclamation-triangle',
        'create': 'fa-plus-circle',
        'update': 'fa-edit'
    };
    return icons[type] || 'fa-info-circle';
}

/**
 * Форматирование времени
 */
function formatEventTime(timestamp) {
    // Проверяем, что timestamp валидный
    if (!timestamp || !(timestamp instanceof Date) || isNaN(timestamp.getTime())) {
        return 'Неизвестно';
    }
    
    const now = new Date();
    const diff = now - timestamp;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    
    if (minutes < 1) return 'Только что';
    if (minutes < 60) return `${minutes} мин. назад`;
    if (hours < 24) return `${hours} ч. назад`;
    if (days < 7) return `${days} дн. назад`;
    
    return timestamp.toLocaleDateString('ru-RU', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

/**
 * Рендер ленты событий
 */
function renderEvents(events = filteredEvents) {
    const timeline = document.getElementById('eventsTimeline');
    const eventCount = document.getElementById('eventCount');
    
    if (!timeline) return;
    
    if (events.length === 0) {
        timeline.innerHTML = `
            <div class="events-empty">
                <i class="fas fa-inbox"></i>
                <h3>Нет событий</h3>
                <p>События не найдены по выбранным фильтрам</p>
            </div>
        `;
        if (eventCount) eventCount.textContent = '0 событий';
        return;
    }
    
    timeline.innerHTML = events.map(event => `
        <div class="event-item event-${event.type}">
            <div class="event-icon icon-${event.type}">
                <i class="fas ${getEventIcon(event.type)}"></i>
            </div>
            <div class="event-content">
                <div class="event-header">
                    <h4 class="event-title">${event.title}</h4>
                    <span class="event-time">${formatEventTime(event.timestamp)}</span>
                </div>
                <p class="event-description">
                    ${event.admin ? `<span class="event-user">${event.admin}</span>` : `<span class="event-user">${event.user}</span>`} — ${event.description}
                </p>
                <div class="event-details">
                    ${event.ip ? `
                        <div class="event-detail-item">
                            <i class="fas fa-network-wired"></i>
                            <span class="event-ip">${event.ip}</span>
                        </div>
                    ` : ''}
                    <div class="event-detail-item">
                        <span class="event-badge badge-${event.status}">
                            ${event.status === 'success' ? 'Успешно' : 
                              event.status === 'warning' ? 'Внимание' :
                              event.status === 'danger' ? 'Критично' : 'Информация'}
                        </span>
                    </div>
                </div>
            </div>
        </div>
    `).join('');
    
    if (eventCount) {
        const count = events.length;
        eventCount.textContent = `${count} ${count === 1 ? 'событие' : count < 5 ? 'события' : 'событий'}`;
    }
}

/**
 * Фильтрация событий
 */
async function filterEvents() {
    await refreshEvents();
}

/**
 * Сброс фильтров
 */
function clearFilters() {
    if (document.getElementById('eventTypeFilter')) {
        document.getElementById('eventTypeFilter').value = 'all';
    }
    if (document.getElementById('periodFilter')) {
        document.getElementById('periodFilter').value = 'month';
    }
    if (document.getElementById('searchEvents')) {
        document.getElementById('searchEvents').value = '';
    }
    filterEvents();
}

/**
 * Обновление событий с сервера
 */
async function refreshEvents() {
    try {
        // Получаем текущие фильтры
        const typeFilter = document.getElementById('eventTypeFilter')?.value || 'all';
        const periodFilter = document.getElementById('periodFilter')?.value || 'month';
        const searchQuery = document.getElementById('searchEvents')?.value || '';
        
        // Формируем параметры запроса
        const params = new URLSearchParams();
        if (typeFilter !== 'all') params.append('category', typeFilter);
        if (periodFilter !== 'all') params.append('period', periodFilter);
        if (searchQuery) params.append('search', searchQuery);
        params.append('limit', '100');
        
        // Загружаем события с сервера
        const response = await fetch(`/api/admin/events?${params.toString()}`);
        if (!response.ok) throw new Error('Ошибка загрузки событий');
        
        const data = await response.json();
        
        // Преобразуем данные с сервера в формат для отображения
        systemEvents = data.events.map(event => {
            // Парсим timestamp - может быть строка ISO или число (миллисекунды)
            let timestamp = new Date(event.timestamp);
            
            // Если парсинг не удался, пробуем как число
            if (isNaN(timestamp.getTime()) && typeof event.timestamp === 'string') {
                timestamp = new Date(parseInt(event.timestamp));
            }
            
            // Если все еще невалидно, используем текущее время
            if (isNaN(timestamp.getTime())) {
                console.warn('Невалидный timestamp для события:', event);
                timestamp = new Date();
            }
            
            return {
                id: event.id,
                type: event.type,
                category: event.category,
                title: event.title,
                user: event.user_name,
                description: event.description,
                timestamp: timestamp,
                ip: event.ip_address,
                admin: event.admin_name,
                status: event.status || 'info'
            };
        });
        
        filteredEvents = [...systemEvents];
        renderEvents();
        showNotification('События обновлены', 'success');
    } catch (error) {
        console.error('Ошибка при загрузке событий:', error);
        showNotification('Ошибка при загрузке событий', 'error');
    }
}

/**
 * Инициализация ленты событий
 */
async function initializeEvents() {
    await refreshEvents();
    
    // Подключаемся к SSE для получения событий в реальном времени
    console.log('[Events] Подключение к SSE...');
    const eventSource = new EventSource('/api/events');
    
    eventSource.onopen = () => {
        console.log('[Events] SSE соединение установлено');
    };
    
    eventSource.addEventListener('newEvent', (e) => {
        console.log('[Events] Получено новое событие через SSE:', e.data);
        try {
            const newEvent = JSON.parse(e.data);
            console.log('[Events] Распарсенное событие:', newEvent);
            
            // Преобразуем данные в формат для отображения
            const formattedEvent = {
                id: newEvent.id,
                type: newEvent.type,
                category: newEvent.category,
                title: newEvent.title,
                user: newEvent.user_name,
                description: newEvent.description,
                timestamp: new Date(newEvent.timestamp),
                ip: newEvent.ip_address,
                admin: newEvent.admin_name,
                status: newEvent.status || 'info'
            };
            
            console.log('[Events] Отформатированное событие:', formattedEvent);
            
            // Добавляем новое событие в начало массива
            systemEvents.unshift(formattedEvent);
            
            // Применяем текущие фильтры
            const typeFilter = document.getElementById('eventTypeFilter')?.value || 'all';
            const periodFilter = document.getElementById('periodFilter')?.value || 'month';
            const searchQuery = document.getElementById('searchEvents')?.value || '';
            
            let shouldShow = true;
            
            // Проверяем фильтр по типу
            if (typeFilter !== 'all' && formattedEvent.category !== typeFilter) {
                shouldShow = false;
            }
            
            // Проверяем фильтр по периоду
            const now = new Date();
            if (periodFilter === 'today') {
                const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                if (formattedEvent.timestamp < today) shouldShow = false;
            } else if (periodFilter === 'week') {
                const weekAgo = new Date(now - 7 * 24 * 60 * 60 * 1000);
                if (formattedEvent.timestamp < weekAgo) shouldShow = false;
            } else if (periodFilter === 'month') {
                const monthAgo = new Date(now - 30 * 24 * 60 * 60 * 1000);
                if (formattedEvent.timestamp < monthAgo) shouldShow = false;
            }
            
            // Проверяем поиск
            if (searchQuery && shouldShow) {
                if (!formattedEvent.user.toLowerCase().includes(searchQuery.toLowerCase()) &&
                    !formattedEvent.description.toLowerCase().includes(searchQuery.toLowerCase())) {
                    shouldShow = false;
                }
            }
            
            console.log('[Events] Событие проходит фильтры:', shouldShow);
            
            if (shouldShow) {
                filteredEvents.unshift(formattedEvent);
                renderEvents();
                
                // Показываем уведомление о новом событии
                showNotification(`Новое событие: ${formattedEvent.title}`, 'info');
                console.log('[Events] Событие добавлено в ленту');
            } else {
                console.log('[Events] Событие не прошло фильтры, не отображается');
            }
        } catch (error) {
            console.error('[Events] Ошибка при обработке нового события:', error);
        }
    });
    
    eventSource.onerror = (error) => {
        console.error('[Events] Ошибка SSE соединения:', error);
        // Пытаемся переподключиться автоматически
    };
}
