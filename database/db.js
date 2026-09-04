/**
 * Vandi Load - Database Connection & Migration Layer
 * Uses native node:sqlite for ultra-fast, robust, self-contained SQL operations.
 */

const { DatabaseSync } = require('node:sqlite');
const path = require('path');
const fs = require('fs');

const DB_PATH = path.join(__dirname, 'vandiload.db');

// Ensure database directory exists
if (!fs.existsSync(__dirname)) {
  fs.mkdirSync(__dirname, { recursive: true });
}

// Initialize SQLite database
const db = new DatabaseSync(DB_PATH);

// Enable WAL mode for better concurrency and foreign keys
db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA foreign_keys = ON;');

// Run schema migrations
function initSchema() {
  const schemaSql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf-8');
  db.exec(schemaSql);

  // Auto-upgrade existing contact_enquiries table columns if upgrading from earlier version
  try {
    const tableInfo = db.prepare("PRAGMA table_info(contact_enquiries)").all();
    const columnNames = tableInfo.map(col => col.name);

    if (!columnNames.includes('assigned_driver_id')) {
      db.exec("ALTER TABLE contact_enquiries ADD COLUMN assigned_driver_id INTEGER;");
    }
    if (!columnNames.includes('assigned_driver_name')) {
      db.exec("ALTER TABLE contact_enquiries ADD COLUMN assigned_driver_name TEXT;");
    }
    if (!columnNames.includes('assigned_driver_phone')) {
      db.exec("ALTER TABLE contact_enquiries ADD COLUMN assigned_driver_phone TEXT;");
    }
    if (!columnNames.includes('assigned_person')) {
      db.exec("ALTER TABLE contact_enquiries ADD COLUMN assigned_person TEXT;");
    }
    if (!columnNames.includes('assignment_status')) {
      db.exec("ALTER TABLE contact_enquiries ADD COLUMN assignment_status TEXT DEFAULT 'Pending';");
    }
    if (!columnNames.includes('assigned_at')) {
      db.exec("ALTER TABLE contact_enquiries ADD COLUMN assigned_at DATETIME;");
    }
    if (!columnNames.includes('completed_at')) {
      db.exec("ALTER TABLE contact_enquiries ADD COLUMN completed_at DATETIME;");
    }
    if (!columnNames.includes('driver_notes')) {
      db.exec("ALTER TABLE contact_enquiries ADD COLUMN driver_notes TEXT;");
    }
    if (!columnNames.includes('customer_email')) {
      db.exec("ALTER TABLE contact_enquiries ADD COLUMN customer_email TEXT;");
    }
    if (!columnNames.includes('driver_confirmation_status')) {
      db.exec("ALTER TABLE contact_enquiries ADD COLUMN driver_confirmation_status TEXT DEFAULT 'Pending';");
    }
    if (!columnNames.includes('driver_assigned_at')) {
      db.exec("ALTER TABLE contact_enquiries ADD COLUMN driver_assigned_at DATETIME;");
    }
    if (!columnNames.includes('driver_confirmed_at')) {
      db.exec("ALTER TABLE contact_enquiries ADD COLUMN driver_confirmed_at DATETIME;");
    }
    if (!columnNames.includes('driver_confirmation_deadline')) {
      db.exec("ALTER TABLE contact_enquiries ADD COLUMN driver_confirmation_deadline DATETIME;");
    }
    if (!columnNames.includes('cancelled_at')) {
      db.exec("ALTER TABLE contact_enquiries ADD COLUMN cancelled_at DATETIME;");
    }
    if (!columnNames.includes('cancellation_reason')) {
      db.exec("ALTER TABLE contact_enquiries ADD COLUMN cancellation_reason TEXT;");
    }
    if (!columnNames.includes('pickup_state')) {
      db.exec("ALTER TABLE contact_enquiries ADD COLUMN pickup_state TEXT;");
    }
    if (!columnNames.includes('pickup_district')) {
      db.exec("ALTER TABLE contact_enquiries ADD COLUMN pickup_district TEXT;");
    }
    if (!columnNames.includes('pickup_address')) {
      db.exec("ALTER TABLE contact_enquiries ADD COLUMN pickup_address TEXT;");
    }
    if (!columnNames.includes('pickup_latitude')) {
      db.exec("ALTER TABLE contact_enquiries ADD COLUMN pickup_latitude REAL;");
    }
    if (!columnNames.includes('pickup_longitude')) {
      db.exec("ALTER TABLE contact_enquiries ADD COLUMN pickup_longitude REAL;");
    }
    if (!columnNames.includes('drop_state')) {
      db.exec("ALTER TABLE contact_enquiries ADD COLUMN drop_state TEXT;");
    }
    if (!columnNames.includes('drop_district')) {
      db.exec("ALTER TABLE contact_enquiries ADD COLUMN drop_district TEXT;");
    }
    if (!columnNames.includes('drop_address')) {
      db.exec("ALTER TABLE contact_enquiries ADD COLUMN drop_address TEXT;");
    }
    if (!columnNames.includes('drop_latitude')) {
      db.exec("ALTER TABLE contact_enquiries ADD COLUMN drop_latitude REAL;");
    }
    if (!columnNames.includes('drop_longitude')) {
      db.exec("ALTER TABLE contact_enquiries ADD COLUMN drop_longitude REAL;");
    }

    // Driver applications migrations
    const driverTableInfo = db.prepare("PRAGMA table_info(driver_applications)").all();
    const driverColumnNames = driverTableInfo.map(col => col.name);

    if (!driverColumnNames.includes('state')) {
      db.exec("ALTER TABLE driver_applications ADD COLUMN state TEXT;");
    }
    if (!driverColumnNames.includes('district')) {
      db.exec("ALTER TABLE driver_applications ADD COLUMN district TEXT;");
    }

    if (!driverColumnNames.includes('password_hash')) {
      db.exec("ALTER TABLE driver_applications ADD COLUMN password_hash TEXT;");
    }
    if (!driverColumnNames.includes('email')) {
      db.exec("ALTER TABLE driver_applications ADD COLUMN email TEXT;");
    }
    if (!driverColumnNames.includes('driving_licence_doc')) {
      db.exec("ALTER TABLE driver_applications ADD COLUMN driving_licence_doc TEXT;");
    }
    if (!driverColumnNames.includes('driving_licence_original_name')) {
      db.exec("ALTER TABLE driver_applications ADD COLUMN driving_licence_original_name TEXT;");
    }
    if (!driverColumnNames.includes('driving_licence_mime_type')) {
      db.exec("ALTER TABLE driver_applications ADD COLUMN driving_licence_mime_type TEXT;");
    }
    if (!driverColumnNames.includes('aadhaar_card_doc')) {
      db.exec("ALTER TABLE driver_applications ADD COLUMN aadhaar_card_doc TEXT;");
    }
    if (!driverColumnNames.includes('aadhaar_card_original_name')) {
      db.exec("ALTER TABLE driver_applications ADD COLUMN aadhaar_card_original_name TEXT;");
    }
    if (!driverColumnNames.includes('aadhaar_card_mime_type')) {
      db.exec("ALTER TABLE driver_applications ADD COLUMN aadhaar_card_mime_type TEXT;");
    }
    if (!driverColumnNames.includes('driver_photo_doc')) {
      db.exec("ALTER TABLE driver_applications ADD COLUMN driver_photo_doc TEXT;");
    }
    if (!driverColumnNames.includes('driver_photo_original_name')) {
      db.exec("ALTER TABLE driver_applications ADD COLUMN driver_photo_original_name TEXT;");
    }
    if (!driverColumnNames.includes('driver_photo_mime_type')) {
      db.exec("ALTER TABLE driver_applications ADD COLUMN driver_photo_mime_type TEXT;");
    }
    if (!driverColumnNames.includes('address')) {
      db.exec("ALTER TABLE driver_applications ADD COLUMN address TEXT;");
    }
    if (!driverColumnNames.includes('licence_verification_status')) {
      db.exec("ALTER TABLE driver_applications ADD COLUMN licence_verification_status TEXT DEFAULT 'Pending Verification';");
    }
    if (!driverColumnNames.includes('aadhaar_verification_status')) {
      db.exec("ALTER TABLE driver_applications ADD COLUMN aadhaar_verification_status TEXT DEFAULT 'Pending Verification';");
    }
    if (!driverColumnNames.includes('photo_verification_status')) {
      db.exec("ALTER TABLE driver_applications ADD COLUMN photo_verification_status TEXT DEFAULT 'Pending Verification';");
    }

    // 1. Normalize existing phones (trim whitespace)
    db.exec("UPDATE driver_applications SET phone = TRIM(phone) WHERE phone IS NOT NULL;");

    // 2. Safely disambiguate any existing duplicate phone numbers without deleting any driver records
    const duplicatePhones = db.prepare(`
      SELECT phone, COUNT(*) as count 
      FROM driver_applications 
      WHERE phone IS NOT NULL AND phone != ''
      GROUP BY phone 
      HAVING count > 1
    `).all();

    for (const item of duplicatePhones) {
      const rows = db.prepare(`
        SELECT id, status, created_at 
        FROM driver_applications 
        WHERE phone = ? 
        ORDER BY CASE WHEN LOWER(status) = 'approved' THEN 0 ELSE 1 END, id ASC
      `).all(item.phone);

      // Keep first (oldest/approved) driver's phone intact, disambiguate any subsequent duplicate record
      for (let i = 1; i < rows.length; i++) {
        const dupDriver = rows[i];
        const disambiguatedPhone = `${item.phone}-dup-${dupDriver.id}`;
        db.prepare('UPDATE driver_applications SET phone = ? WHERE id = ?').run(disambiguatedPhone, dupDriver.id);
      }
    }

    // 3. Create UNIQUE index on driver mobile numbers
    db.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_driver_applications_phone ON driver_applications(phone);");
  } catch (err) {
    console.error('Schema column check warning:', err.message);
  }

  console.log('✔ SQLite Database schema initialized successfully at:', DB_PATH);
}

// Execute schema initialization
initSchema();

module.exports = db;
