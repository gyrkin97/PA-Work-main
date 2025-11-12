// =================================================================== 
// File: help.js
// Description: Скрипт для страницы справочной информации
// =================================================================== 

document.addEventListener('DOMContentLoaded', () => {
    // Инициализация профиля пользователя
    initializeUserProfile();
    
    // Обработчик переключения вкладок
    const tabs = document.querySelectorAll('.tab-btn');
    const contents = document.querySelectorAll('.tab-content');
    
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            // Удаляем активный класс у всех вкладок
            tabs.forEach(t => t.classList.remove('active'));
            contents.forEach(c => c.classList.remove('active'));
            
            // Добавляем активный класс выбранной вкладке
            tab.classList.add('active');
            const contentId = tab.dataset.tab;
            document.getElementById(contentId).classList.add('active');
        });
    });

    // Обработчики загрузки документов
    const downloadButtons = document.querySelectorAll('.doc-download');
    downloadButtons.forEach(button => {
        button.addEventListener('click', (e) => {
            e.preventDefault();
            // Здесь будет логика загрузки документа
            showToast('Загрузка документа начата...', 'info');
        });
    });

    // Вложенные под-вкладки: обработчики для каждой вкладки
    const subTabContainers = document.querySelectorAll('.tab-content');
    subTabContainers.forEach(container => {
        const subTabs = container.querySelectorAll('.sub-tab-btn');
        const subContents = container.querySelectorAll('.sub-tab-content');
        subTabs.forEach(st => {
            st.addEventListener('click', () => {
                console.log('Клик по под-вкладке:', st.dataset.sub);
                subTabs.forEach(s => s.classList.remove('active'));
                subContents.forEach(sc => sc.classList.remove('active'));
                st.classList.add('active');
                const subId = st.dataset.sub;
                const el = container.querySelector(`#${subId}`);
                console.log('Найден элемент:', el);
                if (el) {
                    el.classList.add('active');
                    console.log('Добавлен класс active к:', subId);
                } else {
                    console.error('Элемент не найден:', subId);
                }
            });
        });
    });
});

function initializeUserProfile() {
    // Получаем данные пользователя с сервера
    fetch('/api/user')
        .then(response => response.json())
        .then(user => {
            // authController.getCurrentUser возвращает объект сессии { id, name, position }
            if (user && user.name) {
                const nameInitials = getInitials(user.name);
                const avatarEl = document.querySelector('.user-avatar');
                const nameEl = document.querySelector('.user-name');
                const roleEl = document.querySelector('.user-role');
                if (avatarEl) avatarEl.textContent = nameInitials;
                if (nameEl) nameEl.textContent = user.name;
                if (roleEl) roleEl.textContent = user.position || '';
            }
        })
        .catch(error => {
            console.error('Ошибка при загрузке профиля:', error);
            showToast('Ошибка при загрузке профиля', 'error');
        });
}

function getInitials(name) {
    return name
        .split(' ')
        .map(word => word[0])
        .join('')
        .toUpperCase()
        .slice(0, 2);
}

function showToast(message, type = 'info') {
    Toastify({
        text: message,
        duration: 3000,
        gravity: "top",
        position: "right",
        backgroundColor: type === 'error' ? "#ef4444" : "#3b82f6",
    }).showToast();
}

/* ========== Калькуляторы температуры ========== */

// Функция для переключения между калькуляторами
function showCalculator(type) {
    // Скрыть все калькуляторы
    document.querySelectorAll('.calc-container').forEach(el => {
        el.classList.remove('active');
    });
    
    // Убрать активный класс у всех кнопок
    document.querySelectorAll('.selector-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    
    // Показать выбранный
    document.getElementById('calc-' + type).classList.add('active');
    
    // Активировать кнопку
    event.target.closest('.selector-btn').classList.add('active');
}

// Автоматический пересчёт температур (Кельвин ↔ Цельсий)
function autoConvertTemperature(sourceType) {
    const kelvinInput = document.getElementById('kelvin-input');
    const celsiusInput = document.getElementById('celsius-input');
    
    if (sourceType === 'kelvin') {
        const kelvin = parseFloat(kelvinInput.value);
        if (!isNaN(kelvin)) {
            const celsius = (kelvin - 273.15).toFixed(2);
            celsiusInput.value = celsius;
        } else {
            celsiusInput.value = '';
        }
    } else if (sourceType === 'celsius') {
        const celsius = parseFloat(celsiusInput.value);
        if (!isNaN(celsius)) {
            const kelvin = (celsius + 273.15).toFixed(2);
            kelvinInput.value = kelvin;
        } else {
            kelvinInput.value = '';
        }
    }
}

// Автоматический пересчёт Pt100 (Сопротивление ↔ Температура)
function autoConvertPt100(sourceType) {
    const resistanceInput = document.getElementById('pt100-resistance');
    const tempInput = document.getElementById('pt100-temp');
    
    const R0 = 100;
    const A = 3.9083e-3;
    const B = -5.775e-7;
    const C = -4.183e-12;
    
    if (sourceType === 'resistance') {
        const resistance = parseFloat(resistanceInput.value);
        if (!isNaN(resistance)) {
            // R → T (упрощённая формула)
            const temp = (resistance - R0) / (A * R0);
            tempInput.value = temp.toFixed(2);
        } else {
            tempInput.value = '';
        }
    } else if (sourceType === 'temp') {
        const temp = parseFloat(tempInput.value);
        if (!isNaN(temp)) {
            // T → R (уравнение Калленда-Ван Дюзена)
            let resistance;
            if (temp >= 0) {
                resistance = R0 * (1 + A * temp + B * temp * temp);
            } else {
                resistance = R0 * (1 + A * temp + B * temp * temp + C * (temp - 100) * temp * temp * temp);
            }
            resistanceInput.value = resistance.toFixed(2);
        } else {
            resistanceInput.value = '';
        }
    }
}

/* ========== Калькулятор НСХ (ГОСТ 6651-2009) ========== */

// Параметры всех типов НСХ
const NSX_TYPES = {
    // Платиновые международные (IEC 60751)
    pt100: { 
        name: 'Pt100 (ПТ100)', 
        R0: 100, 
        material: 'platinum',
        standard: 'iec',
        range: '-200...+850°C',
        A: 3.9083e-3, 
        B: -5.775e-7, 
        C: -4.183e-12 
    },
    pt500: { 
        name: 'Pt500 (ПТ500)', 
        R0: 500, 
        material: 'platinum',
        standard: 'iec',
        range: '-200...+850°C',
        A: 3.9083e-3, 
        B: -5.775e-7, 
        C: -4.183e-12 
    },
    pt1000: { 
        name: 'Pt1000 (ПТ1000)', 
        R0: 1000, 
        material: 'platinum',
        standard: 'iec',
        range: '-200...+850°C',
        A: 3.9083e-3, 
        B: -5.775e-7, 
        C: -4.183e-12 
    },
    // Платиновые российские (ГОСТ 6651-2009)
    '100p': { 
        name: '100П (платина ГОСТ)', 
        R0: 100, 
        material: 'platinum',
        standard: 'gost',
        range: '-200...+650°C',
        A: 3.9692e-3,  // Коэффициент A для ГОСТ
        B: -5.8495e-7, // Коэффициент B для ГOST
        C: -4.2735e-12 // Коэффициент C для ГОСТ
    },
    '500p': { 
        name: '500П (платина ГОСТ)', 
        R0: 500, 
        material: 'platinum',
        standard: 'gost',
        range: '-200...+650°C',
        A: 3.9692e-3,
        B: -5.8495e-7,
        C: -4.2735e-12
    },
    // Медные
    '50m': { 
        name: '50М (медь)', 
        R0: 50, 
        material: 'copper',
        range: '-50...+180°C',
        alpha: 4.28e-3 
    },
    '100m': { 
        name: '100М (медь)', 
        R0: 100, 
        material: 'copper',
        range: '-50...+180°C',
        alpha: 4.28e-3 
    },
    // Никелевые
    '50n': { 
        name: '50Н (никель)', 
        R0: 50, 
        material: 'nickel',
        range: '-60...+180°C',
        alpha: 6.17e-3 
    },
    '100n': { 
        name: '100Н (никель)', 
        R0: 100, 
        material: 'nickel',
        range: '-60...+180°C',
        alpha: 6.17e-3 
    }
};

// Автоматический пересчёт НСХ (Сопротивление ↔ Температура)
function autoConvertNSX(sourceType) {
    const resistanceInput = document.getElementById('nsx-resistance');
    const tempInput = document.getElementById('nsx-temp');
    const typeSelect = document.getElementById('nsx-type');
    const classSelect = document.getElementById('nsx-class');
    
    const type = NSX_TYPES[typeSelect.value];
    if (!type) return;
    
    let currentTemp = null;
    let currentResistance = null;
    
    if (sourceType === 'resistance') {
        const resistance = parseFloat(resistanceInput.value);
        if (!isNaN(resistance)) {
            const temp = resistanceToTemp(resistance, type);
            tempInput.value = temp.toFixed(2);
            currentTemp = temp;
            currentResistance = resistance;
        } else {
            tempInput.value = '';
        }
    } else if (sourceType === 'temp') {
        const temp = parseFloat(tempInput.value);
        if (!isNaN(temp)) {
            const resistance = tempToResistance(temp, type);
            resistanceInput.value = resistance.toFixed(2);
            currentTemp = temp;
            currentResistance = resistance;
        } else {
            resistanceInput.value = '';
        }
    }
    
    // Проверка диапазона и обновление погрешности
    if (currentTemp !== null) {
        checkNSXRange(currentTemp, type);
        updateNSXError(currentTemp, currentResistance, type, classSelect.value);
    } else {
        clearNSXError();
    }
}

// Преобразование сопротивления в температуру
function resistanceToTemp(R, type) {
    if (type.material === 'platinum') {
        // Уравнение Калленда-Ван Дюзена (платина)
        const A = type.A;
        const B = type.B;
        const C = type.C;
        const R0 = type.R0;
        
        // Для положительных температур: R = R₀(1 + At + Bt²)
        // Решаем квадратное уравнение: Bt² + At + (1 - R/R₀) = 0
        const ratio = R / R0;
        
        if (ratio >= 1) {
            // Положительная температура - используем квадратное уравнение
            const a = B;
            const b = A;
            const c = 1 - ratio;
            
            const discriminant = b * b - 4 * a * c;
            const t = (-b + Math.sqrt(discriminant)) / (2 * a);
            return t;
        } else {
            // Отрицательная температура - используем упрощённую формулу
            // (для точности нужно решать уравнение 4-й степени, но это сложно)
            const t = (R - R0) / (A * R0);
            return t;
        }
    } else if (type.material === 'copper' || type.material === 'nickel') {
        // Линейная формула для меди и никеля
        const t = (R - type.R0) / (type.alpha * type.R0);
        return t;
    }
}

// Преобразование температуры в сопротивление
function tempToResistance(t, type) {
    if (type.material === 'platinum') {
        // Уравнение Калленда-Ван Дюзена для платины
        const A = type.A;
        const B = type.B;
        const C = type.C;
        const R0 = type.R0;
        
        if (t >= 0) {
            // Для положительных температур
            return R0 * (1 + A * t + B * t * t);
        } else {
            // Для отрицательных температур
            return R0 * (1 + A * t + B * t * t + C * (t - 100) * t * t * t);
        }
    } else if (type.material === 'copper' || type.material === 'nickel') {
        // Линейная формула для меди и никеля
        return type.R0 * (1 + type.alpha * t);
    }
}

// Обновление информации о выбранном типе НСХ
function updateNSXInfo() {
    const typeSelect = document.getElementById('nsx-type');
    const type = NSX_TYPES[typeSelect.value];
    
    if (!type) return;
    
    const infoEl = document.getElementById('nsx-info');
    
    infoEl.textContent = `${type.name}: Номинальное сопротивление R₀ = ${type.R0} Ω при 0°C`;
    
    // Обновляем диапазон и коэффициент
    updateNSXTypeInfo(type);
    
    // Сброс полей при смене типа
    document.getElementById('nsx-resistance').value = '';
    document.getElementById('nsx-temp').value = '';
    clearNSXError();
}

// Расчёт погрешности по классу точности (ГОСТ 6651-2009)
function calculateNSXTolerance(temp, accuracyClass) {
    const t = Math.abs(temp);
    
    switch(accuracyClass) {
        case 'a':
            // Класс A: Δt = ±(0.15 + 0.002|t|)
            return 0.15 + 0.002 * t;
        case 'b':
            // Класс B: Δt = ±(0.30 + 0.005|t|)
            return 0.30 + 0.005 * t;
        case 'c':
            // Класс C: Δt = ±(0.60 + 0.010|t|)
            return 0.60 + 0.010 * t;
        default:
            return 0;
    }
}

// Обновление отображения погрешности
function updateNSXError(temp, resistance, type, accuracyClass) {
    const errorTempEl = document.getElementById('nsx-error-temp');
    const errorResistanceEl = document.getElementById('nsx-error-resistance');
    
    // Погрешность в °C
    const errorTemp = calculateNSXTolerance(temp, accuracyClass);
    
    // Погрешность в Ω (рассчитываем через производную dR/dT)
    let errorResistance;
    if (type.material === 'platinum') {
        // dR/dT = R₀(A + 2Bt) для положительных температур
        const dRdT = type.R0 * (type.A + 2 * type.B * temp);
        errorResistance = Math.abs(dRdT * errorTemp);
    } else {
        // dR/dT = R₀ × α для линейных
        const dRdT = type.R0 * type.alpha;
        errorResistance = Math.abs(dRdT * errorTemp);
    }
    
    errorTempEl.textContent = `±${errorTemp.toFixed(3)} °C`;
    errorResistanceEl.textContent = `±${errorResistance.toFixed(3)} Ω`;
}

// Очистка отображения погрешности (не трогаем диапазон и коэффициент!)
function clearNSXError() {
    document.getElementById('nsx-error-temp').textContent = '—';
    document.getElementById('nsx-error-resistance').textContent = '—';
    // Диапазон и коэффициент НЕ очищаем - они зависят только от типа НСХ
}

// Пересчёт при изменении класса точности
function recalculateNSXOnClassChange() {
    const tempInput = document.getElementById('nsx-temp');
    const resistanceInput = document.getElementById('nsx-resistance');
    const typeSelect = document.getElementById('nsx-type');
    const classSelect = document.getElementById('nsx-class');
    
    const type = NSX_TYPES[typeSelect.value];
    if (!type) return;
    
    // Сохраняем информацию о типе НСХ (диапазон и коэффициент)
    updateNSXTypeInfo(type);
    
    // Проверяем, есть ли значение в любом из полей
    const tempValue = parseFloat(tempInput.value);
    const resistanceValue = parseFloat(resistanceInput.value);
    
    if (!isNaN(tempValue)) {
        // Если есть температура, пересчитываем погрешность
        updateNSXError(tempValue, resistanceValue, type, classSelect.value);
    } else if (!isNaN(resistanceValue)) {
        // Если есть только сопротивление, вычисляем температуру и пересчитываем
        const temp = resistanceToTemp(resistanceValue, type);
        updateNSXError(temp, resistanceValue, type, classSelect.value);
    }
}

// Обновление информации о типе НСХ (диапазон и коэффициент)
function updateNSXTypeInfo(type) {
    const rangeEl = document.getElementById('nsx-range');
    const coeffEl = document.getElementById('nsx-coefficient');
    
    rangeEl.textContent = type.range;
    
    if (type.material === 'platinum') {
        coeffEl.textContent = `α = ${(type.A * 1000).toFixed(4)} × 10⁻³ °C⁻¹`;
    } else {
        coeffEl.textContent = `α = ${(type.alpha * 1000).toFixed(2)} × 10⁻³ °C⁻¹`;
    }
}

// Проверка диапазона измерений
let lastRangeWarning = null; // Отслеживаем последнее предупреждение

function checkNSXRange(temp, type) {
    // Парсим диапазон (например, "-200...+850°C")
    const rangeMatch = type.range.match(/([-+]?\d+)\.\.\.([-+]?\d+)/);
    if (!rangeMatch) {
        lastRangeWarning = null;
        return;
    }
    
    const minTemp = parseFloat(rangeMatch[1]);
    const maxTemp = parseFloat(rangeMatch[2]);
    
    const isOutOfRange = temp < minTemp || temp > maxTemp;
    const warningKey = `${type.name}-${isOutOfRange}`;
    
    // Показываем toast только если состояние изменилось
    if (isOutOfRange && lastRangeWarning !== warningKey) {
        showToast(`⚠️ Выход за границы диапазона! Допустимый диапазон: ${type.range}`, 'error');
        lastRangeWarning = warningKey;
    } else if (!isOutOfRange) {
        lastRangeWarning = null;
    }
}

function convertKelvinToCelsius() {
    const kelvinInput = document.querySelector('.kelvin-input');
    const result = document.querySelector('.kelvin-result');
    const kelvin = parseFloat(kelvinInput.value);
    
    if (isNaN(kelvin)) {
        result.value = '';
        showToast('Введите корректное значение', 'error');
        return;
    }
    
    const celsius = (kelvin - 273.15).toFixed(2);
    result.value = celsius + ' °C';
}

// Калькулятор 1: Цельсий → Кельвин
function convertCelsiusToKelvin() {
    const celsiusInput = document.querySelector('.celsius-input');
    const result = document.querySelector('.celsius-result');
    const celsius = parseFloat(celsiusInput.value);
    
    if (isNaN(celsius)) {
        result.value = '';
        showToast('Введите корректное значение', 'error');
        return;
    }
    
    const kelvin = (celsius + 273.15).toFixed(2);
    result.value = kelvin + ' K';
}

// Калькулятор 2: НСХ по ГОСТ 6651-2009
function calculateNSX() {
    const nominal = parseFloat(document.querySelector('.nsx-nominal').value);
    const correction = parseFloat(document.querySelector('.nsx-correction').value);
    const error = parseFloat(document.querySelector('.nsx-error').value);
    
    if (isNaN(nominal) || isNaN(correction) || isNaN(error)) {
        showToast('Заполните все поля', 'error');
        return;
    }
    
    // Скорректированное значение
    const corrected = nominal + correction;
    
    // Доверительный интервал (для класса точности)
    const interval = ((corrected * error) / 100).toFixed(3);
    
    document.querySelector('.nsx-corrected').textContent = corrected.toFixed(2) + ' °C';
    document.querySelector('.nsx-interval').textContent = '±' + interval + ' °C';
    
    showToast('Расчёт выполнен', 'info');
}

/* ========== Калькулятор Термопар (ГОСТ 8.585-2001) ========== */

// Параметры всех типов термопар
const TC_TYPES = {
    // Платинородиевые (благородные металлы)
    s: {
        name: 'S (ТПП)',
        description: 'PtRh10-Pt',
        range: '0...+1768°C',
        seebeck: '~10 мкВ/°C',
        // Полиномиальные коэффициенты для T→E (упрощённые)
        coeffs: { a0: 0, a1: 5.40e-3, a2: 1.25e-5, a3: -2.32e-8 },
        minTemp: 0,
        maxTemp: 1768
    },
    r: {
        name: 'R (ТПР)',
        description: 'PtRh13-Pt',
        range: '0...+1768°C',
        seebeck: '~11 мкВ/°C',
        coeffs: { a0: 0, a1: 5.28e-3, a2: 1.57e-5, a3: -2.48e-8 },
        minTemp: 0,
        maxTemp: 1768
    },
    b: {
        name: 'B (ТПР)',
        description: 'PtRh30-PtRh6',
        range: '+300...+1820°C',
        seebeck: '~8 мкВ/°C',
        coeffs: { a0: 0, a1: -2.46e-4, a2: 5.90e-6, a3: 1.32e-8 },
        minTemp: 300,
        maxTemp: 1820
    },
    // Неблагородные металлы
    k: {
        name: 'K (ТХА)',
        description: 'Хромель-Алюмель',
        range: '-200...+1300°C',
        seebeck: '~41 мкВ/°C',
        coeffs: { a0: 0, a1: 3.95e-2, a2: 2.39e-5, a3: -3.28e-9 },
        minTemp: -200,
        maxTemp: 1300
    },
    n: {
        name: 'N (ТХН)',
        description: 'Хромель-Нихросил',
        range: '-200...+1300°C',
        seebeck: '~39 мкВ/°C',
        coeffs: { a0: 0, a1: 3.86e-2, a2: 1.10e-5, a3: 2.06e-8 },
        minTemp: -200,
        maxTemp: 1300
    },
    j: {
        name: 'J (ТЖК)',
        description: 'Железо-Константан',
        range: '-40...+750°C',
        seebeck: '~52 мкВ/°C',
        coeffs: { a0: 0, a1: 5.04e-2, a2: 3.05e-5, a3: -8.56e-8 },
        minTemp: -40,
        maxTemp: 750
    },
    t: {
        name: 'T (ТМК)',
        description: 'Медь-Константан',
        range: '-200...+350°C',
        seebeck: '~43 мкВ/°C',
        coeffs: { a0: 0, a1: 3.87e-2, a2: 3.32e-5, a3: 2.07e-7 },
        minTemp: -200,
        maxTemp: 350
    },
    e: {
        name: 'E (ТХК)',
        description: 'Хромель-Копель',
        range: '-200...+900°C',
        seebeck: '~61 мкВ/°C',
        coeffs: { a0: 0, a1: 5.87e-2, a2: 4.54e-5, a3: 2.89e-8 },
        minTemp: -200,
        maxTemp: 900
    },
    l: {
        name: 'L (ТХК)',
        description: 'Хромель-Копель',
        range: '-200...+800°C',
        seebeck: '~58 мкВ/°C',
        coeffs: { a0: 0, a1: 5.70e-2, a2: 4.35e-5, a3: 2.65e-8 },
        minTemp: -200,
        maxTemp: 800
    },
    m: {
        name: 'M (ТМК)',
        description: 'Никель-Нихросил',
        range: '0...+1300°C',
        seebeck: '~42 мкВ/°C',
        coeffs: { a0: 0, a1: 4.10e-2, a2: 1.85e-5, a3: -1.20e-8 },
        minTemp: 0,
        maxTemp: 1300
    },
    // Вольфрам-рениевые (тугоплавкие)
    a1: {
        name: 'A-1 (ТВР)',
        description: 'W-Re5/W-Re20',
        range: '0...+2500°C',
        seebeck: '~12 мкВ/°C',
        coeffs: { a0: 0, a1: 1.19e-2, a2: 2.08e-6, a3: -7.35e-10 },
        minTemp: 0,
        maxTemp: 2500
    },
    a2: {
        name: 'A-2 (ТВР)',
        description: 'W-Re3/W-Re25',
        range: '0...+2500°C',
        seebeck: '~14 мкВ/°C',
        coeffs: { a0: 0, a1: 1.35e-2, a2: 2.42e-6, a3: -8.61e-10 },
        minTemp: 0,
        maxTemp: 2500
    },
    a3: {
        name: 'A-3 (ТВР)',
        description: 'W-Re5/W-Re5',
        range: '0...+2200°C',
        seebeck: '~8 мкВ/°C',
        coeffs: { a0: 0, a1: 7.80e-3, a2: 1.45e-6, a3: -5.20e-10 },
        minTemp: 0,
        maxTemp: 2200
    }
};

// Автоматический пересчёт Термопары (ЭДС ↔ Температура)
function autoConvertTC(sourceType) {
    const emfInput = document.getElementById('tc-emf');
    const tempInput = document.getElementById('tc-temp');
    const typeSelect = document.getElementById('tc-type');
    const classSelect = document.getElementById('tc-class');
    
    const type = TC_TYPES[typeSelect.value];
    if (!type) return;
    
    let currentTemp = null;
    let currentEmf = null;
    
    if (sourceType === 'emf') {
        const emf = parseFloat(emfInput.value);
        if (!isNaN(emf)) {
            const temp = emfToTemp(emf, type);
            tempInput.value = temp.toFixed(2);
            currentTemp = temp;
            currentEmf = emf;
        } else {
            tempInput.value = '';
        }
    } else if (sourceType === 'temp') {
        const temp = parseFloat(tempInput.value);
        if (!isNaN(temp)) {
            const emf = tempToEmf(temp, type);
            emfInput.value = emf.toFixed(3);
            currentTemp = temp;
            currentEmf = emf;
        } else {
            emfInput.value = '';
        }
    }
    
    // Проверка диапазона и обновление погрешности
    if (currentTemp !== null) {
        checkTCRange(currentTemp, type);
        updateTCError(currentTemp, currentEmf, type, classSelect.value);
    } else {
        clearTCError();
    }
}

// Преобразование ЭДС в температуру (полиномиальное приближение)
function emfToTemp(emf, type) {
    // Используем обратный полином (упрощённая итерация Ньютона)
    const coeffs = type.coeffs;
    let t = emf / coeffs.a1; // Начальное приближение
    
    // Итерация Ньютона для уточнения
    for (let i = 0; i < 5; i++) {
        const e_calc = tempToEmf(t, type);
        const de_dt = coeffs.a1 + 2 * coeffs.a2 * t + 3 * coeffs.a3 * t * t;
        t = t - (e_calc - emf) / de_dt;
    }
    
    return t;
}

// Преобразование температуры в ЭДС (прямой полином)
function tempToEmf(t, type) {
    const c = type.coeffs;
    // E(T) = a0 + a1*T + a2*T² + a3*T³
    return c.a0 + c.a1 * t + c.a2 * t * t + c.a3 * t * t * t;
}

function updateTCTypeInfo(type) {
    const rangeEl = document.getElementById('tc-range');
    const seebeckEl = document.getElementById('tc-seebeck');
    
    rangeEl.textContent = type.range;
    seebeckEl.textContent = type.seebeck;
}

// Расчёт погрешности по классу допуска (ГОСТ 8.585-2001)
function calculateTCTolerance(temp, type, accuracyClass) {
    const t = temp; // Используем фактическую температуру (не модуль)
    const tClass = parseInt(accuracyClass);
    
    // Формулы допусков по ГОСТ 8.585-2001
    // K и N
    if (type.name.startsWith('K') || type.name.startsWith('N')) {
        if (tClass === 1) {
            // Класс 1: ±1.5°C или ±0.004·|t|
            return Math.max(1.5, 0.004 * Math.abs(t));
        } else if (tClass === 2) {
            // Класс 2: ±2.5°C или ±0.0075·|t|
            return Math.max(2.5, 0.0075 * Math.abs(t));
        } else {
            // Класс 3: ±5.0°C или ±0.015·|t|
            return Math.max(5.0, 0.015 * Math.abs(t));
        }
    }
    // J
    else if (type.name.startsWith('J')) {
        if (tClass === 1) {
            return Math.max(1.5, 0.004 * Math.abs(t));
        } else if (tClass === 2) {
            return Math.max(2.5, 0.0075 * Math.abs(t));
        } else {
            return Math.max(5.0, 0.015 * Math.abs(t));
        }
    }
    // T
    else if (type.name.startsWith('T')) {
        if (tClass === 1) {
            return Math.max(0.5, 0.004 * Math.abs(t));
        } else if (tClass === 2) {
            return Math.max(1.0, 0.0075 * Math.abs(t));
        } else {
            return Math.max(2.0, 0.015 * Math.abs(t));
        }
    }
    // E и L
    else if (type.name.startsWith('E') || type.name.startsWith('L')) {
        if (tClass === 1) {
            return Math.max(1.5, 0.004 * Math.abs(t));
        } else if (tClass === 2) {
            return Math.max(2.5, 0.0075 * Math.abs(t));
        } else {
            return Math.max(5.0, 0.015 * Math.abs(t));
        }
    }
    // M
    else if (type.name.startsWith('M')) {
        if (tClass === 1) {
            return Math.max(2.0, 0.005 * Math.abs(t));
        } else if (tClass === 2) {
            return Math.max(4.0, 0.01 * Math.abs(t));
        } else {
            return Math.max(8.0, 0.02 * Math.abs(t));
        }
    }
    // S, R (платинородиевые)
    else if (type.name.startsWith('S') || type.name.startsWith('R')) {
        if (tClass === 1) {
            return Math.max(1.0, 0.003 * t); // Для благородных t всегда >0
        } else if (tClass === 2) {
            return Math.max(1.5, 0.0025 * t);
        } else {
            return Math.max(3.0, 0.005 * t);
        }
    }
    // B
    else if (type.name.startsWith('B')) {
        if (tClass === 1) {
            return Math.max(2.0, 0.0025 * t);
        } else if (tClass === 2) {
            return Math.max(4.0, 0.005 * t);
        } else {
            return Math.max(8.0, 0.01 * t);
        }
    }
    // A-1, A-2, A-3 (Вольфрам-рениевые)
    else if (type.name.startsWith('A-')) {
        if (tClass === 1) {
            return Math.max(4.0, 0.005 * t);
        } else if (tClass === 2) {
            return Math.max(8.0, 0.01 * t);
        } else {
            return Math.max(15.0, 0.02 * t);
        }
    }
    
    return 0;
}

// Обновление отображения погрешности
function updateTCError(temp, emf, type, accuracyClass) {
    const errorTempEl = document.getElementById('tc-error-temp');
    const errorEmfEl = document.getElementById('tc-error-emf');
    
    // Погрешность в °C
    const errorTemp = calculateTCTolerance(temp, type, accuracyClass);
    
    // Погрешность в мВ (через коэффициент Зеебека dE/dT)
    const coeffs = type.coeffs;
    const dEdT = coeffs.a1 + 2 * coeffs.a2 * temp + 3 * coeffs.a3 * temp * temp;
    const errorEmf = Math.abs(dEdT * errorTemp);
    
    errorTempEl.textContent = `±${errorTemp.toFixed(2)} °C`;
    errorEmfEl.textContent = `±${errorEmf.toFixed(3)} мВ`;
}

// Очистка отображения погрешности
function clearTCError() {
    document.getElementById('tc-error-temp').textContent = '—';
    document.getElementById('tc-error-emf').textContent = '—';
}

// Пересчёт при изменении класса допуска
function recalculateTCOnClassChange() {
    const tempInput = document.getElementById('tc-temp');
    const emfInput = document.getElementById('tc-emf');
    const typeSelect = document.getElementById('tc-type');
    const classSelect = document.getElementById('tc-class');
    
    const type = TC_TYPES[typeSelect.value];
    if (!type) return;
    
    // Сохраняем информацию о типе термопары
    updateTCTypeInfo(type);
    
    // Проверяем, есть ли значение в любом из полей
    const tempValue = parseFloat(tempInput.value);
    const emfValue = parseFloat(emfInput.value);
    
    if (!isNaN(tempValue)) {
        const emf = tempToEmf(tempValue, type);
        updateTCError(tempValue, emf, type, classSelect.value);
    } else if (!isNaN(emfValue)) {
        const temp = emfToTemp(emfValue, type);
        updateTCError(temp, emfValue, type, classSelect.value);
    }
}

// Проверка диапазона измерений
let lastTCRangeWarning = null;

function checkTCRange(temp, type) {
    const minTemp = type.minTemp;
    const maxTemp = type.maxTemp;
    
    const isOutOfRange = temp < minTemp || temp > maxTemp;
    const warningKey = `${type.name}-${isOutOfRange}`;
    
    if (isOutOfRange && lastTCRangeWarning !== warningKey) {
        showToast(`⚠️ Выход за границы диапазона! Допустимый диапазон: ${type.range}`, 'error');
        lastTCRangeWarning = warningKey;
    } else if (!isOutOfRange) {
        lastTCRangeWarning = null;
    }
}

/* ========== Устаревшие функции термопары (для совместимости) ========== */

// Калькулятор 3: Термопара по ГОСТ 8.585-2001 (старая версия)
function calculateThermocoupleTemp() {
    // Перенаправляем на новую функцию
    autoConvertTC('emf');
}

// Функция для обновления информации о выбранной термопаре (старая версия)
function updateThermocoupleInfo() {
    // Перенаправляем на новую функцию
    updateTCInfo();
}

/* ========== Калькулятор Pt100 ========== */

// Уравнение Калленда-Ван Дюзена для Pt100
// R(t) = R₀[1 + At + Bt² + C(t-100)t³], где A, B, C — коэффициенты
// Упрощённое уравнение для практического использования:
// R(t) = R₀(1 + αt + βt²) для t > 0
// R(t) = R₀(1 + αt + γ(t-100)t³) для t < 0

function convertPt100ToTemp() {
    const resistance = parseFloat(document.querySelector('.pt100-resistance').value);
    const resultInput = document.querySelector('.pt100-result-temp');
    
    if (isNaN(resistance)) {
        resultInput.value = '';
        showToast('Введите корректное значение сопротивления', 'error');
        return;
    }
    
    // Коэффициенты Pt100 (ПТ100)
    const R0 = 100;      // Сопротивление при 0°C
    const A = 3.9083e-3;  // Коэффициент температурного сопротивления
    const B = -5.775e-7;  // Коэффициент квадратичной поправки
    
    // Используем упрощённую формулу для обратного преобразования
    // t ≈ (R - R₀) / (A × R₀) для быстрого расчёта
    const temp = (resistance - R0) / (A * R0);
    
    if (temp < -50 || temp > 200) {
        showToast('Температура вне нормального диапазона Pt100', 'error');
        return;
    }
    
    resultInput.value = temp.toFixed(2) + ' °C';
    showToast('Расчёт выполнен', 'info');
}

function convertTempToPt100() {
    const temp = parseFloat(document.querySelector('.pt100-temp').value);
    const resultInput = document.querySelector('.pt100-result-resistance');
    
    if (isNaN(temp)) {
        resultInput.value = '';
        showToast('Введите корректное значение температуры', 'error');
        return;
    }
    
    // Коэффициенты Pt100
    const R0 = 100;      // Сопротивление при 0°C
    const A = 3.9083e-3;  // Коэффициент
    const B = -5.775e-7;  // Коэффициент
    
    // Уравнение Калленда-Ван Дюзена (упрощённая форма для положительных температур)
    let resistance;
    if (temp >= 0) {
        resistance = R0 * (1 + A * temp + B * temp * temp);
    } else {
        // Для отрицательных температур
        const C = -4.183e-12;
        resistance = R0 * (1 + A * temp + B * temp * temp + C * (temp - 100) * temp * temp * temp);
    }
    
    if (resistance < 0) {
        showToast('Ошибка расчёта сопротивления', 'error');
        return;
    }
    
    resultInput.value = resistance.toFixed(2) + ' Ω';
    showToast('Расчёт выполнен', 'info');
}

function updatePt100Info() {
    const classOption = document.querySelector('.pt100-class').value;
    const info = document.getElementById('pt100-info');
    
    const classInfo = {
        a: 'Pt100 класс A: Δt = ±(0.15 + 0.002|t|) — для высокоточных измерений',
        b: 'Pt100 класс B: Δt = ±(0.30 + 0.005|t|) — для большинства применений',
        c: 'Pt100 класс C: Δt = ±(0.90 + 0.010|t|) — для менее критичных применений'
    };
    
    info.textContent = classInfo[classOption];
}

/* ========== Калькуляторы расхода ========== */

// Переключение между калькуляторами расхода
function showFlowCalculator(calcType) {
    // Убираем активный класс со всех кнопок и калькуляторов
    document.querySelectorAll('#flow .selector-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('#flow .calc-container').forEach(calc => calc.classList.remove('active'));
    
    // Активируем выбранную кнопку
    event.target.closest('.selector-btn').classList.add('active');
    
    // Показываем соответствующий калькулятор
    const calcMap = {
        'converter': 'calc-flow-converter',
        'flow-to-velocity': 'calc-flow-to-velocity',
        'pipe-flow': 'calc-pipe-flow'
    };
    
    const calcElement = document.getElementById(calcMap[calcType]);
    if (calcElement) {
        calcElement.classList.add('active');
    }
}

// Автоматический пересчёт расхода и скорости потока
function autoConvertFlowVelocity(source) {
    const diameterMm = parseFloat(document.getElementById('pipe-diameter').value);
    
    // Всегда обновляем площадь сечения, если есть диаметр
    if (diameterMm && diameterMm > 0) {
        const diameterM = diameterMm / 1000;
        const area = Math.PI * Math.pow(diameterM / 2, 2);
        document.getElementById('pipe-area').textContent = `${(area * 1e6).toFixed(2)} мм² (${area.toFixed(6)} м²)`;
    } else {
        document.getElementById('pipe-area').textContent = '—';
    }

    // Если нет диаметра, очищаем результаты
    if (!diameterMm || diameterMm <= 0) {
        if (source === 'diameter') {
            document.getElementById('volumetric-flow').value = '';
            document.getElementById('flow-velocity').value = '';
        }
        return;
    }

    const diameterM = diameterMm / 1000;
    const area = Math.PI * Math.pow(diameterM / 2, 2);

    // Пересчёт в зависимости от того, какое поле изменено
    if (source === 'flow' || source === 'diameter') {
        // Пересчитываем расход → скорость
        const flowM3h = parseFloat(document.getElementById('volumetric-flow').value);
        if (flowM3h >= 0) {
            const flowM3s = flowM3h / 3600;
            const velocity = flowM3s / area;
            document.getElementById('flow-velocity').value = velocity.toFixed(3);
        } else {
            document.getElementById('flow-velocity').value = '';
        }
    } else if (source === 'velocity') {
        // Пересчитываем скорость → расход
        const velocity = parseFloat(document.getElementById('flow-velocity').value);
        if (velocity >= 0) {
            const flowM3s = velocity * area;
            const flowM3h = flowM3s * 3600;
            document.getElementById('volumetric-flow').value = flowM3h.toFixed(3);
        } else {
            document.getElementById('volumetric-flow').value = '';
        }
    }
}

// Функция расчёта энтальпии воды согласно ГОСТ Р ЕН 1434-5-2011
function calculateEnthalpy() {
    const temp = parseFloat(document.getElementById('enthalpy-temp').value);
    const pressure = parseFloat(document.getElementById('enthalpy-pressure').value);

    // Проверка входных данных
    if (!temp || temp < 0.01 || temp > 180 || !pressure || pressure < 0 || pressure > 2.5) {
        document.getElementById('enthalpy-value').textContent = '—';
        document.getElementById('density-value').textContent = '—';
        
        if (temp && (temp < 0.01 || temp > 180)) {
            showToast('Температура должна быть в диапазоне 0.01...180 °C', 'warning');
        }
        if (pressure && (pressure < 0 || pressure > 2.5)) {
            showToast('Давление должно быть в диапазоне 0...2.5 МПа', 'warning');
        }
        return;
    }

    // Расчёт энтальпии воды по ГОСТ Р ЕН 1434-5-2011
    // Формула основана на полиномиальной аппроксимации для жидкой воды
    // h (кДж/кг) = f(T, P)
    
    // Энтальпия при атмосферном давлении (базовая формула)
    // h₀(T) = a₀ + a₁·T + a₂·T² + a₃·T³ + a₄·T⁴
    const a0 = 0.0;
    const a1 = 4.2174356;
    const a2 = -0.0056181625;
    const a3 = 0.00012992528;
    const a4 = -1.1535353e-6;
    
    const h0 = a0 + a1 * temp + a2 * Math.pow(temp, 2) + 
               a3 * Math.pow(temp, 3) + a4 * Math.pow(temp, 4);
    
    // Поправка на давление (упрощённая формула для жидкой фазы)
    // Δh(P) ≈ v·ΔP, где v - удельный объём воды (≈ 1/ρ)
    // Для жидкой воды влияние давления мало при P < 2.5 МПа
    const pressureCorrection = 0.001 * pressure * (1 - 0.0002 * temp); // кДж/кг
    
    const enthalpy = h0 + pressureCorrection;
    
    // Расчёт плотности воды (кг/м³)
    // ρ(T) = ρ₀ / (1 + β·(T - T₀))
    // где ρ₀ = 999.97 кг/м³ при T₀ = 4°C, β - коэффициент объёмного расширения
    const rho0 = 999.972;
    const T0 = 4.0;
    
    // Полиномиальная формула для плотности воды (более точная)
    const b0 = 999.83952;
    const b1 = 16.945176;
    const b2 = -7.9870401e-3;
    const b3 = -46.170461e-6;
    const b4 = 105.56302e-9;
    const b5 = -280.54253e-12;
    
    const T_celsius = temp;
    const density = b0 + b1 * T_celsius + b2 * Math.pow(T_celsius, 2) + 
                    b3 * Math.pow(T_celsius, 3) + b4 * Math.pow(T_celsius, 4) + 
                    b5 * Math.pow(T_celsius, 5);
    
    // Поправка плотности на давление (сжимаемость воды)
    const compressibility = 4.6e-10; // 1/Па при 20°C
    const densityWithPressure = density * (1 + compressibility * pressure * 1e6);
    
    // Вывод результатов
    document.getElementById('enthalpy-value').textContent = `${enthalpy.toFixed(2)} кДж/кг`;
    document.getElementById('density-value').textContent = `${densityWithPressure.toFixed(2)} кг/м³`;
}

/* ========== Конвертер единиц измерения ========== */

// Коэффициенты конвертации (все относительно базовой единицы)
const CONVERSION_UNITS = {
    volume: {
        name: 'Объём',
        base: 'm3',
        units: {
            'm3': { name: 'м³ (куб. метр)', factor: 1 },
            'l': { name: 'л (литр)', factor: 1000 },
            'ml': { name: 'мл (миллилитр)', factor: 1000000 },
            'cm3': { name: 'см³ (куб. см)', factor: 1000000 },
            'dm3': { name: 'дм³ (куб. дм)', factor: 1000 },
            'gal': { name: 'галлон (США)', factor: 264.172 },
            'ft3': { name: 'фут³ (куб. фут)', factor: 35.3147 },
            'in3': { name: 'дюйм³ (куб. дюйм)', factor: 61023.7 },
            'bbl': { name: 'баррель (нефтяной)', factor: 6.28981 }
        }
    },
    'volumetric-flow': {
        name: 'Объёмный расход',
        base: 'm3h',
        units: {
            'm3h': { name: 'м³/ч', factor: 1 },
            'm3s': { name: 'м³/с', factor: 1/3600 },
            'm3min': { name: 'м³/мин', factor: 1/60 },
            'lh': { name: 'л/ч', factor: 1000 },
            'ls': { name: 'л/с', factor: 1000/3600 },
            'lmin': { name: 'л/мин', factor: 1000/60 },
            'galh': { name: 'галлон/ч', factor: 264.172 },
            'galmin': { name: 'галлон/мин', factor: 264.172/60 },
            'ft3h': { name: 'фут³/ч', factor: 35.3147 },
            'ft3min': { name: 'фут³/мин', factor: 35.3147/60 }
        }
    },
    'mass-flow': {
        name: 'Массовый расход',
        base: 'kgh',
        units: {
            'kgh': { name: 'кг/ч', factor: 1 },
            'kgs': { name: 'кг/с', factor: 1/3600 },
            'kgmin': { name: 'кг/мин', factor: 1/60 },
            'th': { name: 'т/ч', factor: 0.001 },
            'ts': { name: 'т/с', factor: 0.001/3600 },
            'gh': { name: 'г/ч', factor: 1000 },
            'gs': { name: 'г/с', factor: 1000/3600 },
            'lbh': { name: 'фунт/ч', factor: 2.20462 },
            'lbs': { name: 'фунт/с', factor: 2.20462/3600 }
        }
    },
    density: {
        name: 'Плотность',
        base: 'kgm3',
        units: {
            'kgm3': { name: 'кг/м³', factor: 1 },
            'gl': { name: 'г/л', factor: 1 },
            'gcm3': { name: 'г/см³', factor: 0.001 },
            'kgl': { name: 'кг/л', factor: 0.001 },
            'tm3': { name: 'т/м³', factor: 0.001 },
            'lbft3': { name: 'фунт/фут³', factor: 0.062428 },
            'lbgal': { name: 'фунт/галлон', factor: 0.00834 }
        }
    },
    'thermal-energy': {
        name: 'Теплоэнергия',
        base: 'kwh',
        units: {
            'kwh': { name: 'кВт·ч', factor: 1 },
            'mwh': { name: 'МВт·ч', factor: 0.001 },
            'gwh': { name: 'ГВт·ч', factor: 0.000001 },
            'j': { name: 'Дж (джоуль)', factor: 3600000 },
            'kj': { name: 'кДж (килоджоуль)', factor: 3600 },
            'mj': { name: 'МДж (мегаджоуль)', factor: 3.6 },
            'gj': { name: 'ГДж (гигаджоуль)', factor: 0.0036 },
            'cal': { name: 'кал (калория)', factor: 860420.65 },
            'kcal': { name: 'ккал (килокалория)', factor: 860.42065 },
            'gcal': { name: 'Гкал (гигакалория)', factor: 0.00086042065 },
            'btu': { name: 'BTU', factor: 3412.14 }
        }
    },
    velocity: {
        name: 'Скорость потока',
        base: 'ms',
        units: {
            'ms': { name: 'м/с', factor: 1 },
            'kmh': { name: 'км/ч', factor: 3.6 },
            'mmin': { name: 'м/мин', factor: 60 },
            'cmh': { name: 'см/ч', factor: 360000 },
            'fts': { name: 'фут/с', factor: 3.28084 },
            'ftmin': { name: 'фут/мин', factor: 196.85 },
            'mph': { name: 'миля/ч', factor: 2.23694 },
            'knot': { name: 'узел', factor: 1.94384 }
        }
    }
};

// Обновление списка единиц при смене типа величины
function updateConverterUnits() {
    const typeSelect = document.getElementById('converter-type');
    const fromUnitSelect = document.getElementById('converter-from-unit');
    const toUnitSelect = document.getElementById('converter-to-unit');
    const infoEl = document.getElementById('converter-info');
    
    const selectedType = typeSelect.value;
    const unitData = CONVERSION_UNITS[selectedType];
    
    if (!unitData) return;
    
    // Обновляем информацию
    infoEl.textContent = `Конвертер: ${unitData.name}`;
    
    // Очищаем и заполняем списки единиц
    fromUnitSelect.innerHTML = '';
    toUnitSelect.innerHTML = '';
    
    let firstUnit = null;
    let secondUnit = null;
    let index = 0;
    
    for (const [key, unit] of Object.entries(unitData.units)) {
        const optionFrom = new Option(unit.name, key);
        const optionTo = new Option(unit.name, key);
        
        fromUnitSelect.add(optionFrom);
        toUnitSelect.add(optionTo);
        
        if (index === 0) firstUnit = key;
        if (index === 1) secondUnit = key;
        index++;
    }
    
    // Устанавливаем разные единицы по умолчанию
    fromUnitSelect.value = firstUnit;
    toUnitSelect.value = secondUnit || firstUnit;
    
    // Очищаем значения
    document.getElementById('converter-from-value').value = '';
    document.getElementById('converter-to-value').value = '';
}

// Автоматическая конвертация единиц
function autoConvertUnits(sourceType) {
    const typeSelect = document.getElementById('converter-type');
    const fromUnitSelect = document.getElementById('converter-from-unit');
    const toUnitSelect = document.getElementById('converter-to-unit');
    const fromValueInput = document.getElementById('converter-from-value');
    const toValueInput = document.getElementById('converter-to-value');
    
    const selectedType = typeSelect.value;
    const unitData = CONVERSION_UNITS[selectedType];
    
    if (!unitData) return;
    
    if (sourceType === 'from') {
        const value = parseFloat(fromValueInput.value);
        if (!isNaN(value)) {
            const fromUnit = unitData.units[fromUnitSelect.value];
            const toUnit = unitData.units[toUnitSelect.value];
            
            // Конвертация: значение → базовая единица → целевая единица
            const baseValue = value / fromUnit.factor;
            const convertedValue = baseValue * toUnit.factor;
            
            toValueInput.value = convertedValue.toFixed(6);
        } else {
            toValueInput.value = '';
        }
    } else if (sourceType === 'to') {
        const value = parseFloat(toValueInput.value);
        if (!isNaN(value)) {
            const fromUnit = unitData.units[fromUnitSelect.value];
            const toUnit = unitData.units[toUnitSelect.value];
            
            // Обратная конвертация
            const baseValue = value / toUnit.factor;
            const convertedValue = baseValue * fromUnit.factor;
            
            fromValueInput.value = convertedValue.toFixed(6);
        } else {
            fromValueInput.value = '';
        }
    }
}

// Закрытие модальных окон по клику вне контента
document.addEventListener('click', (e) => {
    if (e.target.classList.contains('modal')) {
        e.target.classList.remove('active');
    }
});


// Локальное хранилище данных
const CALIBRATION_STORAGE_KEY = 'calibration_instruments';

// Примеры по умолчанию
const DEFAULT_INSTRUMENTS = [
    {
        id: 1,
        name: 'Расходомер электромагнитный ПРЭМ-50',
        grsi: '51234-21',
        type: 'flow',
        lastCalibration: '2024-05-15',
        interval: 12,
        addedDate: new Date().toISOString()
    },
    {
        id: 2,
        name: 'Манометр образцовый МП3-У',
        grsi: '67890-19',
        type: 'pressure',
        lastCalibration: '2024-08-20',
        interval: 12,
        addedDate: new Date().toISOString()
    },
    {
        id: 3,
        name: 'Термометр сопротивления Pt100',
        grsi: '44210-24',
        type: 'temperature',
        lastCalibration: '2024-01-10',
        interval: 12,
        addedDate: new Date().toISOString()
    }
];

let instruments = [];

// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('instruments-list')) {
        loadInstruments();
        renderInstruments();
        updateStats();
    }
});

// Загрузка данных из localStorage
function loadInstruments() {
    try {
        const stored = localStorage.getItem(CALIBRATION_STORAGE_KEY);
        if (stored) {
            instruments = JSON.parse(stored);
        } else {
            instruments = [...DEFAULT_INSTRUMENTS];
            saveInstruments();
        }
    } catch (error) {
        console.error('Ошибка загрузки данных:', error);
        instruments = [...DEFAULT_INSTRUMENTS];
    }
}

// Сохранение данных в localStorage
function saveInstruments() {
    try {
        localStorage.setItem(CALIBRATION_STORAGE_KEY, JSON.stringify(instruments));
    } catch (error) {
        console.error('Ошибка сохранения данных:', error);
    }
}

// Определение типа прибора по названию
function detectType(name) {
    const lower = name.toLowerCase();
    if (lower.includes('расход') || lower.includes('прэм') || lower.includes('flow')) {
        return 'flow';
    }
    if (lower.includes('термо') || lower.includes('pt') || lower.includes('тсп') || lower.includes('temperature')) {
        return 'temperature';
    }
    if (lower.includes('маном') || lower.includes('давлен') || lower.includes('pressure')) {
        return 'pressure';
    }
    if (lower.includes('ph') || lower.includes('рh')) {
        return 'ph';
    }
    return 'other';
}

// Форматирование типа для отображения
function formatType(type) {
    const types = {
        flow: 'Расходомер',
        temperature: 'Термометр',
        pressure: 'Манометр',
        ph: 'pH-метр',
        other: 'Другое'
    };
    return types[type] || type;
}

// Расчет статуса калибровки
function getCalibrationStatus(instrument) {
    if (!instrument.lastCalibration) {
        return {
            class: 'status-warning',
            text: '⚠️ Калибровка не проводилась',
            daysLeft: null
        };
    }

    const lastDate = new Date(instrument.lastCalibration);
    const nextDate = new Date(lastDate);
    nextDate.setMonth(nextDate.getMonth() + (instrument.interval || 12));

    const today = new Date();
    const daysLeft = Math.ceil((nextDate - today) / (1000 * 60 * 60 * 24));

    if (daysLeft < 0) {
        return {
            class: 'status-danger',
            text: `❌ Просрочено на ${Math.abs(daysLeft)} дн.`,
            daysLeft
        };
    } else if (daysLeft <= 30) {
        return {
            class: 'status-warning',
            text: `⚠️ Осталось ${daysLeft} дн. до ${formatDateShort(nextDate)}`,
            daysLeft
        };
    } else {
        return {
            class: 'status-ok',
            text: `✅ Действительна до ${formatDateShort(nextDate)} (${daysLeft} дн.)`,
            daysLeft
        };
    }
}

// Форматирование даты
function formatDateShort(date) {
    if (!date) return '—';
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

// Отображение списка приборов
function renderInstruments() {
    const container = document.getElementById('instruments-list');
    if (!container) return;

    const searchTerm = document.getElementById('search-input')?.value.toLowerCase() || '';
    const typeFilter = document.getElementById('type-filter')?.value || 'all';

    const filtered = instruments.filter(inst => {
        const matchSearch = !searchTerm || 
            inst.name.toLowerCase().includes(searchTerm) || 
            inst.grsi.toLowerCase().includes(searchTerm);
        const matchType = typeFilter === 'all' || inst.type === typeFilter;
        return matchSearch && matchType;
    });

    if (filtered.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-search"></i>
                <h3>Ничего не найдено</h3>
                <p>Попробуйте изменить критерии поиска</p>
            </div>
        `;
        return;
    }

    container.innerHTML = filtered.map(inst => {
        const status = getCalibrationStatus(inst);
        return `
            <div class="instrument-card" onclick="showInstruction(${inst.id})" style="cursor: pointer;">
                <div class="instrument-header">
                    <div class="instrument-info">
                        <h4>${inst.name}</h4>
                        <span class="instrument-type">${formatType(inst.type)}</span>
                        <p class="instrument-grsi">ГРСИ: ${inst.grsi}</p>
                    </div>
                    <div class="instrument-actions">
                        <button class="btn-icon-action btn-delete-instrument" onclick="event.stopPropagation(); deleteInstrument(${inst.id})" title="Удалить">
                            <i class="fas fa-trash-alt"></i>
                        </button>
                    </div>
                </div>
                <div class="instrument-details">
                    <div class="detail-item">
                        <span class="detail-label">Последняя поверка</span>
                        <span class="detail-value">${formatDateShort(inst.lastCalibration)}</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">Интервал</span>
                        <span class="detail-value">${inst.interval || 12} мес.</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">Дата добавления</span>
                        <span class="detail-value">${formatDateShort(inst.addedDate)}</span>
                    </div>
                </div>
                <div class="instrument-status ${status.class}">${status.text}</div>
            </div>
        `;
    }).join('');
}

// Обновление статистики
function updateStats() {
    let total = instruments.length;
    let warning = 0;
    let expired = 0;

    instruments.forEach(inst => {
        const status = getCalibrationStatus(inst);
        if (status.class === 'status-danger') {
            expired++;
        } else if (status.class === 'status-warning') {
            warning++;
        }
    });

    const totalEl = document.getElementById('total-count');
    const warningEl = document.getElementById('warning-count');
    const expiredEl = document.getElementById('expired-count');

    if (totalEl) totalEl.textContent = total;
    if (warningEl) warningEl.textContent = warning;
    if (expiredEl) expiredEl.textContent = expired;
}

// Фильтрация списка
function filterInstruments() {
    renderInstruments();
}

// Открыть модальное окно добавления
function openAddModal() {
    const modal = document.getElementById('add-modal');
    if (modal) {
        modal.classList.add('active');
        document.getElementById('instrument-name').value = '';
        document.getElementById('instrument-grsi').value = '';
    }
}

// Закрыть модальное окно добавления
function closeAddModal() {
    const modal = document.getElementById('add-modal');
    if (modal) {
        modal.classList.remove('active');
    }
}

// Сохранить новый прибор
function saveInstrument() {
    const name = document.getElementById('instrument-name').value.trim();
    const grsi = document.getElementById('instrument-grsi').value.trim();

    if (!name || !grsi) {
        showToast('Заполните обязательные поля', 'error');
        return;
    }

    const newInstrument = {
        id: Date.now(),
        name,
        grsi,
        type: detectType(name),
        lastCalibration: null,
        interval: 12,
        addedDate: new Date().toISOString()
    };

    instruments.unshift(newInstrument);
    saveInstruments();
    renderInstruments();
    updateStats();
    closeAddModal();
    showToast('Прибор успешно добавлен! Нажмите на карточку для просмотра инструкции по калибровке.', 'info');
}

// Удалить прибор
function deleteInstrument(id) {
    if (confirm('Удалить этот прибор из реестра?')) {
        instruments = instruments.filter(inst => inst.id !== id);
        saveInstruments();
        renderInstruments();
        updateStats();
        showToast('Прибор удален', 'info');
    }
}

// Инструкции по типам приборов
const INSTRUCTIONS = {
    flow: {
        title: 'Калибровка расходомера',
        steps: [
            { title: 'Подготовка', text: 'Проверьте отсутствие повреждений. Очистите измерительную часть.' },
            { title: 'Подключение', text: 'Подключите расходомер к эталонной установке. Проверьте герметичность.' },
            { title: 'Нулевая точка', text: 'При нулевом расходе показания должны быть близки к нулю.' },
            { title: 'Контрольные точки', text: 'Проведите измерения в точках 20%, 50%, 80%, 100% диапазона.' },
            { title: 'Расчет погрешности', text: 'δ = ((Q_изм - Q_эт) / Q_эт) × 100%. Сравните с допусками.' },
            { title: 'Протокол', text: 'Заполните протокол калибровки с указанием всех результатов.' }
        ]
    },
    temperature: {
        title: 'Калибровка термометра',
        steps: [
            { title: 'Подготовка термостата', text: 'Настройте термостат с жидкостью соответствующего диапазона.' },
            { title: 'Установка датчиков', text: 'Установите эталон и поверяемый датчик на одинаковой глубине.' },
            { title: 'Стабилизация', text: 'Дождитесь стабилизации температуры (не менее 15 минут).' },
            { title: 'Измерения', text: 'Проведите измерения в 5-7 точках диапазона.' },
            { title: 'Погрешность', text: 'Δt = t_изм - t_эт. Сравните с допустимой погрешностью класса.' },
            { title: 'Оформление', text: 'Составьте протокол согласно ГОСТ 8.558-2009.' }
        ]
    },
    pressure: {
        title: 'Калибровка манометра',
        steps: [
            { title: 'Подготовка эталона', text: 'Подготовьте грузопоршневой манометр нужного класса.' },
            { title: 'Подключение', text: 'Подключите поверяемый манометр и эталон к источнику давления.' },
            { title: 'Нулевая точка', text: 'Проверьте показания при атмосферном давлении.' },
            { title: 'Повышение давления', text: 'Измерения в точках 0, 25%, 50%, 75%, 100% диапазона.' },
            { title: 'Понижение давления', text: 'Повторите при понижении для определения гистерезиса.' },
            { title: 'Вариация', text: 'Рассчитайте вариацию: |P_возр - P_пониж|.' }
        ]
    },
    ph: {
        title: 'Калибровка pH-метра',
        steps: [
            { title: 'Буферные растворы', text: 'Приготовьте стандартные буферы pH 4.01, 7.00, 10.01.' },
            { title: 'Промывка', text: 'Промойте электрод дистиллированной водой.' },
            { title: 'Первая точка', text: 'Калибровка по буферу pH 7.00.' },
            { title: 'Вторая точка', text: 'Калибровка по буферу pH 4.01 или 10.01.' },
            { title: 'Наклон', text: 'Проверьте наклон характеристики (54-60 мВ/pH при 25°C).' },
            { title: 'Контроль', text: 'Проверьте третью точку. Отклонение не более ±0.05 pH.' }
        ]
    },
    other: {
        title: 'Общая процедура калибровки',
        steps: [
            { title: 'Документация', text: 'Изучите паспорт и методику поверки для данного СИ.' },
            { title: 'Эталоны', text: 'Выберите эталоны с погрешностью в 3-5 раз меньше поверяемого.' },
            { title: 'Внешний осмотр', text: 'Проверьте комплектность и отсутствие повреждений.' },
            { title: 'Опробование', text: 'Проверьте работоспособность всех функций.' },
            { title: 'Измерения', text: 'Проведите измерения в контрольных точках.' },
            { title: 'Протокол', text: 'Оформите результаты согласно методике.' }
        ]
    }
};

// Показать инструкцию
let currentInstrumentId = null;
let editMode = false;

function showInstruction(id) {
    const inst = instruments.find(i => i.id === id);
    if (!inst) return;

    currentInstrumentId = id;
    editMode = false;

    const instruction = INSTRUCTIONS[inst.type] || INSTRUCTIONS.other;
    const modal = document.getElementById('instruction-modal');
    const content = document.getElementById('instruction-content');
    const titleEl = document.getElementById('instruction-title');

    if (!modal || !content) return;

    // Загружаем сохраненную инструкцию или используем стандартную
    const savedInstruction = inst.customInstruction || instruction;
    const files = inst.files || [];

    titleEl.textContent = `Инструкция: ${inst.name}`;

    renderInstructionContent(inst, savedInstruction, files, false);
    modal.classList.add('active');
}

function renderInstructionContent(inst, instruction, files, isEditMode) {
    const content = document.getElementById('instruction-content');
    const footer = document.getElementById('instruction-footer');

    content.innerHTML = `
        <div style="background: linear-gradient(135deg, #dbeafe, #eff6ff); padding: 24px; border-radius: 16px; margin-bottom: 24px;">
            <h3 style="margin: 0 0 12px 0; color: #1e40af; font-size: 24px;">${instruction.title}</h3>
            <p style="margin: 0; color: #475569;"><strong>Прибор:</strong> ${inst.name}</p>
            <p style="margin: 4px 0 0 0; color: #475569;"><strong>ГРСИ:</strong> ${inst.grsi}</p>
        </div>
        <div id="instruction-steps">
            ${instruction.steps.map((step, index) => `
                <div class="instruction-step ${isEditMode ? 'edit-mode' : ''}" data-step-index="${index}">
                    <div class="step-number">${index + 1}</div>
                    <div class="step-text">
                        <h4 contenteditable="${isEditMode}" data-field="title">${step.title}</h4>
                        ${isEditMode ? 
                            `<textarea data-field="text" rows="3">${step.text}</textarea>` :
                            `<p>${step.text}</p>`
                        }
                    </div>
                    ${isEditMode ? `
                        <div class="step-actions">
                            <button class="btn-step-action btn-step-delete" onclick="deleteStep(${index})" title="Удалить шаг">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                    ` : ''}
                </div>
            `).join('')}
        </div>
        ${isEditMode ? `
            <button class="add-step-btn" onclick="addNewStep()">
                <i class="fas fa-plus-circle"></i>
                Добавить шаг
            </button>
        ` : ''}
        <div class="file-upload-section">
            <div class="file-upload-header">
                <h4><i class="fas fa-paperclip"></i> Прикрепленные файлы</h4>
                ${isEditMode ? `
                    <button class="btn-save" onclick="openFileUpload()">
                        <i class="fas fa-upload"></i>
                        Загрузить файл
                    </button>
                ` : ''}
            </div>
            ${files.length > 0 ? `
                <div class="file-list">
                    ${files.map((file, index) => `
                        <div class="file-item">
                            <div class="file-info">
                                <div class="file-icon">
                                    <i class="fas fa-file-${getFileIcon(file.name)}"></i>
                                </div>
                                <div class="file-details">
                                    <div class="file-name">${file.name}</div>
                                    <div class="file-size">${formatFileSize(file.size)} • ${formatDate(file.uploadedAt)}</div>
                                </div>
                            </div>
                            <div class="file-actions">
                                <button class="btn-file-action btn-file-download" onclick="downloadFile(${currentInstrumentId}, ${index})" title="Скачать">
                                    <i class="fas fa-download"></i>
                                </button>
                                ${isEditMode ? `
                                    <button class="btn-file-action btn-file-delete" onclick="deleteFile(${index})" title="Удалить">
                                        <i class="fas fa-trash"></i>
                                    </button>
                                ` : ''}
                            </div>
                        </div>
                    `).join('')}
                </div>
            ` : `
                <div style="text-align: center; padding: 32px; color: #94a3b8;">
                    <i class="fas fa-folder-open" style="font-size: 48px; opacity: 0.3; margin-bottom: 12px;"></i>
                    <p style="margin: 0;">Файлы не прикреплены</p>
                </div>
            `}
            <input type="file" id="file-input" multiple style="display: none;" onchange="handleFileSelect(event)">
        </div>
        <div style="background: linear-gradient(135deg, #fef3c7, #fef9c3); padding: 20px; border-radius: 12px; border-left: 4px solid #f59e0b; margin-top: 24px;">
            <p style="margin: 0; color: #92400e; font-weight: 600;">
                <i class="fas fa-exclamation-triangle" style="margin-right: 8px;"></i>
                Не забудьте оформить протокол и обновить дату последней калибровки.
            </p>
        </div>
    `;

    if (isEditMode) {
        footer.innerHTML = `
            <button class="btn-secondary" onclick="cancelEdit()">
                <i class="fas fa-times"></i>
                Отмена
            </button>
            <button class="btn-primary" onclick="saveInstruction()">
                <i class="fas fa-save"></i>
                Сохранить изменения
            </button>
        `;
    } else {
        footer.innerHTML = `
            <button class="btn-secondary" onclick="closeInstructionModal()">
                <i class="fas fa-times"></i>
                Закрыть
            </button>
        `;
    }
}

function toggleEditMode() {
    editMode = !editMode;
    const inst = instruments.find(i => i.id === currentInstrumentId);
    if (!inst) return;

    const instruction = inst.customInstruction || INSTRUCTIONS[inst.type] || INSTRUCTIONS.other;
    const files = inst.files || [];

    renderInstructionContent(inst, instruction, files, editMode);
}

function cancelEdit() {
    editMode = false;
    showInstruction(currentInstrumentId);
}

function saveInstruction() {
    const inst = instruments.find(i => i.id === currentInstrumentId);
    if (!inst) return;

    const steps = [];
    document.querySelectorAll('.instruction-step').forEach((stepEl, index) => {
        const title = stepEl.querySelector('[data-field="title"]').textContent.trim();
        const textField = stepEl.querySelector('[data-field="text"]');
        const text = textField ? textField.value.trim() : stepEl.querySelector('p').textContent.trim();
        
        steps.push({ title, text });
    });

    inst.customInstruction = {
        title: document.querySelector('#instruction-content h3').textContent,
        steps: steps
    };

    saveInstruments();
    showToast('Инструкция успешно сохранена!', 'info');
    editMode = false;
    showInstruction(currentInstrumentId);
}

function addNewStep() {
    const inst = instruments.find(i => i.id === currentInstrumentId);
    if (!inst) return;

    const instruction = inst.customInstruction || INSTRUCTIONS[inst.type] || INSTRUCTIONS.other;
    instruction.steps.push({
        title: 'Новый шаг',
        text: 'Описание шага'
    });

    if (!inst.customInstruction) {
        inst.customInstruction = { ...instruction };
    }

    renderInstructionContent(inst, instruction, inst.files || [], true);
}

function deleteStep(index) {
    if (!confirm('Удалить этот шаг?')) return;

    const inst = instruments.find(i => i.id === currentInstrumentId);
    if (!inst) return;

    const instruction = inst.customInstruction || INSTRUCTIONS[inst.type] || INSTRUCTIONS.other;
    instruction.steps.splice(index, 1);

    if (!inst.customInstruction) {
        inst.customInstruction = { ...instruction };
    }

    renderInstructionContent(inst, instruction, inst.files || [], true);
}

function openFileUpload() {
    document.getElementById('file-input').click();
}

function handleFileSelect(event) {
    const files = Array.from(event.target.files);
    const inst = instruments.find(i => i.id === currentInstrumentId);
    if (!inst) return;

    if (!inst.files) {
        inst.files = [];
    }

    files.forEach(file => {
        const reader = new FileReader();
        reader.onload = (e) => {
            inst.files.push({
                name: file.name,
                size: file.size,
                type: file.type,
                data: e.target.result,
                uploadedAt: new Date().toISOString()
            });
            
            saveInstruments();
            const instruction = inst.customInstruction || INSTRUCTIONS[inst.type] || INSTRUCTIONS.other;
            renderInstructionContent(inst, instruction, inst.files, editMode);
        };
        reader.readAsDataURL(file);
    });

    event.target.value = '';
}

function deleteFile(index) {
    if (!confirm('Удалить этот файл?')) return;

    const inst = instruments.find(i => i.id === currentInstrumentId);
    if (!inst) return;

    inst.files.splice(index, 1);
    saveInstruments();

    const instruction = inst.customInstruction || INSTRUCTIONS[inst.type] || INSTRUCTIONS.other;
    renderInstructionContent(inst, instruction, inst.files, editMode);
    showToast('Файл удален', 'info');
}

function downloadFile(instrumentId, fileIndex) {
    const inst = instruments.find(i => i.id === instrumentId);
    if (!inst || !inst.files || !inst.files[fileIndex]) return;

    const file = inst.files[fileIndex];
    const link = document.createElement('a');
    link.href = file.data;
    link.download = file.name;
    link.click();
}

function getFileIcon(filename) {
    const ext = filename.split('.').pop().toLowerCase();
    const icons = {
        pdf: 'pdf',
        doc: 'word',
        docx: 'word',
        xls: 'excel',
        xlsx: 'excel',
        jpg: 'image',
        jpeg: 'image',
        png: 'image',
        gif: 'image',
        zip: 'archive',
        rar: 'archive'
    };
    return icons[ext] || 'alt';
}

function formatFileSize(bytes) {
    if (bytes < 1024) return bytes + ' Б';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' КБ';
    return (bytes / (1024 * 1024)).toFixed(1) + ' МБ';
}

function formatDate(dateStr) {
    if (!dateStr) return '—';
    const date = new Date(dateStr);
    return date.toLocaleDateString('ru-RU', { 
        day: '2-digit', 
        month: '2-digit', 
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

// Закрыть модальное окно инструкции
function closeInstructionModal() {
    const modal = document.getElementById('instruction-modal');
    if (modal) {
        modal.classList.remove('active');
    }
}

// Закрытие модальных окон по клику на фон
document.addEventListener('click', (e) => {
    if (e.target.classList.contains('calibration-modal')) {
        e.target.classList.remove('active');
    }
});

