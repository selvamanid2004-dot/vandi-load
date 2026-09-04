/**
 * Vandi Load - Express Application Server
 * Serves the Customer Frontend, Admin Panel, and REST APIs.
 */

require('dotenv').config();

const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

// Initialize database & seeder
const db = require('./database/db');
const seedDatabase = require('./database/seed');
seedDatabase();

// Initialize 5-Minute Confirmation Timer & Auto-Cancellation Service
const { initTimerService } = require('./services/timer.service');
initTimerService();

const app = express();
const PORT = process.env.PORT || 3000;

// Global Middleware
const rawAllowedOrigins = process.env.ALLOWED_ORIGINS;
const allowedOrigins = rawAllowedOrigins
  ? rawAllowedOrigins.split(',').map(origin => origin.trim()).filter(Boolean)
  : null;

const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (e.g. same-origin browser fetches, server-to-server, curl)
    // If ALLOWED_ORIGINS is not configured, or contains '*', allow all (local dev default)
    if (!origin || !allowedOrigins || allowedOrigins.includes('*') || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(null, false);
  },
  credentials: true
};

app.use(cors(corsOptions));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Static File Serving
app.use('/assets', express.static(path.join(__dirname, 'assets')));
app.use('/css', express.static(path.join(__dirname, 'css')));
app.use('/js', express.static(path.join(__dirname, 'js')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/admin', express.static(path.join(__dirname, 'admin')));

// Alias static routes for relative paths inside /admin/
app.use('/admin/assets', express.static(path.join(__dirname, 'assets')));
app.use('/admin/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/admin/css', express.static(path.join(__dirname, 'css')));
app.use('/admin/js', express.static(path.join(__dirname, 'js')));

// Real-time Event Stream for Admin Portal
const { handleAdminSSE } = require('./services/realtime.service');
const { requireAdminAuth } = require('./middleware/auth');
app.get('/api/admin/events', requireAdminAuth, handleAdminSSE);

// API Routes
app.use('/api/auth', require('./routes/auth.routes'));
app.use('/api/driver', require('./routes/driver-portal.routes'));
app.use('/api/categories', require('./routes/categories.routes'));
app.use('/api/vehicles', require('./routes/vehicles.routes'));
app.use('/api/gallery', require('./routes/gallery.routes'));
app.use('/api/enquiries', require('./routes/enquiries.routes'));
app.use('/api/driver-applications', require('./routes/drivers.routes'));
app.use('/api/content', require('./routes/content.routes'));
app.use('/api/settings', require('./routes/settings.routes'));
app.use('/api/admin/stats', require('./routes/stats.routes'));
app.use('/api/upload', require('./routes/upload.routes'));

// Driver Portal Static Serving
app.use('/driver', express.static(path.join(__dirname, 'driver')));

// Driver routes
app.get('/driver', (req, res) => {
  res.sendFile(path.join(__dirname, 'driver', 'index.html'));
});

app.get('/driver/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'driver', 'login.html'));
});

// Admin root route
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'admin', 'index.html'));
});

// Admin login route
app.get('/admin/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'admin', 'login.html'));
});

// Public Customer Website route
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/index.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Fallback for SPA routing - only for non-file document requests
app.get('*', (req, res) => {
  // If request has a file extension (.jpg, .png, .js, .css, etc.), return 404 instead of HTML
  if (path.extname(req.path)) {
    return res.status(404).send('File Not Found');
  }

  if (req.path.startsWith('/driver')) {
    res.sendFile(path.join(__dirname, 'driver', 'index.html'));
  } else if (req.path.startsWith('/admin')) {
    res.sendFile(path.join(__dirname, 'admin', 'index.html'));
  } else {
    res.sendFile(path.join(__dirname, 'index.html'));
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({
    success: false,
    message: err.message || 'Internal Server Error'
  });
});

// Start Server
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`====================================================`);
    console.log(`🚀 Vandi Load Server running on http://localhost:${PORT}`);
    console.log(`🌐 Public Website: http://localhost:${PORT}`);
    console.log(`🛡️  Admin Panel:    http://localhost:${PORT}/admin`);
    console.log(`====================================================`);
  });
}

module.exports = app;
