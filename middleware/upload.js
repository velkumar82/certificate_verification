const multer = require('multer');
const path = require('path');
const crypto = require('crypto');
const fs = require('fs');

const UPLOAD_ROOT = path.join(__dirname, '..', 'uploads');
const CERT_DIR = path.join(UPLOAD_ROOT, 'certificates');
const PAYMENT_DIR = path.join(UPLOAD_ROOT, 'payments');

[CERT_DIR, PAYMENT_DIR].forEach((dir) => {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

const ALLOWED_MIME = new Set([
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/webp'
]);

function safeFilename(originalName) {
    const ext = path.extname(originalName).toLowerCase();
    const random = crypto.randomBytes(16).toString('hex');
    return `${Date.now()}_${random}${ext}`;
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        if (file.fieldname === 'certificate_file') return cb(null, CERT_DIR);
        if (file.fieldname === 'payment_screenshot') return cb(null, PAYMENT_DIR);
        cb(new Error('Unexpected field'));
    },
    filename: (req, file, cb) => {
        cb(null, safeFilename(file.originalname));
    }
});

function fileFilter(req, file, cb) {
    if (!ALLOWED_MIME.has(file.mimetype)) {
        return cb(new Error('Only PDF, JPG, PNG or WEBP files are allowed'));
    }
    cb(null, true);
}

const upload = multer({
    storage,
    fileFilter,
    limits: {
        fileSize: 5 * 1024 * 1024 // 5 MB per file
    }
});

// Applicant certificate submission needs both files.
const submitUpload = upload.fields([
    { name: 'certificate_file', maxCount: 1 },
    { name: 'payment_screenshot', maxCount: 1 }
]);

module.exports = { submitUpload, CERT_DIR, PAYMENT_DIR };
