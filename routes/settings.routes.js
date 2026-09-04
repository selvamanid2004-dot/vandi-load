/**
 * Vandi Load - Global Settings Routes
 */

const express = require('express');
const router = express.Router();
const db = require('../database/db');
const { requireAdminAuth } = require('../middleware/auth');

// GET /api/settings (Public: get all settings)
router.get('/', (req, res) => {
  try {
    const rows = db.prepare('SELECT setting_key, setting_value FROM settings').all();
    const settings = {};
    for (const r of rows) {
      settings[r.setting_key] = r.setting_value;
    }
    res.json({ success: true, data: settings });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PUT /api/settings (Admin: bulk update settings)
router.put('/', requireAdminAuth, (req, res) => {
  try {
    const settings = req.body;
    if (!settings || typeof settings !== 'object') {
      return res.status(400).json({ success: false, message: 'Settings object is required' });
    }

    const upsert = db.prepare(`
      INSERT INTO settings (setting_key, setting_value, updated_at)
      VALUES (?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(setting_key) DO UPDATE SET
        setting_value = excluded.setting_value,
        updated_at = CURRENT_TIMESTAMP
    `);

    for (const [key, val] of Object.entries(settings)) {
      upsert.run(key, String(val));
    }

    res.json({ success: true, message: 'Settings updated successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
