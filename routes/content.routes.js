/**
 * Vandi Load - Website Content Routes
 */

const express = require('express');
const router = express.Router();
const db = require('../database/db');
const { requireAdminAuth } = require('../middleware/auth');

// GET /api/content (Public: get all website sections)
router.get('/', (req, res) => {
  try {
    const rows = db.prepare('SELECT section_key, content_json FROM website_content').all();
    const content = {};
    for (const r of rows) {
      try {
        content[r.section_key] = JSON.parse(r.content_json);
      } catch (e) {
        content[r.section_key] = r.content_json;
      }
    }
    res.json({ success: true, data: content });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PUT /api/content/:sectionKey (Admin: update a website section)
router.put('/:sectionKey', requireAdminAuth, (req, res) => {
  try {
    const { sectionKey } = req.params;
    const { content } = req.body;

    if (!content) {
      return res.status(400).json({ success: false, message: 'Content data is required' });
    }

    const contentJson = typeof content === 'object' ? JSON.stringify(content) : content;

    const upsert = db.prepare(`
      INSERT INTO website_content (section_key, content_json, updated_at)
      VALUES (?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(section_key) DO UPDATE SET
        content_json = excluded.content_json,
        updated_at = CURRENT_TIMESTAMP
    `);

    upsert.run(sectionKey, contentJson);

    res.json({ success: true, message: `Section '${sectionKey}' updated successfully` });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
