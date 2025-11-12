// config/multerConfig.js
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Создаем папку uploads, если её нет
const uploadDir = path.join(__dirname, '..', 'public', 'uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
    console.log('[Multer] Создана директория для загрузки файлов:', uploadDir);
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'public/uploads'); 
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});

// Добавляем ограничение на размер файла в 1 МБ
const upload = multer({ 
    storage: storage,
    limits: { fileSize: 1024 * 1024 } // 1 MB в байтах
});

module.exports = upload;