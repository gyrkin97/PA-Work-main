/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function(knex) {
  await knex.schema.table('employees', function(table) {
    table.string('status').defaultTo('active'); // active или fired
  });

  // Установить всем существующим сотрудникам статус "active"
  await knex('employees').update({ status: 'active' });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return knex.schema.table('employees', function(table) {
    table.dropColumn('status');
  });
};
