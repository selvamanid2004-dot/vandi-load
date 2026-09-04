/**
 * Vandi Load - Authentication Middleware
 * Validates JWT tokens and secures protected admin & driver routes.
 */

const jwt = require('jsonwebtoken');
const db = require('../database/db');

const JWT_SECRET = process.env.JWT_SECRET || 'vandi-load-super-secret-key-2026';

function requireAdminAuth(req, res, next) {
  try {
    const authHeader = req.headers['authorization'];
    let token = null;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    } else if (req.query && req.query.token) {
      token = req.query.token;
    } else if (req.cookies && req.cookies.admin_token) {
      token = req.cookies.admin_token;
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized: Admin authentication token required'
      });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    if (decoded.role === 'driver') {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: Drivers cannot access admin endpoints'
      });
    }

    req.admin = decoded;
    next();
  } catch (err) {
    return res.status(401).json({
      success: false,
      message: 'Unauthorized: Invalid or expired admin token'
    });
  }
}

function requireDriverAuth(req, res, next) {
  try {
    const authHeader = req.headers['authorization'];
    let token = null;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    } else if (req.query && req.query.token) {
      token = req.query.token;
    } else if (req.cookies && req.cookies.driver_token) {
      token = req.cookies.driver_token;
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized: Driver authentication token required'
      });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    if (decoded.role !== 'driver') {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: Driver access only'
      });
    }

    // Verify driver exists and is active/approved
    const driver = db.prepare('SELECT id, full_name, phone, location, vehicle_type, vehicle_number, experience, status FROM driver_applications WHERE id = ?').get(decoded.id);
    if (!driver || (driver.status || '').toLowerCase() !== 'approved') {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized: Driver account is inactive, pending approval, or no longer exists'
      });
    }

    req.driver = driver;
    next();
  } catch (err) {
    return res.status(401).json({
      success: false,
      message: 'Unauthorized: Invalid or expired driver token'
    });
  }
}

module.exports = {
  requireAdminAuth,
  requireDriverAuth,
  JWT_SECRET
};
