/**
 * Vandi Load - Enquiries & Vehicle Requests Routes
 * Includes driver assignment, order tracking, status workflows, and filtered reporting.
 */

const express = require('express');
const router = express.Router();
const db = require('../database/db');
const { requireAdminAuth } = require('../middleware/auth');
const { 
  sendDriverAssignmentEmail,
  sendCustomerEnquiryReceivedEmail,
  sendAdminEnquiryNotificationEmail
} = require('../services/email.service');
const { startConfirmationTimer, cancelConfirmationTimer } = require('../services/timer.service');
const { broadcastAdminEvent } = require('../services/realtime.service');

// POST /api/enquiries (Public customer form submission)
router.post('/', (req, res) => {
  try {
    const {
      name,
      phone,
      email,
      customerEmail,
      subject,
      message,
      pickupCity,
      pickupState,
      pickupDistrict,
      pickupAddress,
      pickupLatitude,
      pickupLongitude,
      dropCity,
      dropState,
      dropDistrict,
      dropAddress,
      dropLatitude,
      dropLongitude,
      deliveryLatitude,
      deliveryLongitude,
      deliveryAddress,
      goodsCategory,
      quantity,
      vehiclePreferred
    } = req.body;

    if (!name || !phone) {
      return res.status(400).json({
        success: false,
        message: 'Name and phone number are required'
      });
    }

    const requestCode = 'VL-' + Math.floor(100000 + Math.random() * 900000);
    const finalEmail = customerEmail || email || '';

    // Parse latitude and longitude safely as numbers or null
    const lat = (pickupLatitude !== undefined && pickupLatitude !== null && pickupLatitude !== '') ? parseFloat(pickupLatitude) : null;
    const lng = (pickupLongitude !== undefined && pickupLongitude !== null && pickupLongitude !== '') ? parseFloat(pickupLongitude) : null;

    const rawDropLat = (dropLatitude !== undefined && dropLatitude !== null && dropLatitude !== '') ? dropLatitude : deliveryLatitude;
    const rawDropLng = (dropLongitude !== undefined && dropLongitude !== null && dropLongitude !== '') ? dropLongitude : deliveryLongitude;
    const dLat = (rawDropLat !== undefined && rawDropLat !== null && rawDropLat !== '') ? parseFloat(rawDropLat) : null;
    const dLng = (rawDropLng !== undefined && rawDropLng !== null && rawDropLng !== '') ? parseFloat(rawDropLng) : null;
    const finalDropAddress = dropAddress || deliveryAddress || '';

    const insert = db.prepare(`
      INSERT INTO contact_enquiries (
        request_code, name, phone, customer_email, subject, message,
        pickup_city, pickup_state, pickup_district, pickup_address, pickup_latitude, pickup_longitude,
        drop_city, drop_state, drop_district, drop_address, drop_latitude, drop_longitude,
        goods_category, quantity,
        vehicle_preferred, status, assignment_status, driver_confirmation_status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'new', 'Pending', 'Pending')
    `);

    const result = insert.run(
      requestCode,
      name,
      phone,
      finalEmail,
      subject || 'Vehicle Load Request',
      message || '',
      pickupCity || '',
      pickupState || '',
      pickupDistrict || '',
      pickupAddress || '',
      lat,
      lng,
      dropCity || '',
      dropState || '',
      dropDistrict || '',
      finalDropAddress,
      dLat,
      dLng,
      goodsCategory || '',
      quantity || '',
      vehiclePreferred || ''
    );

    const enquiryId = result.lastInsertRowid;
    const createdEnquiry = db.prepare('SELECT * FROM contact_enquiries WHERE id = ?').get(enquiryId);

    // Broadcast real-time event to all connected Admin Panels immediately
    if (createdEnquiry) {
      broadcastAdminEvent('enquiry:new', createdEnquiry);
    }

    // Send emails in background safely
    if (createdEnquiry) {
      sendCustomerEnquiryReceivedEmail(createdEnquiry).catch(err => console.error('Customer enquiry email error:', err.message));
      sendAdminEnquiryNotificationEmail(createdEnquiry).catch(err => console.error('Admin enquiry email error:', err.message));
    }

    res.json({
      success: true,
      message: 'Request received successfully',
      requestCode,
      id: enquiryId
    });
  } catch (err) {
    console.error('Enquiry submission error:', err);
    res.status(500).json({ success: false, message: 'Failed to submit enquiry' });
  }
});

// GET /api/enquiries/admin/all (Admin list with multi-parameter filtering)
router.get('/admin/all', requireAdminAuth, (req, res) => {
  try {
    const { status, assignmentStatus, driverId, search, dateFrom, dateTo } = req.query;
    let query = 'SELECT * FROM contact_enquiries WHERE 1=1';
    const params = [];

    if (status && status !== 'all') {
      query += ' AND status = ?';
      params.push(status);
    }
    if (assignmentStatus && assignmentStatus !== 'all') {
      query += ' AND assignment_status = ?';
      params.push(assignmentStatus);
    }
    if (driverId && driverId !== 'all') {
      query += ' AND assigned_driver_id = ?';
      params.push(driverId);
    }
    if (dateFrom) {
      query += ' AND date(created_at) >= date(?)';
      params.push(dateFrom);
    }
    if (dateTo) {
      query += ' AND date(created_at) <= date(?)';
      params.push(dateTo);
    }
    if (search) {
      query += ' AND (name LIKE ? OR phone LIKE ? OR request_code LIKE ? OR pickup_city LIKE ? OR drop_city LIKE ? OR assigned_driver_name LIKE ?)';
      const term = `%${search}%`;
      params.push(term, term, term, term, term, term);
    }

    query += ' ORDER BY id DESC';

    const rows = db.prepare(query).all(...params);
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/enquiries/admin/:id (Admin get single enquiry with location details)
router.get('/admin/:id', requireAdminAuth, (req, res) => {
  try {
    const enquiryId = parseInt(req.params.id, 10);
    const row = db.prepare('SELECT * FROM contact_enquiries WHERE id = ?').get(enquiryId);
    if (!row) {
      return res.status(404).json({ success: false, message: 'Enquiry not found' });
    }
    res.json({ success: true, data: row });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PATCH /api/enquiries/admin/:id/assign (Assign driver / person & start 5-minute confirmation workflow)
router.patch('/admin/:id/assign', requireAdminAuth, async (req, res) => {
  try {
    const enquiryId = parseInt(req.params.id, 10);
    const { driverId, driverName, driverPhone, assignedPerson, assignmentStatus, adminNotes } = req.body;

    const existing = db.prepare('SELECT * FROM contact_enquiries WHERE id = ?').get(enquiryId);
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Enquiry not found' });
    }

    let finalDriverName = driverName;
    let finalDriverPhone = driverPhone;
    let driverObj = null;

    // Lookup driver details if driverId passed
    if (driverId) {
      driverObj = db.prepare('SELECT * FROM driver_applications WHERE id = ?').get(driverId);
      if (driverObj) {
        finalDriverName = driverObj.full_name;
        finalDriverPhone = driverObj.phone;
      }
    }

    const isAssigningDriver = !!driverId;
    const nowIso = new Date().toISOString();
    const deadlineIso = new Date(Date.now() + 5 * 60 * 1000).toISOString();

    let newAssignmentStatus = assignmentStatus;
    let newDriverConfirmationStatus = existing.driver_confirmation_status || 'Pending';
    let assignedAt = existing.assigned_at;
    let driverAssignedAt = existing.driver_assigned_at;
    let driverConfirmationDeadline = existing.driver_confirmation_deadline;
    let driverConfirmedAt = existing.driver_confirmed_at;
    let cancelledAt = existing.cancelled_at;
    let cancellationReason = existing.cancellation_reason;

    if (isAssigningDriver) {
      // Driver assignment triggered
      newAssignmentStatus = (assignmentStatus && assignmentStatus !== 'Assigned' && assignmentStatus !== 'Pending') 
        ? assignmentStatus 
        : 'Waiting for Driver Confirmation';
      newDriverConfirmationStatus = 'Waiting for Driver Confirmation';
      assignedAt = nowIso;
      driverAssignedAt = nowIso;
      driverConfirmationDeadline = deadlineIso;
      driverConfirmedAt = null;
      cancelledAt = null;
      cancellationReason = null;
    } else if (assignmentStatus) {
      newAssignmentStatus = assignmentStatus;
      if (assignmentStatus === 'Completed') {
        newDriverConfirmationStatus = 'Completed';
      } else if (assignmentStatus === 'Cancelled') {
        newDriverConfirmationStatus = 'Cancelled';
        cancelledAt = nowIso;
      }
    }

    const completedAt = (newAssignmentStatus === 'Completed') ? nowIso : existing.completed_at;

    const update = db.prepare(`
      UPDATE contact_enquiries SET
        assigned_driver_id = ?,
        assigned_driver_name = ?,
        assigned_driver_phone = ?,
        assigned_person = ?,
        assignment_status = ?,
        driver_confirmation_status = ?,
        driver_assigned_at = ?,
        driver_confirmed_at = ?,
        driver_confirmation_deadline = ?,
        cancelled_at = ?,
        cancellation_reason = ?,
        status = CASE WHEN ? = 'Completed' THEN 'closed' ELSE 'contacted' END,
        admin_notes = COALESCE(?, admin_notes),
        assigned_at = ?,
        completed_at = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);

    update.run(
      driverId || null,
      finalDriverName || null,
      finalDriverPhone || null,
      assignedPerson || null,
      newAssignmentStatus,
      newDriverConfirmationStatus,
      driverAssignedAt,
      driverConfirmedAt,
      driverConfirmationDeadline,
      cancelledAt,
      cancellationReason,
      newAssignmentStatus,
      adminNotes || null,
      assignedAt,
      completedAt,
      enquiryId
    );

    const updated = db.prepare('SELECT * FROM contact_enquiries WHERE id = ?').get(enquiryId);

    // Broadcast update to all connected Admin Panels
    if (updated) {
      broadcastAdminEvent('enquiry:updated', updated);
    }

    // If assigned to a driver and waiting for confirmation: start 5-minute server timer and send Driver Email
    if (isAssigningDriver && newDriverConfirmationStatus === 'Waiting for Driver Confirmation') {
      startConfirmationTimer(enquiryId);
      if (driverObj) {
        // Send email in background without blocking API response
        sendDriverAssignmentEmail(updated, driverObj).catch(e => console.error('Driver assign email error:', e.message));
      }
    } else if (newDriverConfirmationStatus !== 'Waiting for Driver Confirmation') {
      cancelConfirmationTimer(enquiryId);
    }

    res.json({
      success: true,
      message: isAssigningDriver ? `Assigned to ${finalDriverName} (Waiting for Driver Confirmation)` : `Order status updated to ${newAssignmentStatus}`,
      data: updated
    });
  } catch (err) {
    console.error('Assign error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// PATCH /api/enquiries/admin/:id/status
router.patch('/admin/:id/status', requireAdminAuth, (req, res) => {
  try {
    const { status, adminNotes } = req.body;
    if (!status || !['new', 'contacted', 'closed'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Valid status required (new, contacted, closed)' });
    }

    db.prepare(`
      UPDATE contact_enquiries 
      SET status = ?, admin_notes = COALESCE(?, admin_notes), updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(status, adminNotes || null, req.params.id);

    const updated = db.prepare('SELECT * FROM contact_enquiries WHERE id = ?').get(req.params.id);
    if (updated) {
      broadcastAdminEvent('enquiry:updated', updated);
    }

    res.json({ success: true, message: `Enquiry status updated to ${status}` });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// DELETE /api/enquiries/admin/:id
router.delete('/admin/:id', requireAdminAuth, (req, res) => {
  try {
    const enquiryId = parseInt(req.params.id, 10);
    db.prepare('DELETE FROM contact_enquiries WHERE id = ?').run(enquiryId);
    broadcastAdminEvent('enquiry:deleted', { id: enquiryId });
    res.json({ success: true, message: 'Enquiry deleted successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
