// ===================================================================
// File: services/statsService.js (СТАРАЯ СХЕМА: employeeId + groupId)
// ===================================================================
const { knex } = require('../config/database');

// Вспомогательная функция для форматирования ФИО
const formatName = (emp) => {
    if (!emp) return '';
    return `${emp.lastName} ${emp.firstName[0]}. ${emp.patronymic ? emp.patronymic[0] + '.' : ''}`.trim();
};

exports.calculateGlobalStats = async (year) => {
    // Получаем сегодняшнюю дату для корректного расчета дней
    const today = new Date().toISOString().split('T')[0];
    
    // Приводим год к строке для корректной работы с SQLite
    const yearStr = String(year);

    // --- БЛОК 1: ОСНОВНЫЕ ПОКАЗАТЕЛИ ---
    
    // Подсчёт уникальных командировок с учётом группировки
    // Группируем по groupId (если есть) или по id (для одиночных)
    const totalTripsResult = await knex('trips')
        .whereRaw("strftime('%Y', startDate) = ?", [yearStr])
        .select(knex.raw('COALESCE(groupId, CAST(id AS TEXT)) as tripKey'))
        .groupBy('tripKey');
    const totalTripsCount = totalTripsResult.length;

    const summaryPromises = {
        totalTrips: Promise.resolve({ count: totalTripsCount }),
        totalCities: knex('trips').whereRaw("strftime('%Y', startDate) = ?", [yearStr]).countDistinct('destination as count').first(),
        
        // Считает уникальных сотрудников за весь год (СТАРАЯ СХЕМА: employeeId)
        uniqueEmployeesForYear: knex('trips')
            .whereRaw("strftime('%Y', startDate) = ?", [yearStr])
            .whereNotNull('employeeId')
            .countDistinct('employeeId as count')
            .first(),
        
        // Считает уникальных сотрудников, которые в командировке ПРЯМО СЕЙЧАС
        activeEmployeesNow: knex('trips')
            .where('startDate', '<=', today)
            .andWhere('endDate', '>=', today)
            .whereNotNull('employeeId')
            .countDistinct('employeeId as count')
            .first(),

        avgDuration: knex('trips').whereRaw("strftime('%Y', startDate) = ?", [yearStr]).avg({ avg: knex.raw('JULIANDAY(endDate) - JULIANDAY(startDate) + 1') }).first(),
    };

    // --- БЛОК 2: РЕЙТИНГ (СТАРАЯ СХЕМА: employeeId) ---
    // Для подсчёта командировок используем уникальные группы (groupId или id)
    const rankingQuery = knex('trips as t')
        .join('employees as e', 't.employeeId', 'e.id')
        .whereRaw("strftime('%Y', t.startDate) = ?", [yearStr])
        .whereNotNull('t.employeeId')
        .groupBy('e.id')
        .select('e.id', 'e.lastName', 'e.firstName', 'e.patronymic')
        .count({ totalTrips: knex.raw('DISTINCT COALESCE(t.groupId, CAST(t.id AS TEXT))') })
        .countDistinct('t.destination as totalCities')
        .sum({
            totalDays: knex.raw(`
                CASE
                    WHEN t.startDate <= ? THEN CAST(JULIANDAY(MIN(t.endDate, ?)) - JULIANDAY(t.startDate) + 1 AS INTEGER)
                    ELSE 0
                END
            `, [today, today])
        })
        .orderBy('totalDays', 'desc')
        .limit(10);

    // --- БЛОК 3: РЕКОРДЫ (СТАРАЯ СХЕМА: employeeId) ---
    
    const buildDurationRecordQuery = async (aggFunction, valueAlias) => {
        const subqueryResult = await knex('trips')
            .whereRaw("strftime('%Y', startDate) = ?", [yearStr])
            .select(knex.raw(`${aggFunction}(JULIANDAY(endDate) - JULIANDAY(startDate) + 1) as val`))
            .first();

        const targetValue = subqueryResult?.val;
        if (!targetValue) return [];

        return knex('trips as t')
            .join('employees as e', 't.employeeId', 'e.id')
            .whereRaw("strftime('%Y', t.startDate) = ?", [yearStr])
            .whereNotNull('t.employeeId')
            .select('t.destination', 'e.lastName', 'e.firstName', 'e.patronymic')
            .select({ [valueAlias]: knex.raw('JULIANDAY(t.endDate) - JULIANDAY(t.startDate) + 1') })
            .groupBy('t.id', 'e.id')
            .having(knex.raw('JULIANDAY(t.endDate) - JULIANDAY(t.startDate) + 1'), '=', targetValue);
    };

    const buildCountRecordQuery = async (countColumn, valueAlias, groupByFields) => {
        const subqueryResult = await knex('trips as t')
            .whereRaw("strftime('%Y', t.startDate) = ?", [yearStr])
            .whereNotNull('employeeId')
            .groupBy(...groupByFields)
            .countDistinct({ c: countColumn })
            .orderBy('c', 'desc')
            .first();

        const targetValue = subqueryResult?.c;
        if (!targetValue) return [];

        return knex('trips as t')
            .join('employees as e', 't.employeeId', 'e.id')
            .whereRaw("strftime('%Y', t.startDate) = ?", [yearStr])
            .whereNotNull('t.employeeId')
            .groupBy(...groupByFields)
            .select('e.lastName', 'e.firstName', 'e.patronymic')
            .countDistinct({ [valueAlias]: countColumn })
            .having(valueAlias, '=', targetValue);
    };

    const recordPromises = {
        longestTrip: buildDurationRecordQuery('max', 'duration'),
        shortestTrip: buildDurationRecordQuery('min', 'duration'),
        mostTrips: buildCountRecordQuery('t.id', 'tripCount', ['t.employeeId']),
        mostCities: buildCountRecordQuery('t.destination', 'cityCount', ['t.employeeId']),
        monthlySprinter: (async () => {
            const subqueryResult = await knex('trips as t')
                .whereRaw("strftime('%Y', t.startDate) = ?", [yearStr])
                .whereNotNull('employeeId')
                .groupBy('employeeId', knex.raw("strftime('%Y-%m', t.startDate)"))
                .count('t.id as c')
                .orderBy('c', 'desc')
                .first();
            const targetValue = subqueryResult?.c;
            if (!targetValue) return [];
            return knex('trips as t')
                .join('employees as e', 't.employeeId', 'e.id')
                .whereRaw("strftime('%Y', t.startDate) = ?", [yearStr])
                .whereNotNull('t.employeeId')
                .groupBy('t.employeeId', knex.raw("strftime('%Y-%m', t.startDate)"))
                .select('e.lastName', 'e.firstName', 'e.patronymic', knex.raw("strftime('%m', t.startDate) as month"))
                .count('t.id as monthlyCount')
                .having('monthlyCount', '=', targetValue);
        })(),
        keyPartner: (async () => {
            const subqueryResult = await knex('trips as t')
                .whereRaw("strftime('%Y', t.startDate) = ?", [yearStr])
                .whereNotNull('employeeId')
                .groupBy('employeeId', 'organizationId')
                .count('t.id as c')
                .orderBy('c', 'desc')
                .first();
            const targetValue = subqueryResult?.c;
            if (!targetValue) return [];
            return knex('trips as t')
                .join('employees as e', 't.employeeId', 'e.id')
                .join('organizations as o', 't.organizationId', 'o.id')
                .whereRaw("strftime('%Y', t.startDate) = ?", [yearStr])
                .whereNotNull('t.employeeId')
                .groupBy('t.employeeId', 't.organizationId')
                .select('e.lastName', 'e.firstName', 'e.patronymic', 'o.name as organizationName')
                .count('t.id as orgTripCount')
                .having('orgTripCount', '=', targetValue);
        })(),
        transportChampions: (async () => {
            const results = {};
            for (const transport of ['plane', 'train', 'car']) {
                const subqueryResult = await knex('trips as t')
                    .where({ transport })
                    .whereRaw("strftime('%Y', t.startDate) = ?", [yearStr])
                    .whereNotNull('employeeId')
                    .groupBy('employeeId')
                    .count('t.id as c')
                    .orderBy('c', 'desc')
                    .first();
                const targetValue = subqueryResult?.c;
                if (targetValue) {
                    results[transport] = await knex('trips as t')
                        .join('employees as e', 't.employeeId', 'e.id')
                        .where({ transport })
                        .whereRaw("strftime('%Y', t.startDate) = ?", [yearStr])
                        .whereNotNull('t.employeeId')
                        .groupBy('t.employeeId')
                        .select('e.lastName', 'e.firstName', 'e.patronymic')
                        .count('t.id as count')
                        .having('count', '=', targetValue);
                } else {
                    results[transport] = [];
                }
            }
            return results;
        })()
    };

    // --- ОБЪЕДИНЕНИЕ РЕЗУЛЬТАТОВ ---
    const [summaryResults, ranking, transportRows, monthlyRows] = await Promise.all([
        Promise.all(Object.values(summaryPromises)),
        rankingQuery,
        knex('trips').select('transport').count('id as count').whereRaw("strftime('%Y', startDate) = ?", [yearStr]).whereNotNull('transport').groupBy('transport'),
        knex('trips').select(knex.raw("strftime('%m', startDate) as month")).count('id as count').whereRaw("strftime('%Y', startDate) = ?", [yearStr]).groupBy('month')
    ]);

    const recordResults = await Promise.all(Object.values(recordPromises));
    
    const [summaryTrips, summaryCities, summaryUniqueEmployees, summaryActiveEmployees, summaryDuration] = summaryResults;
    const [longestTrip, shortestTrip, mostTrips, mostCities, monthlySprinter, keyPartner, transportChampions] = recordResults;
    
    // --- ПОДГОТОВКА ДАННЫХ ДЛЯ ОТВЕТА ---
    const transport = {
        plane: transportRows.find(r => r.transport === 'plane')?.count || 0,
        train: transportRows.find(r => r.transport === 'train')?.count || 0,
        car: transportRows.find(r => r.transport === 'car')?.count || 0,
    };
    
    const monthly = Array(12).fill(0);
    monthlyRows.forEach(row => { monthly[parseInt(row.month, 10) - 1] = row.count; });

    const formatRecord = (results, valueKey) => {
        if (!results || results.length === 0) return null;
        
        // Убираем дубликаты по сотрудникам (один человек может иметь несколько рекордов)
        const uniqueEmployees = new Map();
        results.forEach(r => {
            const key = `${r.lastName}_${r.firstName}_${r.patronymic || ''}`;
            if (!uniqueEmployees.has(key)) {
                uniqueEmployees.set(key, { ...r, employeeName: formatName(r) });
            }
        });
        
        return {
            value: results[0][valueKey],
            winners: Array.from(uniqueEmployees.values())
        };
    };
    
    const formatTransportChampions = (results) => {
        if (!results || results.length === 0) return null;
        
        // Убираем дубликаты по сотрудникам
        const uniqueEmployees = new Map();
        results.forEach(r => {
            const key = `${r.lastName}_${r.firstName}_${r.patronymic || ''}`;
            if (!uniqueEmployees.has(key)) {
                uniqueEmployees.set(key, { employeeName: formatName(r) });
            }
        });
        
        return {
            value: results[0].count,
            winners: Array.from(uniqueEmployees.values())
        };
    };

    return {
        year,
        summary: {
            totalTrips: summaryTrips.count || 0,
            totalCities: summaryCities.count || 0,
            totalEmployees: summaryActiveEmployees.count || 0,
            uniqueEmployeesForYear: summaryUniqueEmployees.count || 0,
            avgDuration: (summaryDuration.avg || 0).toFixed(1),
        },
        ranking: ranking.map((emp, index) => ({ position: index + 1, name: formatName(emp), ...emp })),
        transport,
        monthly,
        records: {
            longestTrip: formatRecord(longestTrip, 'duration'),
            shortestTrip: formatRecord(shortestTrip, 'duration'),
            mostTrips: formatRecord(mostTrips, 'tripCount'),
            mostCities: formatRecord(mostCities, 'cityCount'),
            monthlySprinter: formatRecord(monthlySprinter, 'monthlyCount'),
            keyPartner: formatRecord(keyPartner, 'orgTripCount'),
            transportChampions: {
                plane: formatTransportChampions(transportChampions.plane),
                train: formatTransportChampions(transportChampions.train),
                car: formatTransportChampions(transportChampions.car),
            }
        }
    };
};
