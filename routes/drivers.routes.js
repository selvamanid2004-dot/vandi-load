/**
 * Vandi Load - Driver Applications & Registered Drivers Routes
 */

const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const db = require('../database/db');
const { requireAdminAuth } = require('../middleware/auth');
const { documentUpload, secureDocsDir, validateFileSignature } = require('../middleware/document-upload');

const { 
  sendDriverRegistrationReceivedEmail,
  sendAdminDriverRegistrationNotificationEmail
} = require('../services/email.service');
const { broadcastAdminEvent } = require('../services/realtime.service');

// POST /api/driver-applications (Public driver application submission with strong validation & duplicate prevention)
router.post('/', (req, res) => {
  const uploadHandler = documentUpload.fields([
    { name: 'driverPhoto', maxCount: 1 },
    { name: 'drivingLicence', maxCount: 1 },
    { name: 'aadhaarCard', maxCount: 1 }
  ]);

  uploadHandler(req, res, (err) => {
    if (err) {
      return res.status(400).json({
        success: false,
        message: err.message || 'File upload failed. Please ensure documents are JPG, PNG, or PDF under 10MB.'
      });
    }

    try {
      const {
        fullName,
        phone,
        email,
        state,
        district,
        address,
        location,
        vehicleType,
        vehicleNumber,
        experience,
        message
      } = req.body;

      // 1. Mandatory Text Fields
      if (!fullName || !fullName.trim()) {
        return res.status(400).json({ success: false, message: 'Driver Full Name is required.' });
      }
      if (!phone || !phone.trim()) {
        return res.status(400).json({ success: false, message: 'Mobile Number is required.' });
      }
      if (!email || !email.trim()) {
        return res.status(400).json({ success: false, message: 'Email Address is required.' });
      }
      if (!address || !address.trim()) {
        return res.status(400).json({ success: false, message: 'Address is required.' });
      }
      if (!location || !location.trim()) {
        return res.status(400).json({ success: false, message: 'City / Operating area is required.' });
      }
      if (!vehicleType || !vehicleType.trim()) {
        return res.status(400).json({ success: false, message: 'Vehicle Type is required.' });
      }
      if (!vehicleNumber || !vehicleNumber.trim()) {
        return res.status(400).json({ success: false, message: 'Vehicle Registration Number is required.' });
      }

      // 2. Mobile Number Validation (Strict 10-digit Indian Mobile Number starting with 6-9)
      const rawPhone = phone.trim();
      let digitsOnly = rawPhone.replace(/\D/g, '');
      if (digitsOnly.length === 12 && digitsOnly.startsWith('91')) {
        digitsOnly = digitsOnly.substring(2);
      }
      const indianPhoneRegex = /^[6-9]\d{9}$/;
      if (!indianPhoneRegex.test(digitsOnly)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid mobile number. Please enter a valid 10-digit Indian mobile number (e.g. 9876543210).'
        });
      }
      const cleanPhone = digitsOnly;

      // 2b. Mobile Number Uniqueness Verification (Strict Backend Duplicate Prevention)
      const existingDriver = db.prepare(`
        SELECT id, phone, full_name, status FROM driver_applications 
        WHERE phone = ? 
           OR replace(replace(replace(replace(replace(phone, ' ', ''), '-', ''), '+', ''), '(', ''), ')', '') = ?
           OR phone LIKE ?
      `).get(cleanPhone, cleanPhone, `%${cleanPhone}`);

      if (existingDriver) {
        if (req.files) {
          Object.values(req.files).flat().forEach(f => {
            if (f && f.path) {
              try { fs.unlinkSync(f.path); } catch (e) {}
            }
          });
        }
        return res.status(400).json({
          success: false,
          message: 'This mobile number is already registered. Please use another number.'
        });
      }

      // 3. Email Address Validation (RFC Standard format)
      const cleanEmail = (email || '').trim().toLowerCase();
      if (cleanEmail) {
        const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
        if (!emailRegex.test(cleanEmail)) {
          return res.status(400).json({
            success: false,
            message: 'Invalid email address format. Please enter a valid email (e.g. name@gmail.com).'
          });
        }
      }

      // 4. Mandatory Files & Signature Validation
      let photoDoc = null;
      let photoOrigName = null;
      let photoMime = null;
      let licenceDoc = null;
      let licenceOrigName = null;
      let licenceMime = null;
      let aadhaarDoc = null;
      let aadhaarOrigName = null;
      let aadhaarMime = null;

      const pFile = req.files && req.files['driverPhoto'] ? req.files['driverPhoto'][0] : null;
      const lFile = req.files && req.files['drivingLicence'] ? req.files['drivingLicence'][0] : null;
      const aFile = req.files && req.files['aadhaarCard'] ? req.files['aadhaarCard'][0] : null;

      if (!pFile) {
        return res.status(400).json({ success: false, message: 'Driver photo is required.' });
      }
      if (!lFile) {
        return res.status(400).json({ success: false, message: 'Driving licence document is required.' });
      }
      if (!aFile) {
        return res.status(400).json({ success: false, message: 'Aadhaar card document is required.' });
      }

      const pCheck = validateFileSignature(pFile.path, ['image/jpeg', 'image/png']);
      if (!pCheck.valid) {
        try { fs.unlinkSync(pFile.path); } catch (e) {}
        try { fs.unlinkSync(lFile.path); } catch (e) {}
        try { fs.unlinkSync(aFile.path); } catch (e) {}
        return res.status(400).json({ success: false, message: 'Driver Photo must be a valid JPG or PNG image file.' });
      }
      photoDoc = pFile.filename;
      photoOrigName = pFile.originalname;
      photoMime = pCheck.type || pFile.mimetype;

      const lCheck = validateFileSignature(lFile.path, ['image/jpeg', 'image/png', 'application/pdf']);
      if (!lCheck.valid) {
        try { fs.unlinkSync(lFile.path); } catch (e) {}
        try { fs.unlinkSync(aFile.path); } catch (e) {}
        return res.status(400).json({ success: false, message: 'Driving Licence must be a valid JPG, PNG, or PDF file.' });
      }
      licenceDoc = lFile.filename;
      licenceOrigName = lFile.originalname;
      licenceMime = lCheck.type || lFile.mimetype;

      const aCheck = validateFileSignature(aFile.path, ['image/jpeg', 'image/png', 'application/pdf']);
      if (!aCheck.valid) {
        try { fs.unlinkSync(aFile.path); } catch (e) {}
        return res.status(400).json({ success: false, message: 'Aadhaar Card must be a valid JPG, PNG, or PDF file.' });
      }
      aadhaarDoc = aFile.filename;
      aadhaarOrigName = aFile.originalname;
      aadhaarMime = aCheck.type || aFile.mimetype;

      // 6. Insert into database with default 'Pending Verification' document statuses
      const insert = db.prepare(`
        INSERT INTO driver_applications (
          full_name, phone, email, state, district, location, address, vehicle_type, vehicle_number,
          experience, message, status,
          driving_licence_doc, driving_licence_original_name, driving_licence_mime_type, licence_verification_status,
          aadhaar_card_doc, aadhaar_card_original_name, aadhaar_card_mime_type, aadhaar_verification_status,
          driver_photo_doc, driver_photo_original_name, driver_photo_mime_type, photo_verification_status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?, 'Pending Verification', ?, ?, ?, 'Pending Verification', ?, ?, ?, 'Pending Verification')
      `);

      const result = insert.run(
        fullName.trim(),
        cleanPhone,
        cleanEmail,
        (state || '').trim(),
        (district || '').trim(),
        location.trim(),
        address.trim(),
        vehicleType || 'other',
        vehicleNumber.trim().toUpperCase(),
        parseInt(experience, 10) || 0,
        (message || '').trim(),
        licenceDoc,
        licenceOrigName,
        licenceMime,
        aadhaarDoc,
        aadhaarOrigName,
        aadhaarMime,
        photoDoc,
        photoOrigName,
        photoMime
      );

      const driverId = result.lastInsertRowid;
      const createdDriver = db.prepare('SELECT * FROM driver_applications WHERE id = ?').get(driverId);

      // Send emails in background safely
      if (createdDriver) {
        broadcastAdminEvent('driver:new', createdDriver);
        sendDriverRegistrationReceivedEmail(createdDriver).catch(e => console.error('Driver registration email error:', e.message));
        sendAdminDriverRegistrationNotificationEmail(createdDriver).catch(e => console.error('Admin driver notification email error:', e.message));
      }

      res.json({
        success: true,
        message: 'Driver registration submitted successfully',
        id: driverId
      });
    } catch (dbErr) {
      console.error('Driver submission error:', dbErr);
      if (dbErr && dbErr.message && (dbErr.message.includes('UNIQUE') || dbErr.message.includes('phone'))) {
        return res.status(400).json({
          success: false,
          message: 'This mobile number is already registered. Please use another number.'
        });
      }
      res.status(500).json({ success: false, message: 'Failed to submit driver registration' });
    }
  });
});

// GET /api/driver-applications/admin/all (Admin list with assigned order counts)
router.get('/admin/all', requireAdminAuth, (req, res) => {
  try {
    const { status, search } = req.query;
    let query = `
      SELECT d.*, 
        (SELECT COUNT(*) FROM contact_enquiries e WHERE e.assigned_driver_id = d.id) as total_assigned_orders,
        (SELECT COUNT(*) FROM contact_enquiries e WHERE e.assigned_driver_id = d.id AND e.assignment_status IN ('Assigned', 'In Progress')) as active_orders
      FROM driver_applications d
      WHERE 1=1
    `;
    const params = [];

    if (status && status !== 'all') {
      query += ' AND LOWER(d.status) = ?';
      params.push(status.toLowerCase());
    }
    if (search) {
      query += ' AND (d.full_name LIKE ? OR d.phone LIKE ? OR d.location LIKE ? OR d.vehicle_number LIKE ? OR d.address LIKE ?)';
      const term = `%${search}%`;
      params.push(term, term, term, term, term);
    }

    query += ' ORDER BY d.id DESC';

    const rows = db.prepare(query).all(...params);
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/driver-applications/admin/:id (Get single driver profile and document metadata)
router.get('/admin/:id', requireAdminAuth, (req, res) => {
  try {
    const driver = db.prepare(`
      SELECT d.*,
        (SELECT COUNT(*) FROM contact_enquiries e WHERE e.assigned_driver_id = d.id) as total_assigned_orders,
        (SELECT COUNT(*) FROM contact_enquiries e WHERE e.assigned_driver_id = d.id AND e.assignment_status IN ('Assigned', 'In Progress')) as active_orders
      FROM driver_applications d
      WHERE d.id = ?
    `).get(req.params.id);

    if (!driver) {
      return res.status(404).json({ success: false, message: 'Driver not found' });
    }

    res.json({ success: true, data: driver });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/driver-applications/admin/:id/document/:docType (Secure Admin-only view / download)
router.get('/admin/:id/document/:docType', requireAdminAuth, (req, res) => {
  try {
    const { id, docType } = req.params;
    const isDownload = req.query.download === '1' || req.query.download === 'true';

    const driver = db.prepare('SELECT * FROM driver_applications WHERE id = ?').get(id);
    if (!driver) {
      return res.status(404).json({ success: false, message: 'Driver not found' });
    }

    let docFileName = null;
    let originalName = null;
    let mimeType = null;

    if (docType === 'licence' || docType === 'driving_licence') {
      docFileName = driver.driving_licence_doc;
      originalName = driver.driving_licence_original_name || 'driving_licence.pdf';
      mimeType = driver.driving_licence_mime_type;
    } else if (docType === 'aadhaar' || docType === 'aadhaar_card') {
      docFileName = driver.aadhaar_card_doc;
      originalName = driver.aadhaar_card_original_name || 'aadhaar_card.pdf';
      mimeType = driver.aadhaar_card_mime_type;
    } else if (docType === 'photo' || docType === 'driver_photo') {
      docFileName = driver.driver_photo_doc;
      originalName = driver.driver_photo_original_name || 'driver_photo.jpg';
      mimeType = driver.driver_photo_mime_type || 'image/jpeg';
    } else {
      return res.status(400).json({ success: false, message: 'Invalid document type. Use photo, licence, or aadhaar.' });
    }

    if (!docFileName) {
      return res.status(404).json({ success: false, message: 'Document not uploaded for this driver.' });
    }

    const filePath = path.join(secureDocsDir, path.basename(docFileName));
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ success: false, message: 'Document file not found in secure storage.' });
    }

    // Determine MIME type fallback if not stored
    if (!mimeType) {
      const ext = path.extname(docFileName).toLowerCase();
      if (ext === '.pdf') mimeType = 'application/pdf';
      else if (ext === '.png') mimeType = 'image/png';
      else mimeType = 'image/jpeg';
    }

    // Set secure response headers
    res.setHeader('Content-Type', mimeType);
    const disposition = isDownload ? 'attachment' : 'inline';
    const safeOriginalName = originalName.replace(/[^\w\.\-]/g, '_');
    res.setHeader('Content-Disposition', `${disposition}; filename="${safeOriginalName}"`);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'private, no-cache, no-store, must-revalidate');

    res.sendFile(filePath);
  } catch (err) {
    console.error('Document view error:', err);
    res.status(500).json({ success: false, message: 'Failed to retrieve secure document' });
  }
});

// GET /api/driver-applications/admin/:id/orders (Get orders assigned to a driver)
router.get('/admin/:id/orders', requireAdminAuth, (req, res) => {
  try {
    const orders = db.prepare(`
      SELECT * FROM contact_enquiries
      WHERE assigned_driver_id = ?
      ORDER BY id DESC
    `).all(req.params.id);

    res.json({ success: true, data: orders });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PUT /api/driver-applications/admin/:id (Admin: Edit Driver Details)
router.put('/admin/:id', requireAdminAuth, (req, res) => {
  try {
    const driverId = req.params.id;
    const existing = db.prepare('SELECT * FROM driver_applications WHERE id = ?').get(driverId);
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Driver not found' });
    }

    const {
      fullName,
      phone,
      email,
      address,
      state,
      district,
      location,
      vehicleType,
      vehicleNumber,
      experience,
      status,
      adminNotes,
      message
    } = req.body;

    if (!fullName || !fullName.trim()) {
      return res.status(400).json({ success: false, message: 'Driver name is required' });
    }
    if (!phone || !phone.trim()) {
      return res.status(400).json({ success: false, message: 'Mobile number is required' });
    }

    const cleanPhone = phone.trim().replace(/\D/g, '');
    const last10 = cleanPhone.length >= 10 ? cleanPhone.slice(-10) : cleanPhone;

    // Check if new phone conflicts with another driver
    const phoneConflict = db.prepare(`
      SELECT id FROM driver_applications 
      WHERE (phone = ? OR phone LIKE ?) AND id != ?
    `).get(cleanPhone, `%${last10}`, driverId);

    if (phoneConflict) {
      return res.status(400).json({
        success: false,
        message: 'This mobile number is already registered for another driver.'
      });
    }

    db.prepare(`
      UPDATE driver_applications
      SET full_name = ?,
          phone = ?,
          email = ?,
          state = COALESCE(?, state),
          district = COALESCE(?, district),
          address = ?,
          location = ?,
          vehicle_type = ?,
          vehicle_number = ?,
          experience = ?,
          status = COALESCE(?, status),
          admin_notes = COALESCE(?, admin_notes),
          message = COALESCE(?, message),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(
      fullName.trim(),
      cleanPhone || phone.trim(),
      (email || '').trim(),
      state !== undefined ? state : existing.state,
      district !== undefined ? district : existing.district,
      (address !== undefined ? address : existing.address || '').trim(),
      (location !== undefined ? location : existing.location || '').trim(),
      vehicleType || existing.vehicle_type,
      (vehicleNumber || existing.vehicle_number).trim().toUpperCase(),
      experience !== undefined ? (parseInt(experience, 10) || 0) : existing.experience,
      status || existing.status,
      adminNotes !== undefined ? adminNotes : existing.admin_notes,
      message !== undefined ? message : existing.message,
      driverId
    );

    const updated = db.prepare('SELECT * FROM driver_applications WHERE id = ?').get(driverId);
    broadcastAdminEvent('driver:updated', updated);
    res.json({
      success: true,
      message: 'Driver details updated successfully',
      data: updated
    });
  } catch (err) {
    console.error('Error editing driver:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// PATCH /api/driver-applications/admin/:id/status
router.patch('/admin/:id/status', requireAdminAuth, (req, res) => {
  try {
    const { status, adminNotes } = req.body;
    const normStatus = (status || '').toString().trim().toLowerCase();
    
    const validStatuses = ['pending', 'approved', 'rejected', 'contacted'];
    if (!normStatus || !validStatuses.includes(normStatus)) {
      return res.status(400).json({ success: false, message: 'Valid status required: Pending, Approved, or Rejected' });
    }

    db.prepare(`
      UPDATE driver_applications
      SET status = ?, admin_notes = COALESCE(?, admin_notes), updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(normStatus, adminNotes || null, req.params.id);

    const updated = db.prepare('SELECT * FROM driver_applications WHERE id = ?').get(req.params.id);
    broadcastAdminEvent('driver:updated', updated);
    res.json({ success: true, message: `Driver status updated to ${normStatus}` });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PATCH /api/driver-applications/admin/:id/doc-verification (Admin: update document verification status)
router.patch('/admin/:id/doc-verification', requireAdminAuth, (req, res) => {
  try {
    const { docType, status } = req.body;
    const normStatus = (status || '').toString().trim();
    const validStatuses = ['Pending Verification', 'Verified', 'Rejected'];

    if (!validStatuses.includes(normStatus)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid verification status. Allowed: Pending Verification, Verified, Rejected'
      });
    }

    let column = null;
    if (docType === 'licence' || docType === 'driving_licence') {
      column = 'licence_verification_status';
    } else if (docType === 'aadhaar' || docType === 'aadhaar_card') {
      column = 'aadhaar_verification_status';
    } else if (docType === 'photo' || docType === 'driver_photo') {
      column = 'photo_verification_status';
    } else {
      return res.status(400).json({ success: false, message: 'Invalid document type. Allowed: licence, aadhaar, photo' });
    }

    db.prepare(`
      UPDATE driver_applications
      SET ${column} = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(normStatus, req.params.id);

    const updated = db.prepare('SELECT * FROM driver_applications WHERE id = ?').get(req.params.id);
    broadcastAdminEvent('driver:updated', updated);
    res.json({
      success: true,
      message: `${docType} verification status updated to "${normStatus}"`,
      data: updated
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// DELETE /api/driver-applications/admin/:id
router.delete('/admin/:id', requireAdminAuth, (req, res) => {
  try {
    const driver = db.prepare('SELECT * FROM driver_applications WHERE id = ?').get(req.params.id);
    if (!driver) {
      return res.status(404).json({ success: false, message: 'Driver not found' });
    }
    
    // Unlink only active/pending unconfirmed enquiries before deleting, keeping completed/historical enquiries intact
    db.prepare(`
      UPDATE contact_enquiries
      SET assigned_driver_id = NULL, assigned_driver_name = NULL, assigned_driver_phone = NULL, assignment_status = 'Pending', driver_confirmation_status = 'Pending'
      WHERE assigned_driver_id = ? AND assignment_status IN ('Pending', 'Waiting for Driver Confirmation', 'Assigned')
    `).run(req.params.id);

    // Delete secure files if they exist
    if (driver) {
      if (driver.driver_photo_doc) {
        const p = path.join(secureDocsDir, path.basename(driver.driver_photo_doc));
        if (fs.existsSync(p)) {
          try { fs.unlinkSync(p); } catch (e) {}
        }
      }
      if (driver.driving_licence_doc) {
        const p = path.join(secureDocsDir, path.basename(driver.driving_licence_doc));
        if (fs.existsSync(p)) {
          try { fs.unlinkSync(p); } catch (e) {}
        }
      }
      if (driver.aadhaar_card_doc) {
        const p = path.join(secureDocsDir, path.basename(driver.aadhaar_card_doc));
        if (fs.existsSync(p)) {
          try { fs.unlinkSync(p); } catch (e) {}
        }
      }
    }

    db.prepare('DELETE FROM driver_applications WHERE id = ?').run(req.params.id);
    broadcastAdminEvent('driver:deleted', { id: req.params.id });
    res.json({ success: true, message: 'Driver removed successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;

