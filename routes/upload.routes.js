/**
 * Vandi Load - Image Upload Routes
 */

const express = require('express');
const router = express.Router();
const upload = require('../middleware/upload');
const { requireAdminAuth } = require('../middleware/auth');

// POST /api/upload (Admin: Upload an image file)
router.post('/', requireAdminAuth, upload.single('image'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No image file uploaded' });
    }

    const fileUrl = 'uploads/' + req.file.filename;

    res.json({
      success: true,
      message: 'Image uploaded successfully',
      fileUrl: fileUrl,
      fileName: req.file.filename
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
