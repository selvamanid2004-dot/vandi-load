/**
 * Vandi Load - Gallery Routes
 */

const express = require('express');
const router = express.Router();
const db = require('../database/db');
const { requireAdminAuth } = require('../middleware/auth');

// GET /api/gallery (Public active gallery)
router.get('/', (req, res) => {
  try {
    const rows = db.prepare(`
      SELECT id, title, category, image_url as src, display_order, status
      FROM gallery 
      WHERE status = 'active'
      ORDER BY display_order ASC, id DESC
    `).all();
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/admin/gallery (Admin all gallery items)
router.get('/admin/all', requireAdminAuth, (req, res) => {
  try {
    const rows = db.prepare(`
      SELECT id, title, category, image_url as src, display_order, status, created_at
      FROM gallery 
      ORDER BY display_order ASC, id DESC
    `).all();
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/admin/gallery (Add photo)
router.post('/admin/create', requireAdminAuth, (req, res) => {
  try {
    const { title, category, imageUrl, displayOrder } = req.body;

    if (!title || !imageUrl) {
      return res.status(400).json({ success: false, message: 'Title and image URL are required' });
    }

    const insert = db.prepare(`
      INSERT INTO gallery (title, category, image_url, display_order, status)
      VALUES (?, ?, ?, ?, 'active')
    `);

    const result = insert.run(title, category || 'all', imageUrl, displayOrder || 0);
    const created = db.prepare('SELECT id, title, category, image_url as src, display_order, status FROM gallery WHERE id = ?').get(result.lastInsertRowid);

    res.json({ success: true, message: 'Gallery image added successfully', data: created });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PATCH /api/admin/gallery/:id/status
router.patch('/admin/:id/status', requireAdminAuth, (req, res) => {
  try {
    const { status } = req.body;
    db.prepare('UPDATE gallery SET status = ? WHERE id = ?').run(status, req.params.id);
    res.json({ success: true, message: 'Gallery item status updated' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// DELETE /api/admin/gallery/:id
router.delete('/admin/:id', requireAdminAuth, (req, res) => {
  try {
    db.prepare('DELETE FROM gallery WHERE id = ?').run(req.params.id);
    res.json({ success: true, message: 'Gallery item deleted successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
