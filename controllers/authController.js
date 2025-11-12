// ===================================================================
// Файл: controllers/authController.js (ФИНАЛЬНАЯ ВЕРСИЯ С ИСПРАВЛЕНИЕМ СЕССИИ)
// ===================================================================
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const { knex } = require('../config/database');
const eventLogService = require('../services/eventLogService');

const saltRounds = 10;
const port = process.env.PORT || 3000;

// --- РЕГИСТРАЦИЯ ---
exports.register = async (req, res, next) => {
    const { name, position, password } = req.body;
    try {
        const user = await knex('users').whereRaw('lower(name) = lower(?)', [name]).first();
        if (user) {
            return res.status(409).json({ errors: [{ message: 'Пользователь с таким ФИО уже существует.' }] });
        }
        
        const hashedPassword = await bcrypt.hash(password, saltRounds);
        const [userId] = await knex('users').insert({ 
            name, 
            position, 
            password: hashedPassword,
            registrationDate: new Date().toISOString(),
            role: 'user',
            status: 'pending' // Новый пользователь ожидает подтверждения
        });
        
        // Логируем событие регистрации
        try {
            await eventLogService.logEvent({
                type: 'register',
                category: 'user',
                title: 'Новая регистрация',
                userId: userId,
                userName: name,
                description: `Зарегистрирован пользователь: ${name}, должность: ${position}`,
                ipAddress: req.ip || req.connection.remoteAddress,
                status: 'pending'
            });
        } catch (logError) {
            console.error('Ошибка при логировании события регистрации:', logError);
        }
        
        res.status(201).json({ message: 'Регистрация прошла успешно! Ожидайте подтверждения администратора.' });
    } catch (error) {
        console.error("Ошибка при регистрации:", error);
        next(error);
    }
};

// --- ВХОД В СИСТЕМУ ---
exports.login = async (req, res, next) => {
    const { name, password } = req.body;
    try {
        const user = await knex('users').whereRaw('lower(name) = lower(?)', [name]).first();
        if (!user) {
            return res.status(401).json({ errors: [{ message: 'Неверное ФИО или пароль.' }] });
        }

        // Проверка статуса пользователя (только отклоненные не могут войти)
        if (user.status === 'rejected') {
            return res.status(403).json({ errors: [{ message: 'Ваша регистрация была отклонена.' }] });
        }

        const passwordMatch = await bcrypt.compare(password, user.password);
        if (!passwordMatch) {
            // Логируем неудачную попытку входа
            try {
                await eventLogService.logEvent({
                    type: 'login',
                    category: 'security',
                    title: 'Неудачная попытка входа',
                    userId: user.id,
                    userName: name,
                    description: `Неверный пароль для пользователя: ${name}`,
                    ipAddress: req.ip || req.connection.remoteAddress,
                    status: 'failed'
                });
            } catch (logError) {
                console.error('Ошибка при логировании неудачного входа:', logError);
            }
            return res.status(401).json({ errors: [{ message: 'Неверное ФИО или пароль.' }] });
        }
        
        // Сохраняем пользователя в сессии, включая статус
        req.session.user = { 
            id: user.id, 
            name: user.name, 
            position: user.position,
            role: user.role || 'user',
            status: user.status || 'active'
        };

        // Логируем успешный вход
        try {
            await eventLogService.logEvent({
                type: 'login',
                category: 'user',
                title: 'Вход в систему',
                userId: user.id,
                userName: user.name,
                description: `Пользователь ${user.name} вошел в систему`,
                ipAddress: req.ip || req.connection.remoteAddress,
                status: 'success'
            });
        } catch (logError) {
            console.error('Ошибка при логировании входа:', logError);
        }

        // ========================================================
        // +++ КЛЮЧЕВОЕ ИСПРАВЛЕНИЕ +++
        // Мы принудительно сохраняем сессию и отправляем ответ
        // только ПОСЛЕ того, как она гарантированно сохранится.
        // ========================================================
        req.session.save((err) => {
            if (err) {
                // Если произошла ошибка при сохранении сессии, передаем ее дальше
                console.error("Ошибка при сохранении сессии:", err);
                return next(err);
            }
            // Теперь сессия сохранена, и мы можем безопасно отправить ответ
            res.status(200).json({ message: `Добро пожаловать, ${user.name}!` });
        });

    } catch (error) {
        console.error("Ошибка при входе в систему:", error);
        next(error);
    }
};

// --- ЗАПРОС НА СБРОС ПАРОЛЯ ---
exports.forgotPassword = async (req, res, next) => {
    const { name } = req.body;
    try {
        const now = Date.now();
        await knex('users')
            .where('resetTokenExpiry', '<', now)
            .update({
                resetToken: null,
                resetTokenExpiry: null
            });

        const user = await knex('users').whereRaw('lower(name) = lower(?)', [name]).first();
        if (!user) {
            return res.status(404).json({ errors: [{ message: 'Пользователь с таким ФИО не найден.' }] });
        }

        const resetToken = crypto.randomBytes(32).toString('hex');
        const resetTokenExpiry = now + 3600000; // 1 час

        await knex('users').where({ id: user.id }).update({ resetToken, resetTokenExpiry });
        
        const baseUrl = process.env.APP_BASE_URL || `http://localhost:${port}`;
        const resetLink = `${baseUrl}/reset-password?token=${resetToken}`;
        
        res.status(200).json({ message: 'Ссылка для сброса пароля сгенерирована.', link: resetLink });
    } catch (error) {
        console.error("Ошибка при запросе сброса пароля:", error);
        next(error);
    }
};

// --- СБРОС ПАРОЛЯ ---
exports.resetPassword = async (req, res, next) => {
    const { token, password } = req.body;
    try {
        const user = await knex('users').where({ resetToken: token }).andWhere('resetTokenExpiry', '>', Date.now()).first();
        if (!user) {
            return res.status(400).json({ errors: [{ message: 'Токен недействителен или срок его действия истек.' }] });
        }
        
        const hashedPassword = await bcrypt.hash(password, saltRounds);
        await knex('users').where({ id: user.id }).update({
            password: hashedPassword,
            resetToken: null,
            resetTokenExpiry: null
        });

        res.status(200).json({ message: 'Пароль успешно обновлен!' });
    } catch (error) {
        console.error("Ошибка при сбросе пароля:", error);
        next(error);
    }
};

// --- ПОЛУЧЕНИЕ ДАННЫХ ТЕКУЩЕГО ПОЛЬЗОВАТЕЛЯ ---
exports.getCurrentUser = async (req, res) => {
    try {
        if (req.session.user) {
            // Получаем актуальные данные пользователя из БД, включая роль и статус
            const user = await knex('users')
                .where('id', req.session.user.id)
                .select('id', 'name', 'position', 'role', 'status')
                .first();
            
            if (user) {
                // Обновляем данные в сессии
                req.session.user = {
                    id: user.id,
                    name: user.name,
                    position: user.position,
                    role: user.role,
                    status: user.status
                };
                res.json(user);
            } else {
                // Пользователь удален из БД - возвращаем 404
                res.status(404).json({ errors: [{ message: 'Пользователь не найден' }] });
            }
        } else {
            res.status(401).json({ errors: [{ message: 'Пользователь не авторизован' }] });
        }
    } catch (error) {
        console.error("Ошибка при получении данных пользователя:", error);
        res.status(500).json({ errors: [{ message: 'Ошибка сервера' }] });
    }
};

// --- ВЫХОД ИЗ СИСТЕМЫ ---
exports.logout = async (req, res) => {
    const userName = req.session.user?.name;
    const userId = req.session.user?.id;
    const ipAddress = req.ip || req.connection.remoteAddress;
    
    // Логируем выход из системы ДО уничтожения сессии
    if (userName && userId) {
        try {
            await eventLogService.logEvent({
                type: 'logout',
                category: 'auth',
                title: 'Выход из системы',
                userId: userId,
                userName: userName,
                description: `Пользователь ${userName} вышел из системы`,
                ipAddress: ipAddress,
                status: 'success'
            });
        } catch (logError) {
            console.error('Ошибка при логировании выхода:', logError);
        }
    }
    
    req.session.destroy(err => {
        if (err) {
            console.error("Ошибка при выходе из системы:", err);
            // Даже если есть ошибка, пытаемся перенаправить
            return res.redirect('/dashboard');
        }
        
        res.clearCookie('connect.sid');
        res.redirect('/');
    });
};

// --- ПОЛУЧЕНИЕ ВСЕХ ПОЛЬЗОВАТЕЛЕЙ (ДЛЯ АДМИН-ПАНЕЛИ) ---
exports.getAllUsers = async (req, res, next) => {
    try {
        const users = await knex('users')
            .select('id', 'name', 'position', 'role', 'registrationDate', 'status')
            .orderBy('id', 'desc');
        
        res.json(users);
    } catch (error) {
        console.error("Ошибка при получении списка пользователей:", error);
        next(error);
    }
};

// --- ПОЛУЧЕНИЕ СТАТИСТИКИ (ДЛЯ АДМИН-ПАНЕЛИ) ---
exports.getAdminStats = async (req, res, next) => {
    try {
        // Общее количество пользователей
        const totalUsersResult = await knex('users').count('* as count').first();
        const totalUsers = totalUsersResult.count || 0;
        
        // Активные пользователи
        const activeUsersResult = await knex('users')
            .where('status', 'active')
            .count('* as count')
            .first();
        const activeUsers = activeUsersResult.count || 0;
        
        // Ожидающие подтверждения
        const pendingUsersResult = await knex('users')
            .where('status', 'pending')
            .count('* as count')
            .first();
        const pendingUsers = pendingUsersResult.count || 0;
        
        // События безопасности (можно подсчитать из логов или специальной таблицы)
        // Например: неудачные попытки входа, сброс паролей и т.д.
        const securityEventsResult = await knex('users')
            .whereNotNull('resetToken')
            .count('* as count')
            .first();
        const securityEvents = securityEventsResult.count || 0;
        
        const stats = {
            totalUsers,
            activeUsers,
            pendingUsers,
            securityEvents
        };
        
        res.json(stats);
    } catch (error) {
        console.error("Ошибка при получении статистики:", error);
        next(error);
    }
};

// --- УДАЛЕНИЕ ПОЛЬЗОВАТЕЛЯ (ТОЛЬКО ДЛЯ СУПЕРАДМИНОВ) ---
exports.deleteUser = async (req, res, next) => {
    try {
        const userId = parseInt(req.params.id);
        const currentUser = req.session.user;
        
        // Проверяем, что пользователь является суперадмином
        const user = await knex('users').where('id', currentUser.id).first();
        if (!user || user.role !== 'superadmin') {
            return res.status(403).json({ 
                message: 'Доступ запрещен. Только супер-администраторы могут удалять пользователей.' 
            });
        }
        
        // Проверяем, что пользователь не пытается удалить сам себя
        if (userId === currentUser.id) {
            return res.status(400).json({ 
                message: 'Вы не можете удалить свою учетную запись.' 
            });
        }
        
        // Получаем данные удаляемого пользователя перед удалением
        const deletedUser = await knex('users').where('id', userId).first();
        
        // Удаляем пользователя
        const deleted = await knex('users').where('id', userId).del();
        
        if (deleted === 0) {
            return res.status(404).json({ 
                message: 'Пользователь не найден.' 
            });
        }
        
        // Логируем удаление пользователя (userId = null, т.к. пользователь удален)
        try {
            await eventLogService.logEvent({
                type: 'delete',
                category: 'user',
                title: 'Удаление пользователя',
                userId: null, // Не используем userId, т.к. пользователь уже удален
                userName: deletedUser.name,
                description: `Пользователь ${deletedUser.name} был удален`,
                ipAddress: req.ip || req.connection.remoteAddress,
                adminId: currentUser.id,
                adminName: currentUser.name,
                status: 'success'
            });
        } catch (logError) {
            console.error('Ошибка при логировании удаления:', logError);
        }
        
        res.json({ message: 'Пользователь успешно удален' });
    } catch (error) {
        console.error("Ошибка при удалении пользователя:", error);
        next(error);
    }
};

// --- ИЗМЕНЕНИЕ РОЛИ ПОЛЬЗОВАТЕЛЯ (ТОЛЬКО ДЛЯ СУПЕРАДМИНОВ) ---
exports.updateUserRole = async (req, res, next) => {
    try {
        const userId = parseInt(req.params.id);
        const { role } = req.body;
        const currentUser = req.session.user;
        
        // Проверяем, что пользователь является суперадмином
        const user = await knex('users').where('id', currentUser.id).first();
        if (!user || user.role !== 'superadmin') {
            return res.status(403).json({ 
                message: 'Доступ запрещен. Только супер-администраторы могут изменять роли.' 
            });
        }
        
        // Валидация роли
        const validRoles = ['user', 'admin', 'superadmin'];
        if (!validRoles.includes(role)) {
            return res.status(400).json({ 
                message: 'Недопустимое значение роли.' 
            });
        }
        
        // Получаем данные пользователя перед обновлением
        const targetUser = await knex('users').where('id', userId).first();
        if (!targetUser) {
            return res.status(404).json({ 
                message: 'Пользователь не найден.' 
            });
        }
        
        const oldRole = targetUser.role;
        
        // Русификация названий ролей
        const roleNames = {
            'user': 'Пользователь',
            'admin': 'Модератор',
            'superadmin': 'Администратор'
        };
        
        // Обновляем роль
        const updated = await knex('users')
            .where('id', userId)
            .update({ role });
        
        if (updated === 0) {
            return res.status(404).json({ 
                message: 'Пользователь не найден.' 
            });
        }
        
        // Логируем изменение роли
        try {
            await eventLogService.logEvent({
                type: 'role_change',
                category: 'settings',
                title: 'Изменение роли',
                userId: targetUser.id,
                userName: targetUser.name,
                description: `Роль пользователя ${targetUser.name} изменена с "${roleNames[oldRole] || oldRole}" на "${roleNames[role] || role}"`,
                ipAddress: req.ip || req.connection.remoteAddress,
                adminId: currentUser.id,
                adminName: currentUser.name,
                status: 'success',
                metadata: JSON.stringify({ oldRole, newRole: role })
            });
        } catch (logError) {
            console.error('Ошибка при логировании изменения роли:', logError);
        }
        
        res.json({ message: 'Роль пользователя успешно обновлена', role });
    } catch (error) {
        console.error("Ошибка при обновлении роли:", error);
        next(error);
    }
};

// --- ПОДТВЕРЖДЕНИЕ РЕГИСТРАЦИИ ---
exports.approveUser = async (req, res, next) => {
    try {
        const userId = parseInt(req.params.id);
        const currentUser = req.session.user;
        
        if (!currentUser) {
            return res.status(401).json({ message: 'Необходима авторизация' });
        }
        
        // Проверяем, что пользователь является суперадмином
        const user = await knex('users').where('id', currentUser.id).first();
        if (!user || user.role !== 'superadmin') {
            return res.status(403).json({ 
                message: 'Доступ запрещен. Только супер-администраторы могут подтверждать регистрацию.' 
            });
        }
        
        // Получаем данные пользователя перед обновлением
        const targetUser = await knex('users').where('id', userId).first();
        if (!targetUser) {
            return res.status(404).json({ message: 'Пользователь не найден.' });
        }
        
        // Обновляем статус на active
        const updated = await knex('users')
            .where('id', userId)
            .update({ status: 'active' });
        
        if (updated === 0) {
            return res.status(404).json({ message: 'Пользователь не найден.' });
        }
        
        // Логируем подтверждение регистрации
        try {
            await eventLogService.logEvent({
                type: 'approve',
                category: 'user',
                title: 'Регистрация подтверждена',
                userId: targetUser.id,
                userName: targetUser.name,
                description: `Регистрация пользователя ${targetUser.name} подтверждена`,
                ipAddress: req.ip || req.connection.remoteAddress,
                adminId: currentUser.id,
                adminName: currentUser.name,
                status: 'success'
            });
        } catch (logError) {
            console.error('Ошибка при логировании подтверждения:', logError);
        }
        
        res.json({ message: 'Регистрация пользователя подтверждена' });
    } catch (error) {
        console.error("Ошибка при подтверждении регистрации:", error);
        next(error);
    }
};

// --- ОТКЛОНЕНИЕ РЕГИСТРАЦИИ ---
exports.rejectUser = async (req, res, next) => {
    try {
        const userId = parseInt(req.params.id);
        const currentUser = req.session.user;
        
        if (!currentUser) {
            return res.status(401).json({ message: 'Необходима авторизация' });
        }
        
        // Проверяем, что пользователь является суперадмином
        const user = await knex('users').where('id', currentUser.id).first();
        if (!user || user.role !== 'superadmin') {
            return res.status(403).json({ 
                message: 'Доступ запрещен. Только супер-администраторы могут отклонять регистрацию.' 
            });
        }
        
        // Получаем данные пользователя перед удалением
        const targetUser = await knex('users').where('id', userId).first();
        if (!targetUser) {
            return res.status(404).json({ message: 'Пользователь не найден.' });
        }
        
        // Удаляем пользователя
        const deleted = await knex('users')
            .where('id', userId)
            .delete();
        
        if (deleted === 0) {
            return res.status(404).json({ message: 'Пользователь не найден.' });
        }
        
        // Логируем отклонение регистрации (userId = null, т.к. пользователь удален)
        try {
            await eventLogService.logEvent({
                type: 'reject',
                category: 'user',
                title: 'Регистрация отклонена',
                userId: null, // Не используем userId, т.к. пользователь уже удален
                userName: targetUser.name,
                description: `Регистрация пользователя ${targetUser.name} отклонена и удалена`,
                ipAddress: req.ip || req.connection.remoteAddress,
                adminId: currentUser.id,
                adminName: currentUser.name,
                status: 'rejected'
            });
        } catch (logError) {
            console.error('Ошибка при логировании отклонения:', logError);
        }
        
        res.json({ message: 'Регистрация пользователя отклонена' });
    } catch (error) {
        console.error("Ошибка при отклонении регистрации:", error);
        next(error);
    }
};