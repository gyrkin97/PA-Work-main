/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
    return knex.schema.createTable('system_events', (table) => {
        table.increments('id').primary();
        table.string('type', 50).notNullable(); // login, logout, register, approved, rejected, role-change, password-change, delete, failed-login
        table.string('category', 50).notNullable(); // auth, user, security, system
        table.string('title', 255).notNullable();
        table.integer('user_id').unsigned().nullable();
        table.string('user_name', 255).notNullable();
        table.text('description').notNullable();
        table.timestamp('timestamp').defaultTo(knex.fn.now()).notNullable();
        table.string('ip_address', 45).nullable();
        table.integer('admin_id').unsigned().nullable();
        table.string('admin_name', 255).nullable();
        table.string('status', 20).notNullable(); // success, warning, danger, info, pending
        table.json('metadata').nullable(); // Дополнительные данные в JSON
        
        // Индексы для быстрого поиска
        table.index('type');
        table.index('category');
        table.index('user_id');
        table.index('timestamp');
        
        // Внешние ключи
        table.foreign('user_id').references('users.id').onDelete('SET NULL');
        table.foreign('admin_id').references('users.id').onDelete('SET NULL');
    });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
    return knex.schema.dropTableIfExists('system_events');
};
