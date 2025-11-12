/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function(knex) {
  // Назначаем роль superadmin для указанных пользователей
  const superadminNames = ['Майер', 'Ефремов', 'Гуркин', 'Алымов'];
  
  for (const name of superadminNames) {
    await knex('users')
      .where('name', 'like', `%${name}%`)
      .update({ role: 'superadmin' });
  }
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function(knex) {
  // Возвращаем роль admin для суперадминов
  await knex('users')
    .where('role', 'superadmin')
    .update({ role: 'admin' });
};
