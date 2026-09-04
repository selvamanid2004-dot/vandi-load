/**
 * Vandi Load - Vehicles Routes
 * Handles public catalog fetching and complete admin CRUD.
 */

const express = require('express');
const router = express.Router();
const db = require('../database/db');
const { requireAdminAuth } = require('../middleware/auth');

// Helper to format vehicle row
function formatVehicle(v) {
  let bestFor = [];
  try {
    bestFor = typeof v.best_for === 'string' ? JSON.parse(v.best_for) : (v.best_for || []);
  } catch (e) {
    bestFor = v.best_for ? [v.best_for] : [];
  }

  return {
    id: v.id,
    name: v.name,
    category: v.category,
    capacityKg: v.capacity_kg,
    capacityBoxes: v.capacity_boxes,
    bedSize: v.bed_size,
    badge: v.badge || '',
    bestFor: bestFor,
    description: v.description || '',
    image: v.image,
    displayOrder: v.display_order,
    status: v.status,
    createdAt: v.created_at,
    updatedAt: v.updated_at
  };
}

// -----------------------------------------------------------------------------
// PUBLIC ENDPOINTS
// -----------------------------------------------------------------------------

// GET /api/vehicles (Public active catalog)
router.get('/', (req, res) => {
  try {
    const rows = db.prepare(`
      SELECT * FROM vehicles 
      WHERE status = 'active' 
      ORDER BY display_order ASC, name ASC
    `).all();

    const formatted = rows.map(formatVehicle);
    res.json({ success: true, data: formatted });
  } catch (err) {
    console.error('Error fetching public vehicles:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch vehicles' });
  }
});

// GET /api/vehicles/:id (Public single vehicle)
router.get('/:id', (req, res) => {
  try {
    const row = db.prepare('SELECT * FROM vehicles WHERE id = ?').get(req.params.id);
    if (!row) {
      return res.status(404).json({ success: false, message: 'Vehicle not found' });
    }
    res.json({ success: true, data: formatVehicle(row) });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// -----------------------------------------------------------------------------
// ADMIN PROTECTED ENDPOINTS
// -----------------------------------------------------------------------------

// GET /api/admin/vehicles (Admin list with search & category filters)
router.get('/admin/all', requireAdminAuth, (req, res) => {
  try {
    const { category, search, status } = req.query;
    let query = 'SELECT * FROM vehicles WHERE 1=1';
    const params = [];

    if (category && category !== 'all') {
      query += ' AND category = ?';
      params.push(category);
    }
    if (status && status !== 'all') {
      query += ' AND status = ?';
      params.push(status);
    }
    if (search) {
      query += ' AND (name LIKE ? OR description LIKE ? OR capacity_kg LIKE ?)';
      const term = `%${search}%`;
      params.push(term, term, term);
    }

    query += ' ORDER BY display_order ASC, name ASC';

    const rows = db.prepare(query).all(...params);
    res.json({ success: true, data: rows.map(formatVehicle) });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/admin/vehicles (Create new vehicle)
router.post('/admin/create', requireAdminAuth, (req, res) => {
  try {
    const {
      id,
      name,
      category,
      capacityKg,
      capacityBoxes,
      bedSize,
      badge,
      bestFor,
      description,
      image,
      displayOrder,
      status
    } = req.body;

    if (!name || !category || !capacityKg) {
      return res.status(400).json({
        success: false,
        message: 'Vehicle name, category, and load capacity are required'
      });
    }

    // Auto-generate slug ID if not provided
    const vehicleId = (id || name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')) + '-' + Date.now().toString().slice(-4);

    const bestForJson = Array.isArray(bestFor) 
      ? JSON.stringify(bestFor) 
      : JSON.stringify(typeof bestFor === 'string' ? bestFor.split('\n').filter(Boolean) : []);

    const insert = db.prepare(`
      INSERT INTO vehicles (
        id, name, category, capacity_kg, capacity_boxes, bed_size,
        badge, best_for, description, image, display_order, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    insert.run(
      vehicleId,
      name,
      category || 'pickup',
      capacityKg,
      capacityBoxes || '',
      bedSize || '',
      badge || '',
      bestForJson,
      description || '',
      image || 'assets/images/vehicles/mini-pickup.jpg',
      displayOrder || 0,
      status || 'active'
    );

    const created = db.prepare('SELECT * FROM vehicles WHERE id = ?').get(vehicleId);
    res.json({
      success: true,
      message: 'Vehicle created successfully',
      data: formatVehicle(created)
    });
  } catch (err) {
    console.error('Error creating vehicle:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// PUT /api/admin/vehicles/:id (Update vehicle)
router.put('/admin/:id', requireAdminAuth, (req, res) => {
  try {
    const vehicleId = req.params.id;
    const existing = db.prepare('SELECT * FROM vehicles WHERE id = ?').get(vehicleId);
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Vehicle not found' });
    }

    const {
      name,
      category,
      capacityKg,
      capacityBoxes,
      bedSize,
      badge,
      bestFor,
      description,
      image,
      displayOrder,
      status
    } = req.body;

    const bestForJson = Array.isArray(bestFor) 
      ? JSON.stringify(bestFor) 
      : JSON.stringify(typeof bestFor === 'string' ? bestFor.split('\n').filter(Boolean) : []);

    const update = db.prepare(`
      UPDATE vehicles SET
        name = ?,
        category = ?,
        capacity_kg = ?,
        capacity_boxes = ?,
        bed_size = ?,
        badge = ?,
        best_for = ?,
        description = ?,
        image = ?,
        display_order = ?,
        status = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);

    update.run(
      name || existing.name,
      category || existing.category,
      capacityKg || existing.capacity_kg,
      capacityBoxes !== undefined ? capacityBoxes : existing.capacity_boxes,
      bedSize !== undefined ? bedSize : existing.bed_size,
      badge !== undefined ? badge : existing.badge,
      bestForJson,
      description !== undefined ? description : existing.description,
      image || existing.image,
      displayOrder !== undefined ? displayOrder : existing.display_order,
      status || existing.status,
      vehicleId
    );

    const updated = db.prepare('SELECT * FROM vehicles WHERE id = ?').get(vehicleId);
    res.json({
      success: true,
      message: 'Vehicle updated successfully',
      data: formatVehicle(updated)
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PATCH /api/admin/vehicles/:id/status (Toggle status)
router.patch('/admin/:id/status', requireAdminAuth, (req, res) => {
  try {
    const { status } = req.body;
    if (!status || !['active', 'inactive'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Valid status (active/inactive) required' });
    }

    db.prepare('UPDATE vehicles SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(status, req.params.id);
    res.json({ success: true, message: `Vehicle status updated to ${status}` });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// DELETE /api/admin/vehicles/:id (Delete vehicle)
router.delete('/admin/:id', requireAdminAuth, (req, res) => {
  try {
    const result = db.prepare('DELETE FROM vehicles WHERE id = ?').run(req.params.id);
    if (result.changes === 0) {
      return res.status(404).json({ success: false, message: 'Vehicle not found' });
    }
    res.json({ success: true, message: 'Vehicle deleted successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
