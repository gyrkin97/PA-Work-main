// ===================================================================
// Файл: public/js/utils/date-utils.js (ФИНАЛЬНАЯ ВЕРСИЯ С КОРРЕКТНЫМ ИТЕРАТИВНЫМ АЛГОРИТМОМ)
// ===================================================================

// Вспомогательные данные (производственный календарь)
function getHolidaysForYear(year) {
    const holidays = {
        2019: [
            '01.01.2019', '02.01.2019', '03.01.2019', '04.01.2019', '05.01.2019', '06.01.2019', '07.01.2019', '08.01.2019',
            '23.02.2019', '08.03.2019', '01.05.2019', '02.05.2019', '03.05.2019', '09.05.2019', '10.05.2019',
            '12.06.2019', '04.11.2019', '31.12.2019'
        ],
        2020: [
            '01.01.2020', '02.01.2020', '03.01.2020', '04.01.2020', '05.01.2020', '06.01.2020', '07.01.2020', '08.01.2020',
            '24.02.2020', '08.03.2020', '09.03.2020', '01.05.2020', '04.05.2020', '05.05.2020', '09.05.2020', '11.05.2020',
            '12.06.2020', '04.11.2020'
        ],
        2021: [
            '01.01.2021', '02.01.2021', '03.01.2021', '04.01.2021', '05.01.2021', '06.01.2021', '07.01.2021', '08.01.2021',
            '22.02.2021', '23.02.2021', '08.03.2021', '03.05.2021', '04.05.2021', '05.05.2021', '06.05.2021', '07.05.2021',
            '10.05.2021', '14.06.2021', '01.11.2021', '02.11.2021', '03.11.2021', '04.11.2021', '05.11.2021'
        ],
        2022: [
            '01.01.2022', '02.01.2022', '03.01.2022', '04.01.2022', '05.01.2022', '06.01.2022', '07.01.2022', '08.01.2022',
            '23.02.2022', '07.03.2022', '08.03.2022', '02.05.2022', '03.05.2022', '09.05.2022', '10.05.2022', 
            '13.06.2022', '04.11.2022', '31.12.2022'
        ],
        2023: [
            '01.01.2023', '02.01.2023', '03.01.2023', '04.01.2023', '05.01.2023', '06.01.2023', '07.01.2023', '08.01.2023',
            '23.02.2023', '24.02.2023', '08.03.2023', '01.05.2023', '08.05.2023', '09.05.2023', '12.06.2023',
            '04.11.2023', '06.11.2023', '30.12.2023', '31.12.2023'
        ],
        2024: [
            '01.01.2024', '02.01.2024', '03.01.2024', '04.01.2024', '05.01.2024', '06.01.2024', '07.01.2024', '08.01.2024',
            '23.02.2024', '08.03.2024', '29.04.2024', '30.04.2024', '01.05.2024', '09.05.2024', '10.05.2024', '12.06.2024', 
            '04.11.2024', '30.12.2024', '31.12.2024'
        ],
        2025: [
            '01.01.2025', '02.01.2025', '03.01.2025', '04.01.2025', '05.01.2025', '06.01.2025', '07.01.2025', '08.01.2025',
            '23.02.2025', '08.03.2025', '08.05.2025', '01.05.2025', '02.05.2025', '09.05.2025', '12.06.2025', '13.06.2025', 
            '03.11.2025', '04.11.2025', '31.12.2025'
        ],
        2026: [
            '01.01.2026', '02.01.2026', '03.01.2026', '04.01.2026', '05.01.2026', '06.01.2026', '07.01.2026', '08.01.2026',
            '09.01.2026', '23.02.2026', '08.03.2026', '01.05.2026', '09.05.2026', '12.06.2026', '04.11.2026', '31.12.2026'
        ]
    };
    return holidays[year] || [];
}

export function isHoliday(date) {
    const dayOfWeek = date.getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    const dateStr = `${day}.${month}.${year}`;
    const yearHolidays = getHolidaysForYear(year);
    return isWeekend || yearHolidays.includes(dateStr);
}

export function getPreviousWorkDay(date) {
    let prevDate = new Date(date);
    prevDate.setDate(prevDate.getDate() - 1);
    while (isHoliday(prevDate)) {
        prevDate.setDate(prevDate.getDate() - 1);
    }
    return prevDate;
}

export function parseDate(dateStr) {
    if (!/^\d{2}\.\d{2}\.\d{4}$/.test(dateStr)) {
        throw new Error(`Invalid date format for parsing: ${dateStr}`);
    }
    const [day, month, year] = dateStr.split('.').map(Number);
    return new Date(year, month - 1, day);
}

export function formatDate(date) {
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    return `${day}.${month}`;
}

export function formatFullDate(date) {
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}.${month}.${year}`;
}

function getPeriodValue(frequency) {
    switch(frequency) {
        case '1 раз в месяц': return 1;
        case '1 раз в 3 месяца': return 3;
        case '1 раз в 6 месяцев': return 6;
        case '1 раз в год': return 12;
        case '1 раз в 2 года': return 24;
        default: return 12;
    }
}

function getShortestPeriod(services) {
    if (!services || services.length === 0) return '1 раз в 2 года';
    return services.reduce((shortest, service) => {
        return getPeriodValue(service.frequency) < getPeriodValue(shortest) ? service.frequency : shortest;
    }, '1 раз в 2 года');
}

function calculateBaseDates(startDate, frequency, years = 10) {
    const dates = [];
    const endDate = new Date(startDate);
    endDate.setFullYear(endDate.getFullYear() + years);
    
    // Начинаем с даты ввода в эксплуатацию. Эта переменная будет обновляться в каждой итерации.
    let lastActualDate = new Date(startDate);
    const periodMonths = getPeriodValue(frequency);
    
    while (true) {
        // 1. Создаем новую дату, отталкиваясь от ПОСЛЕДНЕЙ ФАКТИЧЕСКОЙ даты (после переноса)
        let plannedDate = new Date(lastActualDate);

        // 2. Прибавляем период
        plannedDate.setMonth(plannedDate.getMonth() + periodMonths);
        
        // 3. Отнимаем 1 день
        plannedDate.setDate(plannedDate.getDate() - 1);

        // 4. Если вышли за пределы диапазона, останавливаемся
        if (plannedDate > endDate) {
            break;
        }

        // 5. Проверяем на выходные и переносим если нужно
        let actualDate = new Date(plannedDate);
        let wasMoved = false;
        
        if (isHoliday(actualDate)) {
            actualDate = getPreviousWorkDay(actualDate);
            wasMoved = true;
        }
        
        // 6. Запоминаем ФАКТИЧЕСКУЮ дату как основу для СЛЕДУЮЩЕЙ итерации
        lastActualDate = new Date(actualDate);
        
        dates.push({
            originalDate: plannedDate,
            actualDate: actualDate,
            wasMoved: wasMoved
        });
    }
    
    return dates;
}

export function calculateTODates(startDate, services, years = 10) {
    if (!services || services.length === 0) return [];
    
    const allDates = [];
    const shortestPeriod = getShortestPeriod(services);
    const shortestPeriodValue = getPeriodValue(shortestPeriod);
    const baseDates = calculateBaseDates(startDate, shortestPeriod, years);
    
    const sortedServices = [...services].sort((a, b) => 
        getPeriodValue(b.frequency) - getPeriodValue(a.frequency)
    );
    
    baseDates.forEach((baseDate, index) => {
        let selectedService = sortedServices.find(service => {
            const periodValue = getPeriodValue(service.frequency);
            if (shortestPeriodValue === 0) return false;
            const ratio = periodValue / shortestPeriodValue;
            return (index + 1) % ratio === 0;
        });

        if (!selectedService) {
            selectedService = services.find(s => s.frequency === shortestPeriod);
        }
        
        if (selectedService) {
            allDates.push({
                ...baseDate,
                service: selectedService
            });
        }
    });
    
    return allDates;
}