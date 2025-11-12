/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function(knex) {
  await knex.schema.table('users', function(table) {
    table.string('status').defaultTo('pending'); // pending, active, rejected
  });

  // Установить всем существующим пользователям статус "active"
  await knex('users').update({ status: 'active' });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return knex.schema.table('users', function(table) {
    table.dropColumn('status');
  });
};
