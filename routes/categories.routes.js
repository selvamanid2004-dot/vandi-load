/**
 * Vandi Load - Vehicle Categories Routes
 * Full CRUD for vehicle categories with public synchronization.
 */

const express = require('express');
const router = express.Router();
const db = require('../database/db');
const { requireAdminAuth } = require('../middleware/auth');

// Format category row
function formatCategory(c) {
  return {
    id: c.id,
    name: c.name,
    description: c.description || '',
    image: c.image || '',
    capacityInfo: c.capacity_info || '',
    displayOrder: c.display_order || 0,
    status: c.status || 'active',
    createdAt: c.created_at,
    updatedAt: c.updated_at
  };
}

// -----------------------------------------------------------------------------
// PUBLIC ENDPOINTS
// -----------------------------------------------------------------------------

// GET /api/categories (Public active categories)
router.get('/', (req, res) => {
  try {
    const rows = db.prepare(`
      SELECT * FROM categories 
      WHERE status = 'active'
      ORDER BY display_order ASC, name ASC
    `).all();
    res.json({ success: true, data: rows.map(formatCategory) });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// -----------------------------------------------------------------------------
// ADMIN PROTECTED ENDPOINTS
// -----------------------------------------------------------------------------

// GET /api/categories/admin/all (Admin all categories)
router.get('/admin/all', requireAdminAuth, (req, res) => {
  try {
    const rows = db.prepare(`
      SELECT * FROM categories 
      ORDER BY display_order ASC, name ASC
    `).all();
    res.json({ success: true, data: rows.map(formatCategory) });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/categories/admin/create (Admin add category)
router.post('/admin/create', requireAdminAuth, (req, res) => {
  try {
    const { id, name, description, image, capacityInfo, displayOrder, status } = req.body;

    if (!name) {
      return res.status(400).json({ success: false, message: 'Category name is required' });
    }

    const categoryId = (id || name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')) + (id ? '' : '-' + Date.now().toString().slice(-4));

    const insert = db.prepare(`
      INSERT INTO categories (id, name, description, image, capacity_info, display_order, status)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    insert.run(
      categoryId,
      name,
      description || '',
      image || '',
      capacityInfo || '',
      parseInt(displayOrder, 10) || 0,
      status || 'active'
    );

    const created = db.prepare('SELECT * FROM categories WHERE id = ?').get(categoryId);
    res.json({ success: true, message: 'Category created successfully', data: formatCategory(created) });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PUT /api/categories/admin/:id (Admin update category)
router.put('/admin/:id', requireAdminAuth, (req, res) => {
  try {
    const catId = req.params.id;
    const existing = db.prepare('SELECT * FROM categories WHERE id = ?').get(catId);
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Category not found' });
    }

    const { name, description, image, capacityInfo, displayOrder, status } = req.body;

    const update = db.prepare(`
      UPDATE categories SET
        name = ?,
        description = ?,
        image = ?,
        capacity_info = ?,
        display_order = ?,
        status = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);

    update.run(
      name || existing.name,
      description !== undefined ? description : existing.description,
      image !== undefined ? image : existing.image,
      capacityInfo !== undefined ? capacityInfo : existing.capacity_info,
      displayOrder !== undefined ? parseInt(displayOrder, 10) : existing.display_order,
      status || existing.status,
      catId
    );

    const updated = db.prepare('SELECT * FROM categories WHERE id = ?').get(catId);
    res.json({ success: true, message: 'Category updated successfully', data: formatCategory(updated) });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PATCH /api/categories/admin/:id/status (Admin toggle status)
router.patch('/admin/:id/status', requireAdminAuth, (req, res) => {
  try {
    const { status } = req.body;
    if (!status || !['active', 'inactive'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Valid status required' });
    }

    db.prepare('UPDATE categories SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(status, req.params.id);
    res.json({ success: true, message: `Category status updated to ${status}` });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// DELETE /api/categories/admin/:id (Admin delete category)
router.delete('/admin/:id', requireAdminAuth, (req, res) => {
  try {
    const result = db.prepare('DELETE FROM categories WHERE id = ?').run(req.params.id);
    if (result.changes === 0) {
      return res.status(404).json({ success: false, message: 'Category not found' });
    }
    res.json({ success: true, message: 'Category deleted successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
