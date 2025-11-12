// ===================================================================
// Файл: services/geographyStatsService.js (СТАРАЯ СХЕМА: employeeId)
// ===================================================================
const { knex } = require('../config/database');

exports.calculateGeographyStats = async (year, employeeId) => {
    // Приводим год к строке для корректной работы с SQLite
    const yearParam = [String(year)];

    // --- 1. Запрос для получения 50 самых популярных городов ---
    let topCitiesQuery = knex('trips as t')
        .select('t.destination as city')
        .count('t.id as visits')
        .whereRaw("strftime('%Y', t.startDate) = ?", yearParam)
        .groupBy('t.destination')
        .orderBy('visits', 'desc')
        .limit(50);

    // --- 2. Запрос для получения общего количества поездок ---
    let totalTripsQuery = knex('trips as t')
        .whereRaw("strftime('%Y', t.startDate) = ?", yearParam)
        .count('t.id as totalTrips')
        .first();

    // --- ЕСЛИ ПЕРЕДАН ID СОТРУДНИКА, МОДИФИЦИРУЕМ ЗАПРОСЫ (СТАРАЯ СХЕМА: employeeId) ---
    if (employeeId) {
        // Фильтруем по employeeId в таблице trips
        topCitiesQuery = topCitiesQuery.where('t.employeeId', employeeId);
        totalTripsQuery = totalTripsQuery.where('t.employeeId', employeeId);
    }
    
    // Выполняем оба запроса параллельно
    const [topCities, totalTripsData] = await Promise.all([
        topCitiesQuery,
        totalTripsQuery
    ]);

    // Возвращаем структурированный объект
    return {
        year,
        topCities: topCities || [],
        totalTrips: totalTripsData ? totalTripsData.totalTrips : 0
    };
};