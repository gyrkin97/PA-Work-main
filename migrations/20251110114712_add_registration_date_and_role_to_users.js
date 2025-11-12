/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function(knex) {
  // Добавляем колонки без значений по умолчанию
  await knex.schema.table('users', function(table) {
    table.timestamp('registrationDate').nullable();
    table.string('role').nullable();
  });
  
  // Устанавливаем значения для существующих записей
  await knex('users').update({
    registrationDate: new Date('2025-11-10'),
    role: 'admin'
  });
  
  // Делаем колонки NOT NULL (теперь у всех есть значения)
  await knex.raw('PRAGMA foreign_keys = OFF');
  await knex.raw(`
    CREATE TABLE users_new (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      position TEXT NOT NULL,
      password TEXT NOT NULL,
      resetToken TEXT,
      resetTokenExpiry INTEGER,
      registrationDate DATETIME NOT NULL,
      role TEXT NOT NULL
    )
  `);
  await knex.raw(`
    INSERT INTO users_new (id, name, position, password, resetToken, resetTokenExpiry, registrationDate, role)
    SELECT id, name, position, password, resetToken, resetTokenExpiry, registrationDate, role FROM users
  `);
  await knex.raw('DROP TABLE users');
  await knex.raw('ALTER TABLE users_new RENAME TO users');
  await knex.raw('PRAGMA foreign_keys = ON');
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return knex.schema.table('users', function(table) {
    table.dropColumn('registrationDate');
    table.dropColumn('role');
  });
};
