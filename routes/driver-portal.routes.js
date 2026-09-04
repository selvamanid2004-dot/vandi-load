/**
 * Vandi Load - Driver Portal API Routes
 * Secure endpoints for authenticated drivers to view profile, manage assigned trips, and update statuses.
 */

const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../database/db');
const { requireDriverAuth, JWT_SECRET } = require('../middleware/auth');
const { broadcastAdminEvent } = require('../services/realtime.service');

// =============================================================================
// 1. DRIVER AUTHENTICATION
// =============================================================================

// POST /api/driver/auth/login
router.post('/auth/login', (req, res) => {
  try {
    const { phone, password } = req.body;

    if (!phone || !password) {
      return res.status(400).json({
        success: false,
        message: 'Phone number and password are required'
      });
    }

    const cleanPhone = phone.trim().replace(/\D/g, '');
    const last10 = cleanPhone.length >= 10 ? cleanPhone.slice(-10) : cleanPhone;
    
    // Find driver matching phone (prioritizing approved status if duplicate records exist)
    const matchingDrivers = db.prepare(`
      SELECT * FROM driver_applications 
      WHERE replace(replace(replace(replace(replace(phone, ' ', ''), '-', ''), '+', ''), '(', ''), ')', '') LIKE ?
         OR replace(replace(replace(replace(replace(phone, ' ', ''), '-', ''), '+', ''), '(', ''), ')', '') = ?
         OR phone = ?
         OR phone LIKE ?
      ORDER BY 
        CASE 
          WHEN LOWER(status) = 'approved' THEN 0
          WHEN LOWER(status) = 'pending' THEN 1
          ELSE 2 
        END,
        id DESC
    `).all(`%${last10}%`, cleanPhone, phone.trim(), `%${last10}`);

    if (!matchingDrivers || matchingDrivers.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'No driver registered with this phone number.'
      });
    }

    const driver = matchingDrivers[0];
    const status = (driver.status || '').toLowerCase();

    // Check Approval Status
    if (status === 'pending') {
      return res.status(403).json({
        success: false,
        message: 'Your driver application is pending approval by the Vandi Load admin team.'
      });
    }

    if (status === 'rejected') {
      return res.status(403).json({
        success: false,
        message: 'Your driver registration was not approved. Please contact support.'
      });
    }

    if (status !== 'approved') {
      return res.status(403).json({
        success: false,
        message: 'Your driver account is not approved for portal access.'
      });
    }

    // Check Password
    let isPasswordValid = false;
    if (driver.password_hash) {
      isPasswordValid = bcrypt.compareSync(password, driver.password_hash);
    } else {
      // Default initial credentials for newly approved drivers without a custom password:
      // Accepts 'driver123' or their own 10-digit mobile number
      const driverCleanPhone = (driver.phone || '').replace(/\D/g, '');
      const driverLast10 = driverCleanPhone.slice(-10);
      isPasswordValid = (password === 'driver123' || password === cleanPhone || password === last10 || password === driver.phone || password === driverLast10);
    }

    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid password. (Default password for approved drivers is driver123)'
      });
    }

    // Sign Driver JWT with standard session expiration
    const token = jwt.sign(
      {
        id: driver.id,
        phone: driver.phone,
        name: driver.full_name,
        role: 'driver'
      },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      success: true,
      message: 'Driver login successful',
      token,
      driver: {
        id: driver.id,
        fullName: driver.full_name,
        phone: driver.phone,
        location: driver.location,
        vehicleType: driver.vehicle_type,
        vehicleNumber: driver.vehicle_number,
        experience: driver.experience,
        status: driver.status
      }
    });
  } catch (err) {
    console.error('Driver login error:', err);
    res.status(500).json({ success: false, message: 'Server error during driver login' });
  }
});

// GET /api/driver/auth/me
router.get('/auth/me', requireDriverAuth, (req, res) => {
  res.json({
    success: true,
    driver: req.driver
  });
});

// POST /api/driver/auth/change-password
router.post('/auth/change-password', requireDriverAuth, (req, res) => {
  try {
    const { currentPassword, newPassword, confirmPassword } = req.body;
    
    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Current password and new password are required'
      });
    }

    if (confirmPassword !== undefined && newPassword !== confirmPassword) {
      return res.status(400).json({
        success: false,
        message: 'New password and confirmation password do not match'
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'New password must be at least 6 characters long'
      });
    }

    const driver = db.prepare('SELECT * FROM driver_applications WHERE id = ?').get(req.driver.id);
    if (!driver) {
      return res.status(404).json({ success: false, message: 'Driver not found' });
    }

    // Verify current password
    let isCurrentValid = false;
    if (driver.password_hash) {
      isCurrentValid = bcrypt.compareSync(currentPassword, driver.password_hash);
    } else {
      const driverCleanPhone = (driver.phone || '').replace(/\D/g, '');
      const driverLast10 = driverCleanPhone.slice(-10);
      isCurrentValid = (currentPassword === 'driver123' || currentPassword === driverCleanPhone || currentPassword === driverLast10 || currentPassword === driver.phone);
    }

    if (!isCurrentValid) {
      return res.status(400).json({
        success: false,
        message: 'Incorrect current password'
      });
    }

    const salt = bcrypt.genSaltSync(10);
    const hash = bcrypt.hashSync(newPassword, salt);

    db.prepare('UPDATE driver_applications SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(hash, req.driver.id);

    return res.json({
      success: true,
      message: 'Password updated successfully'
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// =============================================================================
// 2. DRIVER PROFILE & DASHBOARD METRICS
// =============================================================================

// GET /api/driver/profile
router.get('/profile', requireDriverAuth, (req, res) => {
  try {
    const driverId = req.driver.id;

    // Live counts for this specific driver
    const totalTrips = db.prepare('SELECT COUNT(*) as c FROM contact_enquiries WHERE assigned_driver_id = ?').get(driverId).c;
    const newAssigned = db.prepare(`
      SELECT COUNT(*) as c FROM contact_enquiries 
      WHERE assigned_driver_id = ? 
        AND (assignment_status IN ('Assigned', 'Waiting for Driver Confirmation') OR driver_confirmation_status = 'Waiting for Driver Confirmation')
        AND cancelled_at IS NULL
    `).get(driverId).c;
    const acceptedCount = db.prepare("SELECT COUNT(*) as c FROM contact_enquiries WHERE assigned_driver_id = ? AND assignment_status IN ('Accepted', 'Driver Confirmed')").get(driverId).c;
    const inProgressCount = db.prepare("SELECT COUNT(*) as c FROM contact_enquiries WHERE assigned_driver_id = ? AND assignment_status = 'In Progress'").get(driverId).c;
    const completedCount = db.prepare("SELECT COUNT(*) as c FROM contact_enquiries WHERE assigned_driver_id = ? AND assignment_status = 'Completed'").get(driverId).c;
    const cancelledCount = db.prepare("SELECT COUNT(*) as c FROM contact_enquiries WHERE assigned_driver_id = ? AND (assignment_status LIKE 'Cancelled%' OR driver_confirmation_status LIKE 'Cancelled%')").get(driverId).c;

    const recentTrips = db.prepare(`
      SELECT * FROM contact_enquiries
      WHERE assigned_driver_id = ?
      ORDER BY id DESC
      LIMIT 5
    `).all(driverId);

    res.json({
      success: true,
      driver: req.driver,
      stats: {
        totalTrips,
        newAssigned,
        acceptedCount,
        inProgressCount,
        activeTrips: newAssigned + acceptedCount + inProgressCount,
        completedCount,
        cancelledCount
      },
      recentTrips
    });
  } catch (err) {
    console.error('Driver profile error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// =============================================================================
// 3. DRIVER ASSIGNED ORDERS / TRIPS
// =============================================================================

// GET /api/driver/orders
router.get('/orders', requireDriverAuth, (req, res) => {
  try {
    const driverId = req.driver.id;
    const { status, search } = req.query;

    let query = 'SELECT * FROM contact_enquiries WHERE assigned_driver_id = ?';
    const params = [driverId];

    if (status && status !== 'all') {
      if (status === 'active') {
        query += " AND assignment_status IN ('Assigned', 'Waiting for Driver Confirmation', 'Accepted', 'Driver Confirmed', 'In Progress') AND cancelled_at IS NULL";
      } else if (status === 'completed') {
        query += " AND assignment_status = 'Completed'";
      } else if (status === 'assigned' || status === 'waiting') {
        query += " AND (assignment_status IN ('Assigned', 'Waiting for Driver Confirmation') OR driver_confirmation_status = 'Waiting for Driver Confirmation') AND cancelled_at IS NULL";
      } else {
        query += ' AND assignment_status = ?';
        params.push(status);
      }
    }

    if (search) {
      query += ' AND (name LIKE ? OR phone LIKE ? OR request_code LIKE ? OR pickup_city LIKE ? OR drop_city LIKE ?)';
      const term = `%${search}%`;
      params.push(term, term, term, term, term);
    }

    query += ' ORDER BY id DESC';

    const orders = db.prepare(query).all(...params);
    res.json({ success: true, data: orders });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/driver/orders/:id
router.get('/orders/:id', requireDriverAuth, (req, res) => {
  try {
    const order = db.prepare('SELECT * FROM contact_enquiries WHERE id = ? AND assigned_driver_id = ?').get(req.params.id, req.driver.id);
    if (!order) {
      return res.status(404).json({ success: false, message: 'Trip not found or not assigned to you' });
    }
    res.json({ success: true, data: order });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PATCH /api/driver/orders/:id/status (Driver confirming trip or updating status)
router.patch('/orders/:id/status', requireDriverAuth, async (req, res) => {
  try {
    const orderId = parseInt(req.params.id, 10);
    const driverId = req.driver.id;
    let { assignmentStatus, notes } = req.body;

    const validStatuses = ['Accepted', 'Driver Confirmed', 'In Progress', 'Completed', 'Cancelled'];
    if (!assignmentStatus || !validStatuses.includes(assignmentStatus)) {
      return res.status(400).json({
        success: false,
        message: `Valid status required: ${validStatuses.join(', ')}`
      });
    }

    // Normalize 'Accepted' to 'Driver Confirmed' for standardized workflow
    const isConfirming = (assignmentStatus === 'Driver Confirmed' || assignmentStatus === 'Accepted');
    const targetStatus = isConfirming ? 'Driver Confirmed' : assignmentStatus;

    const order = db.prepare('SELECT * FROM contact_enquiries WHERE id = ? AND assigned_driver_id = ?').get(orderId, driverId);
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Assigned order not found'
      });
    }

    // If order was already cancelled or deadline expired:
    if (order.cancelled_at || order.driver_confirmation_status === 'Cancelled - Driver Did Not Confirm' || order.assignment_status.startsWith('Cancelled')) {
      return res.status(400).json({
        success: false,
        message: 'This order is no longer available. It has been cancelled.'
      });
    }

    if (isConfirming) {
      // Check confirmation deadline strictly
      if (order.driver_confirmation_deadline && new Date(order.driver_confirmation_deadline).getTime() < Date.now()) {
        return res.status(400).json({
          success: false,
          message: 'This order is no longer available. Confirmation deadline has expired.'
        });
      }

      // Atomic Update: strictly ensures order is still waiting and uncancelled
      const confirmUpdate = db.prepare(`
        UPDATE contact_enquiries SET
          assignment_status = 'Driver Confirmed',
          driver_confirmation_status = 'Driver Confirmed',
          driver_confirmed_at = CURRENT_TIMESTAMP,
          status = 'contacted',
          driver_notes = COALESCE(?, driver_notes),
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ? 
          AND assigned_driver_id = ?
          AND (driver_confirmation_status = 'Waiting for Driver Confirmation' OR driver_confirmation_status = 'Pending' OR driver_confirmation_status IS NULL)
          AND driver_confirmed_at IS NULL
          AND cancelled_at IS NULL
      `);

      const result = confirmUpdate.run(notes || null, orderId, driverId);

      if (result.changes === 0) {
        // Race condition: Timeout cancellation occurred simultaneously
        return res.status(400).json({
          success: false,
          message: 'This order is no longer available. The 5-minute confirmation window has expired.'
        });
      }

      // Successfully confirmed: cancel pending server timeout
      const { cancelConfirmationTimer } = require('../services/timer.service');
      cancelConfirmationTimer(orderId);

      const updated = db.prepare('SELECT * FROM contact_enquiries WHERE id = ?').get(orderId);
      const driver = db.prepare('SELECT * FROM driver_applications WHERE id = ?').get(driverId);

      // Send Customer Confirmation Email & Admin Confirmation Email (guarded by duplicate check)
      const { sendCustomerConfirmationEmail, sendAdminConfirmationEmail } = require('../services/email.service');
      sendCustomerConfirmationEmail(updated, driver).catch(e => console.error('Customer confirm email error:', e.message));
      sendAdminConfirmationEmail(updated, driver).catch(e => console.error('Admin confirm email error:', e.message));

      broadcastAdminEvent('enquiry:updated', updated);

      return res.json({
        success: true,
        message: 'Order successfully confirmed by driver',
        data: updated
      });
    }

    // Subsequent Transitions: 'In Progress', 'Completed', 'Cancelled'
    if (targetStatus === 'Cancelled') {
      if (!notes || notes.trim().length === 0) {
        return res.status(400).json({
          success: false,
          message: 'A reason is required to cancel an assigned trip'
        });
      }

      const cancelUpdate = db.prepare(`
        UPDATE contact_enquiries SET
          assignment_status = 'Cancelled',
          driver_confirmation_status = 'Cancelled',
          cancelled_at = CURRENT_TIMESTAMP,
          cancellation_reason = ?,
          driver_notes = ?,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND assigned_driver_id = ?
      `);

      cancelUpdate.run(notes, notes, orderId, driverId);

      const { cancelConfirmationTimer } = require('../services/timer.service');
      cancelConfirmationTimer(orderId);

      const updated = db.prepare('SELECT * FROM contact_enquiries WHERE id = ?').get(orderId);
      broadcastAdminEvent('enquiry:updated', updated);
      return res.json({
        success: true,
        message: 'Trip cancelled by driver',
        data: updated
      });
    }

    const completedAt = (targetStatus === 'Completed') ? new Date().toISOString() : order.completed_at;
    const contactStatus = (targetStatus === 'Completed') ? 'closed' : 'contacted';

    const update = db.prepare(`
      UPDATE contact_enquiries SET
        assignment_status = ?,
        status = ?,
        driver_notes = COALESCE(?, driver_notes),
        completed_at = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND assigned_driver_id = ?
    `);

    update.run(
      targetStatus,
      contactStatus,
      notes || null,
      completedAt,
      orderId,
      driverId
    );

    const updated = db.prepare('SELECT * FROM contact_enquiries WHERE id = ?').get(orderId);
    broadcastAdminEvent('enquiry:updated', updated);

    res.json({
      success: true,
      message: `Trip status updated to ${targetStatus}`,
      data: updated
    });
  } catch (err) {
    console.error('Driver order status update error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
