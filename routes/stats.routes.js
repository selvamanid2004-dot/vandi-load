/**
 * Vandi Load - Admin Dashboard Statistics API
 */

const express = require('express');
const router = express.Router();
const db = require('../database/db');
const { requireAdminAuth } = require('../middleware/auth');

// GET /api/admin/stats
router.get('/', requireAdminAuth, (req, res) => {
  try {
    const totalVehicles = db.prepare('SELECT COUNT(*) as c FROM vehicles').get().c;
    const activeVehicles = db.prepare("SELECT COUNT(*) as c FROM vehicles WHERE status = 'active'").get().c;
    const totalCategories = db.prepare('SELECT COUNT(*) as c FROM categories').get().c;
    const activeCategories = db.prepare("SELECT COUNT(*) as c FROM categories WHERE status = 'active'").get().c;
    const totalGallery = db.prepare('SELECT COUNT(*) as c FROM gallery').get().c;
    const totalEnquiries = db.prepare('SELECT COUNT(*) as c FROM contact_enquiries').get().c;
    const newEnquiries = db.prepare("SELECT COUNT(*) as c FROM contact_enquiries WHERE status = 'new'").get().c;
    const pendingAssignments = db.prepare("SELECT COUNT(*) as c FROM contact_enquiries WHERE assignment_status = 'Pending'").get().c;
    const activeAssignments = db.prepare("SELECT COUNT(*) as c FROM contact_enquiries WHERE assignment_status IN ('Assigned', 'Waiting for Driver Confirmation', 'Driver Confirmed', 'In Progress') AND cancelled_at IS NULL").get().c;
    const completedOrders = db.prepare("SELECT COUNT(*) as c FROM contact_enquiries WHERE assignment_status = 'Completed'").get().c;
    const totalDrivers = db.prepare('SELECT COUNT(*) as c FROM driver_applications').get().c;
    const pendingDrivers = db.prepare("SELECT COUNT(*) as c FROM driver_applications WHERE status = 'pending'").get().c;
    const approvedDrivers = db.prepare("SELECT COUNT(*) as c FROM driver_applications WHERE status = 'approved'").get().c;

    // Recent 5 enquiries
    const recentEnquiries = db.prepare(`
      SELECT * FROM contact_enquiries 
      ORDER BY id DESC 
      LIMIT 5
    `).all();

    // Recent 5 driver applications
    const recentDrivers = db.prepare(`
      SELECT * FROM driver_applications 
      ORDER BY id DESC 
      LIMIT 5
    `).all();

    res.json({
      success: true,
      stats: {
        totalVehicles,
        activeVehicles,
        totalCategories,
        activeCategories,
        totalGallery,
        totalEnquiries,
        newEnquiries,
        pendingAssignments,
        activeAssignments,
        completedOrders,
        totalDrivers,
        pendingDrivers,
        approvedDrivers
      },
      recentEnquiries,
      recentDrivers
    });
  } catch (err) {
    console.error('Stats error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch dashboard stats' });
  }
});

module.exports = router;
