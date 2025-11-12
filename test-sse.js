// Тестовый скрипт для проверки SSE событий
const { sendEvent } = require('./event-emitter');

console.log('Отправляю тестовое событие maintenance-updated...');
sendEvent({ test: true }, 'maintenance-updated');

console.log('Событие отправлено!');
console.log('Проверьте консоль браузера - должно появиться сообщение о получении события.');

setTimeout(() => {
    process.exit(0);
}, 1000);
