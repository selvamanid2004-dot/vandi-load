-- Vandi Load Relational Database Schema (SQLite)

-- 1. Admins Table
CREATE TABLE IF NOT EXISTS admins (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  full_name TEXT,
  role TEXT DEFAULT 'superadmin',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 2. Vehicle Categories Table
CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY, -- slug e.g. 'pickup', 'medium', 'heavy', 'special'
  name TEXT NOT NULL,
  description TEXT,
  image TEXT,
  capacity_info TEXT,
  display_order INTEGER DEFAULT 0,
  status TEXT DEFAULT 'active', -- 'active', 'inactive'
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 3. Vehicles Table
CREATE TABLE IF NOT EXISTS vehicles (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL, -- references categories(id)
  capacity_kg TEXT NOT NULL,
  capacity_boxes TEXT NOT NULL,
  bed_size TEXT NOT NULL,
  badge TEXT,
  best_for TEXT, -- JSON array string
  description TEXT,
  image TEXT NOT NULL,
  display_order INTEGER DEFAULT 0,
  status TEXT DEFAULT 'active', -- 'active', 'inactive'
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 4. Gallery Table
CREATE TABLE IF NOT EXISTS gallery (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  category TEXT DEFAULT 'all',
  image_url TEXT NOT NULL,
  display_order INTEGER DEFAULT 0,
  status TEXT DEFAULT 'active',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 5. Contact Enquiries / Customer Load Requests Table
CREATE TABLE IF NOT EXISTS contact_enquiries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  request_code TEXT UNIQUE,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  customer_email TEXT,
  subject TEXT,
  message TEXT,
  pickup_city TEXT,
  pickup_state TEXT,
  pickup_district TEXT,
  pickup_address TEXT,
  pickup_latitude REAL,
  pickup_longitude REAL,
  drop_city TEXT,
  drop_state TEXT,
  drop_district TEXT,
  drop_address TEXT,
  drop_latitude REAL,
  drop_longitude REAL,
  goods_category TEXT,
  quantity TEXT,
  vehicle_preferred TEXT,
  status TEXT DEFAULT 'new', -- 'new', 'contacted', 'closed'
  assigned_driver_id INTEGER,
  assigned_driver_name TEXT,
  assigned_driver_phone TEXT,
  assigned_person TEXT,
  assignment_status TEXT DEFAULT 'Pending', -- 'Pending', 'Waiting for Driver Confirmation', 'Driver Confirmed', 'In Progress', 'Completed', 'Cancelled', 'Cancelled - Driver Did Not Confirm'
  driver_confirmation_status TEXT DEFAULT 'Pending', -- 'Pending', 'Waiting for Driver Confirmation', 'Driver Confirmed', 'Cancelled - Driver Did Not Confirm'
  driver_assigned_at DATETIME,
  driver_confirmed_at DATETIME,
  driver_confirmation_deadline DATETIME,
  cancelled_at DATETIME,
  cancellation_reason TEXT,
  admin_notes TEXT,
  driver_notes TEXT,
  assigned_at DATETIME,
  completed_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 6. Driver Applications Table
CREATE TABLE IF NOT EXISTS driver_applications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  full_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT,
  state TEXT,
  district TEXT,
  location TEXT NOT NULL,
  address TEXT,
  vehicle_type TEXT NOT NULL,
  vehicle_number TEXT NOT NULL,
  experience INTEGER DEFAULT 0,
  message TEXT,
  status TEXT DEFAULT 'pending', -- 'pending', 'contacted', 'approved', 'rejected'
  admin_notes TEXT,
  password_hash TEXT,
  driving_licence_doc TEXT,
  driving_licence_original_name TEXT,
  driving_licence_mime_type TEXT,
  licence_verification_status TEXT DEFAULT 'Pending Verification',
  aadhaar_card_doc TEXT,
  aadhaar_card_original_name TEXT,
  aadhaar_card_mime_type TEXT,
  aadhaar_verification_status TEXT DEFAULT 'Pending Verification',
  driver_photo_doc TEXT,
  driver_photo_original_name TEXT,
  driver_photo_mime_type TEXT,
  photo_verification_status TEXT DEFAULT 'Pending Verification',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 7. Website Content Table
CREATE TABLE IF NOT EXISTS website_content (
  section_key TEXT PRIMARY KEY,
  content_json TEXT NOT NULL,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 8. Settings Table
CREATE TABLE IF NOT EXISTS settings (
  setting_key TEXT PRIMARY KEY,
  setting_value TEXT NOT NULL,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 9. Order Email Logs Table (Duplicate Prevention & Audit)
CREATE TABLE IF NOT EXISTS order_email_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL,
  event_type TEXT NOT NULL, -- 'driver_assigned', 'driver_confirmed_customer', 'driver_confirmed_admin', 'driver_timeout_cancelled_admin'
  recipient_email TEXT NOT NULL,
  status TEXT NOT NULL, -- 'sent', 'simulated', 'failed'
  details TEXT,
  sent_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(order_id, event_type)
);
