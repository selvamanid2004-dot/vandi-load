/**
 * Vandi Load - Driver Secure Document Upload Middleware
 * Uploads Driver documents (Driving Licence & Aadhaar Card) to a non-public secure storage directory.
 */

const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

// Secure private directory (NOT exposed via express.static)
const secureDocsDir = path.join(__dirname, '..', 'storage', 'driver_documents');
if (!fs.existsSync(secureDocsDir)) {
  fs.mkdirSync(secureDocsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, secureDocsDir);
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname).toLowerCase();
    const safeField = file.fieldname.replace(/[^a-zA-Z0-9]/g, '_');
    const randomHex = crypto.randomBytes(8).toString('hex');
    const uniqueName = `doc_${safeField}_${Date.now()}_${randomHex}${ext}`;
    cb(null, uniqueName);
  }
});

const allowedMimeTypes = [
  'image/jpeg',
  'image/jpg',
  'image/pjpeg',
  'image/png',
  'application/pdf'
];

const allowedExtensions = ['.jpg', '.jpeg', '.png', '.pdf'];

const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  const mime = (file.mimetype || '').toLowerCase();

  const isExtAllowed = allowedExtensions.includes(ext);
  const isMimeAllowed = allowedMimeTypes.includes(mime);

  if (isExtAllowed && isMimeAllowed) {
    return cb(null, true);
  }

  cb(new Error(`Invalid document format (${file.originalname}). Only JPG, JPEG, PNG, and PDF files are accepted.`));
};

const documentUpload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit per document
  },
  fileFilter: fileFilter
});

/**
 * Validates magic numbers (file signatures) of uploaded document buffers
 * to prevent disguised/malicious files.
 */
function validateFileSignature(filePath) {
  try {
    if (!fs.existsSync(filePath)) return false;
    const buffer = Buffer.alloc(8);
    const fd = fs.openSync(filePath, 'r');
    fs.readSync(fd, buffer, 0, 8, 0);
    fs.closeSync(fd);

    // PDF signature: %PDF (0x25 0x50 0x44 0x46)
    if (buffer[0] === 0x25 && buffer[1] === 0x50 && buffer[2] === 0x44 && buffer[3] === 0x46) {
      return { valid: true, type: 'application/pdf' };
    }

    // PNG signature: 89 50 4E 47 0D 0A 1A 0A
    if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47) {
      return { valid: true, type: 'image/png' };
    }

    // JPEG signature: FF D8 FF
    if (buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) {
      return { valid: true, type: 'image/jpeg' };
    }

    return { valid: false };
  } catch (err) {
    return { valid: false, error: err.message };
  }
}

module.exports = {
  documentUpload,
  secureDocsDir,
  validateFileSignature
};
