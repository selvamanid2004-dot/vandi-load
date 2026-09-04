/**
 * Vandi Load - Email Notification Service
 * Handles transactional emails for Driver Assignment, Customer Confirmation,
 * Admin Confirmation, and Automatic 5-minute Timeout Cancellation.
 * 
 * Includes:
 * - SMTP configuration via environment variables
 * - Safe simulated logging fallback if SMTP credentials are missing
 * - Database-backed duplicate email prevention (order_email_logs)
 * - Safe error handling (never crashes backend or breaks order state)
 */

const nodemailer = require('nodemailer');
const db = require('../database/db');

// SMTP Configuration from Environment Variables
const EMAIL_HOST = process.env.EMAIL_HOST || '';
const EMAIL_PORT = parseInt(process.env.EMAIL_PORT, 10) || 587;
const EMAIL_SECURE = process.env.EMAIL_SECURE === 'true' || EMAIL_PORT === 465;
const EMAIL_USER = process.env.EMAIL_USER || '';
const EMAIL_PASSWORD = process.env.EMAIL_PASSWORD || '';
const EMAIL_FROM = process.env.EMAIL_FROM || (EMAIL_USER ? `"Vandi Load Logistics" <${EMAIL_USER}>` : '"Vandi Load Logistics" <notifications@vandiload.com>');

// Base Application URL for links in email notifications (defaults to safe local development)
const APP_URL = (process.env.APP_URL || 'http://localhost:3000').replace(/\/+$/, '');

/**
 * Get current configured Admin Email from Database Settings or fallback to ENV/default
 */
function getAdminEmail() {
  try {
    const setting = db.prepare("SELECT setting_value FROM settings WHERE setting_key = 'email'").get();
    if (setting && setting.setting_value && setting.setting_value.trim()) {
      return setting.setting_value.trim();
    }
  } catch (err) {
    console.error('Error fetching admin email from settings:', err.message);
  }
  return process.env.ADMIN_EMAIL || process.env.EMAIL_USER || 'admin@vandiload.com';
}

// Setup Nodemailer Transporter if credentials provided
let transporter = null;
if (EMAIL_HOST && EMAIL_USER && EMAIL_PASSWORD) {
  try {
    transporter = nodemailer.createTransport({
      host: EMAIL_HOST,
      port: EMAIL_PORT,
      secure: EMAIL_SECURE,
      auth: {
        user: EMAIL_USER,
        pass: EMAIL_PASSWORD
      }
    });
    console.log(`✔ Email service configured with SMTP host: ${EMAIL_HOST}:${EMAIL_PORT}`);
  } catch (err) {
    console.error('Failed to initialize SMTP transporter:', err.message);
  }
} else {
  console.log('ℹ Email service running in simulation/log mode (Configure EMAIL_HOST, EMAIL_USER, EMAIL_PASSWORD in .env for live SMTP delivery)');
}

/**
 * Check if an email event was already sent for this order
 */
function isEmailAlreadySent(orderId, eventType) {
  if (!orderId) return false;
  try {
    const existing = db.prepare('SELECT id FROM order_email_logs WHERE order_id = ? AND event_type = ?').get(orderId, eventType);
    return !!existing;
  } catch (err) {
    console.error('Error checking email logs:', err.message);
    return false;
  }
}

/**
 * Record sent email in the database
 */
function recordEmailSent(orderId, eventType, recipientEmail, status, details = '') {
  if (!orderId) return;
  try {
    const insert = db.prepare(`
      INSERT OR REPLACE INTO order_email_logs (order_id, event_type, recipient_email, status, details, sent_at)
      VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `);
    insert.run(orderId, eventType, recipientEmail, status, details);
  } catch (err) {
    console.error('Error recording email log:', err.message);
  }
}

/**
 * Send email helper with fallback and duplicate prevention
 */
async function sendEmail({ orderId, eventType, to, subject, html, text }) {
  if (!to) {
    console.warn(`[Email Service] Skipped '${eventType}' for Order #${orderId}: No recipient email provided.`);
    return { success: false, reason: 'no_recipient' };
  }

  // Duplicate email prevention
  if (orderId && eventType && isEmailAlreadySent(orderId, eventType)) {
    console.log(`[Email Service] Prevented duplicate email '${eventType}' for Order #${orderId}`);
    return { success: true, duplicated: true };
  }

  try {
    if (transporter) {
      const info = await transporter.sendMail({
        from: EMAIL_FROM,
        to,
        subject,
        text,
        html
      });
      console.log(`✔ [Email Sent] Event: ${eventType} | Order: #${orderId} | To: ${to} | MessageId: ${info.messageId}`);
      if (orderId && eventType) {
        recordEmailSent(orderId, eventType, to, 'sent', `MessageId: ${info.messageId}`);
      }
      return { success: true, messageId: info.messageId };
    } else {
      // Simulation / Log Mode
      console.log(`\n=======================================================`);
      console.log(`📧 [EMAIL SIMULATION] Event: ${eventType} | Order: #${orderId}`);
      console.log(`To: ${to}`);
      console.log(`Subject: ${subject}`);
      console.log(`Text:\n${text}`);
      console.log(`=======================================================\n`);
      if (orderId && eventType) {
        recordEmailSent(orderId, eventType, to, 'simulated', 'Console logged (SMTP not configured)');
      }
      return { success: true, simulated: true };
    }
  } catch (err) {
    console.error(`❌ [Email Failed] Event: ${eventType} | Order: #${orderId} | To: ${to} | Error:`, err.message);
    if (orderId && eventType) {
      recordEmailSent(orderId, eventType, to, 'failed', err.message);
    }
    return { success: false, error: err.message };
  }
}

// =============================================================================
// EMAIL EVENT HANDLERS
// =============================================================================

/**
 * EVENT 1: Admin assigns driver -> Driver email ONLY
 */
async function sendDriverAssignmentEmail(order, driver) {
  if (!order || !driver) return;

  const recipientEmail = driver.email || `${driver.phone}@driver.vandiload.com`;
  const orderRef = order.request_code || `#${order.id}`;
  const deadlineStr = order.driver_confirmation_deadline 
    ? new Date(order.driver_confirmation_deadline).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
    : 'within 5 minutes';

  const subject = `🚚 New Load Assigned: ${orderRef} - Please Confirm within 5 Minutes | Vandi Load`;

  const text = `
Hello ${driver.full_name},

A new load request (${orderRef}) has been assigned to you on Vandi Load.

TRIP DETAILS:
- Order Reference: ${orderRef}
- Customer Name: ${order.name}
- Pickup Location: ${order.pickup_city || 'Not specified'}
- Drop Location: ${order.drop_city || 'Not specified'}
- Goods / Cargo: ${order.quantity || ''} ${order.goods_category || 'General Freight'}
- Vehicle Preferred: ${order.vehicle_preferred || driver.vehicle_type || 'Assigned Vehicle'}
- Assignment Time: ${new Date(order.driver_assigned_at || Date.now()).toLocaleString('en-IN')}
- Confirmation Deadline: ${deadlineStr} (Strict 5-minute window)

ACTION REQUIRED:
Please open your Vandi Load Driver Portal immediately and click "Confirm Order" to accept this load.
If not confirmed within 5 minutes, this order will be automatically cancelled.

Driver Portal Login: ${APP_URL}/driver/login

Best regards,
Vandi Load Logistics Team
  `.trim();

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #0f172a; color: #f8fafc; border-radius: 8px; overflow: hidden; border: 1px solid #334155;">
      <div style="background: #e5a83b; color: #0f172a; padding: 20px; text-align: center;">
        <h1 style="margin: 0; font-size: 24px; font-weight: bold;">VANDI LOAD</h1>
        <p style="margin: 5px 0 0 0; font-size: 14px; font-weight: 600;">NEW LOAD ASSIGNMENT NOTIFICATION</p>
      </div>
      <div style="padding: 24px;">
        <p style="font-size: 16px; margin-top: 0;">Hello <strong>${driver.full_name}</strong>,</p>
        <p style="font-size: 15px; color: #cbd5e1;">A new load trip has been assigned to your vehicle.</p>
        
        <div style="background: #1e293b; border-left: 4px solid #e5a83b; padding: 16px; border-radius: 6px; margin: 20px 0;">
          <h3 style="margin: 0 0 12px 0; color: #e5a83b; font-size: 16px;">Trip Summary (${orderRef})</h3>
          <p style="margin: 6px 0; font-size: 14px;"><strong>Pickup:</strong> ${order.pickup_city || 'Not specified'}</p>
          <p style="margin: 6px 0; font-size: 14px;"><strong>Drop:</strong> ${order.drop_city || 'Not specified'}</p>
          <p style="margin: 6px 0; font-size: 14px;"><strong>Cargo:</strong> ${order.quantity || ''} ${order.goods_category || 'General Freight'}</p>
          <p style="margin: 6px 0; font-size: 14px;"><strong>Customer:</strong> ${order.name}</p>
          <p style="margin: 6px 0; font-size: 14px;"><strong>Confirmation Deadline:</strong> <span style="color: #ef4444; font-weight: bold;">${deadlineStr} (5 Minutes)</span></p>
        </div>

        <div style="background: rgba(239, 68, 68, 0.1); border: 1px solid #ef4444; padding: 14px; border-radius: 6px; margin-bottom: 20px;">
          <p style="margin: 0; font-size: 14px; color: #fca5a5; font-weight: 600;">
            ⚠️ You have 5 minutes to confirm this order. If you do not accept within 5 minutes, the order will be automatically cancelled.
          </p>
        </div>

        <div style="text-align: center; margin: 25px 0;">
          <a href="${APP_URL}/driver" style="background: #e5a83b; color: #0f172a; padding: 12px 28px; text-decoration: none; font-weight: bold; border-radius: 6px; display: inline-block; font-size: 16px;">Open Driver Portal to Confirm</a>
        </div>
      </div>
      <div style="background: #020617; padding: 14px; text-align: center; font-size: 12px; color: #64748b;">
        Vandi Load Logistics • Safe & Reliable Freight Transport
      </div>
    </div>
  `;

  return sendEmail({
    orderId: order.id,
    eventType: 'driver_assigned',
    to: recipientEmail,
    subject,
    text,
    html
  });
}

/**
 * EVENT 2 (Customer): Driver confirms order -> Customer email
 */
async function sendCustomerConfirmationEmail(order, driver) {
  if (!order) return;

  const recipientEmail = order.customer_email || `${order.phone.replace(/[^0-9]/g, '')}@customer.vandiload.com`;
  const orderRef = order.request_code || `#${order.id}`;

  const subject = `✅ Driver Confirmed Your Vandi Load Request (${orderRef})`;

  const text = `
Dear ${order.name},

Great news! Your transport booking with Vandi Load has been confirmed by our assigned driver.

BOOKING DETAILS:
- Request Reference: ${orderRef}
- Status: Driver Confirmed
- Assigned Driver: ${driver?.full_name || order.assigned_driver_name || 'Vandi Load Driver'}
- Driver Contact: ${driver?.phone || order.assigned_driver_phone || 'Available on request'}
- Vehicle Type: ${order.vehicle_preferred || driver?.vehicle_type || 'Commercial Vehicle'}
- Pickup Location: ${order.pickup_city || 'Not specified'}
- Drop Location: ${order.drop_city || 'Not specified'}
- Cargo: ${order.quantity || ''} ${order.goods_category || ''}
- Confirmed At: ${new Date(order.driver_confirmed_at || Date.now()).toLocaleString('en-IN')}

Our driver will contact you shortly regarding the pickup schedule.
If you have any questions or require assistance, please feel free to reach out to our team.

Thank you for choosing Vandi Load!
Vandi Load Logistics Team
  `.trim();

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #0f172a; color: #f8fafc; border-radius: 8px; overflow: hidden; border: 1px solid #334155;">
      <div style="background: #10b981; color: #ffffff; padding: 20px; text-align: center;">
        <h1 style="margin: 0; font-size: 24px; font-weight: bold;">VANDI LOAD</h1>
        <p style="margin: 5px 0 0 0; font-size: 14px; font-weight: 600;">ORDER CONFIRMED BY DRIVER</p>
      </div>
      <div style="padding: 24px;">
        <p style="font-size: 16px; margin-top: 0;">Dear <strong>${order.name}</strong>,</p>
        <p style="font-size: 15px; color: #cbd5e1;">Your vehicle load request <strong>${orderRef}</strong> has been confirmed by our driver.</p>
        
        <div style="background: #1e293b; border-left: 4px solid #10b981; padding: 16px; border-radius: 6px; margin: 20px 0;">
          <h3 style="margin: 0 0 12px 0; color: #10b981; font-size: 16px;">Trip Details</h3>
          <p style="margin: 6px 0; font-size: 14px;"><strong>Pickup Location:</strong> ${order.pickup_city || 'Not specified'}</p>
          <p style="margin: 6px 0; font-size: 14px;"><strong>Delivery Destination:</strong> ${order.drop_city || 'Not specified'}</p>
          <p style="margin: 6px 0; font-size: 14px;"><strong>Vehicle Type:</strong> ${order.vehicle_preferred || driver?.vehicle_type || 'Commercial Vehicle'}</p>
          <p style="margin: 6px 0; font-size: 14px;"><strong>Cargo:</strong> ${order.quantity || ''} ${order.goods_category || ''}</p>
          <p style="margin: 6px 0; font-size: 14px;"><strong>Driver:</strong> ${driver?.full_name || order.assigned_driver_name || 'Vandi Load Driver'} (${driver?.phone || order.assigned_driver_phone || '-'})</p>
        </div>

        <p style="font-size: 14px; color: #94a3b8;">Our driver will coordinate with you directly for smooth loading and delivery.</p>
      </div>
      <div style="background: #020617; padding: 14px; text-align: center; font-size: 12px; color: #64748b;">
        Vandi Load • Need assistance? Contact our 24/7 support.
      </div>
    </div>
  `;

  return sendEmail({
    orderId: order.id,
    eventType: 'driver_confirmed_customer',
    to: recipientEmail,
    subject,
    text,
    html
  });
}

/**
 * EVENT 2 (Admin): Driver confirms order -> Admin email
 */
async function sendAdminConfirmationEmail(order, driver) {
  if (!order) return;

  const orderRef = order.request_code || `#${order.id}`;
  const subject = `✔ Order Confirmed: ${orderRef} by ${driver?.full_name || order.assigned_driver_name}`;

  const text = `
Admin Notification: Driver Confirmed Order

- Order Reference: ${orderRef}
- Customer: ${order.name} (${order.phone})
- Assigned Driver: ${driver?.full_name || order.assigned_driver_name} (${driver?.phone || order.assigned_driver_phone})
- Vehicle: ${order.vehicle_preferred || driver?.vehicle_type || 'Commercial Vehicle'}
- Route: ${order.pickup_city || 'Origin'} -> ${order.drop_city || 'Destination'}
- Status: Driver Confirmed
- Confirmation Time: ${new Date(order.driver_confirmed_at || Date.now()).toLocaleString('en-IN')}

View in Admin Panel: ${APP_URL}/admin
  `.trim();

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #0f172a; color: #f8fafc; border-radius: 8px; overflow: hidden; border: 1px solid #334155;">
      <div style="background: #3b82f6; color: #ffffff; padding: 16px; text-align: center;">
        <h2 style="margin: 0; font-size: 20px;">Vandi Load Admin Alert</h2>
        <p style="margin: 4px 0 0 0; font-size: 13px;">DRIVER CONFIRMED TRIP</p>
      </div>
      <div style="padding: 20px;">
        <p style="font-size: 15px; margin-top: 0;">Driver <strong>${driver?.full_name || order.assigned_driver_name}</strong> has confirmed order <strong>${orderRef}</strong>.</p>
        
        <table style="width: 100%; font-size: 14px; color: #cbd5e1; border-collapse: collapse;">
          <tr><td style="padding: 6px 0; color: #94a3b8;">Order ID:</td><td style="font-weight: bold; color: #ffffff;">${orderRef}</td></tr>
          <tr><td style="padding: 6px 0; color: #94a3b8;">Customer:</td><td>${order.name} (📞 ${order.phone})</td></tr>
          <tr><td style="padding: 6px 0; color: #94a3b8;">Driver:</td><td>${driver?.full_name || order.assigned_driver_name} (📞 ${driver?.phone || order.assigned_driver_phone})</td></tr>
          <tr><td style="padding: 6px 0; color: #94a3b8;">Route:</td><td>${order.pickup_city || '-'} → ${order.drop_city || '-'}</td></tr>
          <tr><td style="padding: 6px 0; color: #94a3b8;">Vehicle:</td><td>${order.vehicle_preferred || driver?.vehicle_type || '-'}</td></tr>
          <tr><td style="padding: 6px 0; color: #94a3b8;">Status:</td><td style="color: #10b981; font-weight: bold;">Driver Confirmed</td></tr>
          <tr><td style="padding: 6px 0; color: #94a3b8;">Confirmed At:</td><td>${new Date(order.driver_confirmed_at || Date.now()).toLocaleString('en-IN')}</td></tr>
        </table>

        <div style="margin-top: 20px; text-align: center;">
          <a href="${APP_URL}/admin" style="background: #3b82f6; color: #ffffff; padding: 10px 20px; text-decoration: none; border-radius: 4px; font-weight: bold; display: inline-block;">Open Admin Panel</a>
        </div>
      </div>
    </div>
  `;

  const adminEmail = getAdminEmail();
  return sendEmail({
    orderId: order.id,
    eventType: 'driver_confirmed_admin',
    to: adminEmail,
    subject,
    text,
    html
  });
}

/**
 * EVENT 3: Driver does not confirm within 5 minutes -> Automatic Cancellation (ADMIN ONLY, NO CUSTOMER EMAIL)
 */
async function sendAdminTimeoutCancellationEmail(order) {
  if (!order) return;

  const orderRef = order.request_code || `#${order.id}`;
  const subject = `⚠️ Order Cancelled (Driver Timeout): ${orderRef} - ${order.assigned_driver_name || 'Driver'}`;

  const text = `
Admin Alert: Driver Confirmation Timeout - Order Cancelled

- Order Reference: ${orderRef}
- Customer Name: ${order.name} (${order.phone})
- Assigned Driver: ${order.assigned_driver_name || 'Driver'} (${order.assigned_driver_phone || '-'})
- Vehicle: ${order.vehicle_preferred || 'Commercial Vehicle'}
- Assignment Time: ${new Date(order.driver_assigned_at || order.assigned_at || Date.now()).toLocaleString('en-IN')}
- Reason: Driver did not confirm within 5 minutes.
- Order Status: Cancelled - Driver Did Not Confirm

Note: The order has been automatically cancelled on the server. You may reassign this order to another available driver in the Admin Panel.

Admin Panel: ${APP_URL}/admin
  `.trim();

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #0f172a; color: #f8fafc; border-radius: 8px; overflow: hidden; border: 1px solid #334155;">
      <div style="background: #ef4444; color: #ffffff; padding: 16px; text-align: center;">
        <h2 style="margin: 0; font-size: 20px;">Vandi Load Admin Alert</h2>
        <p style="margin: 4px 0 0 0; font-size: 13px;">AUTOMATIC 5-MINUTE CANCELLATION</p>
      </div>
      <div style="padding: 20px;">
        <p style="font-size: 15px; margin-top: 0; color: #fca5a5;">
          Driver <strong>${order.assigned_driver_name || 'Driver'}</strong> did not confirm order <strong>${orderRef}</strong> within the 5-minute window.
        </p>

        <div style="background: rgba(239, 68, 68, 0.15); border-left: 4px solid #ef4444; padding: 12px; border-radius: 4px; margin: 16px 0;">
          <p style="margin: 0; font-size: 14px; font-weight: bold; color: #ffffff;">Order automatically cancelled by server.</p>
        </div>
        
        <table style="width: 100%; font-size: 14px; color: #cbd5e1; border-collapse: collapse;">
          <tr><td style="padding: 6px 0; color: #94a3b8;">Order ID:</td><td style="font-weight: bold; color: #ffffff;">${orderRef}</td></tr>
          <tr><td style="padding: 6px 0; color: #94a3b8;">Customer Name:</td><td>${order.name} (📞 ${order.phone})</td></tr>
          <tr><td style="padding: 6px 0; color: #94a3b8;">Assigned Driver:</td><td>${order.assigned_driver_name || '-'} (📞 ${order.assigned_driver_phone || '-'})</td></tr>
          <tr><td style="padding: 6px 0; color: #94a3b8;">Vehicle:</td><td>${order.vehicle_preferred || '-'}</td></tr>
          <tr><td style="padding: 6px 0; color: #94a3b8;">Assignment Time:</td><td>${new Date(order.driver_assigned_at || order.assigned_at || Date.now()).toLocaleString('en-IN')}</td></tr>
          <tr><td style="padding: 6px 0; color: #94a3b8;">Cancellation Reason:</td><td style="color: #ef4444; font-weight: bold;">Driver did not confirm within 5 minutes</td></tr>
        </table>

        <div style="margin-top: 24px; text-align: center;">
          <a href="${APP_URL}/admin" style="background: #e5a83b; color: #0f172a; padding: 10px 22px; text-decoration: none; border-radius: 4px; font-weight: bold; display: inline-block;">Reassign Order in Admin Panel</a>
        </div>
      </div>
    </div>
  `;

  const adminEmail = getAdminEmail();
  return sendEmail({
    orderId: order.id,
    eventType: 'driver_timeout_cancelled_admin',
    to: adminEmail,
    subject,
    text,
    html
  });
}

/**
 * EVENT 4A: Customer Enquiry Form Submitted -> Customer Confirmation Email
 */
async function sendCustomerEnquiryReceivedEmail(enquiry) {
  if (!enquiry || !enquiry.customer_email) return;

  const orderRef = enquiry.request_code || `#${enquiry.id}`;
  const subject = `📦 Request Received: ${orderRef} | Vandi Load`;

  const text = `
Dear ${enquiry.name},

Thank you for choosing Vandi Load. We have received your load transport enquiry.

REQUEST DETAILS:
- Request ID: ${orderRef}
- Pickup Location: ${enquiry.pickup_city || 'Not specified'}
- Delivery Location: ${enquiry.drop_city || 'Not specified'}
- Load / Cargo: ${enquiry.quantity || ''} ${enquiry.goods_category || 'General Freight'}
- Vehicle Requirement: ${enquiry.vehicle_preferred || 'Best Fit Vehicle'}
- Status: Received (Pending Driver Assignment)

WHAT HAPPENS NEXT:
Our operations team is arranging an approved commercial driver for your trip. Once assigned and confirmed by the driver, you will receive another confirmation email with full driver details.

For any assistance or questions:
- Phone: +91 98765 43210
- Email: support@vandiload.com

Best regards,
Vandi Load Logistics Team
  `.trim();

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #0f172a; color: #f8fafc; border-radius: 8px; overflow: hidden; border: 1px solid #334155;">
      <div style="background: #e5a83b; color: #0f172a; padding: 20px; text-align: center;">
        <h1 style="margin: 0; font-size: 24px; font-weight: bold;">VANDI LOAD</h1>
        <p style="margin: 5px 0 0 0; font-size: 14px; font-weight: 600;">TRANSPORT REQUEST RECEIVED</p>
      </div>
      <div style="padding: 24px;">
        <p style="font-size: 16px; margin-top: 0;">Dear <strong>${enquiry.name}</strong>,</p>
        <p style="font-size: 15px; color: #cbd5e1;">We have received your load transport request <strong>${orderRef}</strong>.</p>
        
        <div style="background: #1e293b; border-left: 4px solid #e5a83b; padding: 16px; border-radius: 6px; margin: 20px 0;">
          <h3 style="margin: 0 0 12px 0; color: #e5a83b; font-size: 16px;">Request Details (${orderRef})</h3>
          <p style="margin: 6px 0; font-size: 14px;"><strong>Pickup:</strong> ${enquiry.pickup_city || 'Not specified'}</p>
          <p style="margin: 6px 0; font-size: 14px;"><strong>Drop:</strong> ${enquiry.drop_city || 'Not specified'}</p>
          <p style="margin: 6px 0; font-size: 14px;"><strong>Cargo:</strong> ${enquiry.quantity || ''} ${enquiry.goods_category || 'General Freight'}</p>
          <p style="margin: 6px 0; font-size: 14px;"><strong>Vehicle Requirement:</strong> ${enquiry.vehicle_preferred || 'Best Fit Vehicle'}</p>
        </div>

        <p style="font-size: 14px; color: #94a3b8;">Our operations team is arranging an approved driver. You will receive a confirmation once the driver confirms the trip.</p>
      </div>
      <div style="background: #020617; padding: 14px; text-align: center; font-size: 12px; color: #64748b;">
        Vandi Load • 24/7 Support: +91 98765 43210
      </div>
    </div>
  `;

  return sendEmail({
    orderId: enquiry.id,
    eventType: 'customer_enquiry_received',
    to: enquiry.customer_email,
    subject,
    text,
    html
  });
}

/**
 * EVENT 4B: Customer Enquiry Form Submitted -> Admin Notification Email
 */
async function sendAdminEnquiryNotificationEmail(enquiry) {
  if (!enquiry) return;

  const orderRef = enquiry.request_code || `#${enquiry.id}`;
  const subject = `🔔 New Customer Enquiry: ${orderRef} - ${enquiry.name}`;

  const text = `
New Customer Enquiry Received on Vandi Load

- Request ID: ${orderRef}
- Customer Name: ${enquiry.name}
- Customer Phone: ${enquiry.phone}
- Customer Email: ${enquiry.customer_email || 'Not provided'}
- Pickup Location: ${enquiry.pickup_city || '-'}
- Drop Location: ${enquiry.drop_city || '-'}
- Goods / Cargo: ${enquiry.quantity || ''} ${enquiry.goods_category || ''}
- Vehicle Preferred: ${enquiry.vehicle_preferred || 'Best Fit'}
${enquiry.message ? `- Notes: ${enquiry.message}\n` : ''}
Assign Driver in Admin Panel: ${APP_URL}/admin
  `.trim();

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #0f172a; color: #f8fafc; border-radius: 8px; overflow: hidden; border: 1px solid #334155;">
      <div style="background: #e5a83b; color: #0f172a; padding: 16px; text-align: center;">
        <h2 style="margin: 0; font-size: 20px;">Vandi Load Admin Alert</h2>
        <p style="margin: 4px 0 0 0; font-size: 13px;">NEW CUSTOMER ENQUIRY</p>
      </div>
      <div style="padding: 20px;">
        <table style="width: 100%; font-size: 14px; color: #cbd5e1; border-collapse: collapse;">
          <tr><td style="padding: 6px 0; color: #94a3b8;">Request ID:</td><td style="font-weight: bold; color: #ffffff;">${orderRef}</td></tr>
          <tr><td style="padding: 6px 0; color: #94a3b8;">Customer:</td><td>${enquiry.name} (📞 ${enquiry.phone})</td></tr>
          <tr><td style="padding: 6px 0; color: #94a3b8;">Email:</td><td>${enquiry.customer_email || 'Not provided'}</td></tr>
          <tr><td style="padding: 6px 0; color: #94a3b8;">Route:</td><td>${enquiry.pickup_city || '-'} → ${enquiry.drop_city || '-'}</td></tr>
          <tr><td style="padding: 6px 0; color: #94a3b8;">Cargo:</td><td>${enquiry.quantity || ''} ${enquiry.goods_category || ''}</td></tr>
          <tr><td style="padding: 6px 0; color: #94a3b8;">Vehicle:</td><td>${enquiry.vehicle_preferred || 'Best Fit'}</td></tr>
          ${enquiry.message ? `<tr><td style="padding: 6px 0; color: #94a3b8;">Notes:</td><td>${enquiry.message}</td></tr>` : ''}
        </table>

        <div style="margin-top: 20px; text-align: center;">
          <a href="${APP_URL}/admin" style="background: #e5a83b; color: #0f172a; padding: 10px 20px; text-decoration: none; border-radius: 4px; font-weight: bold; display: inline-block;">Assign Driver in Admin Panel</a>
        </div>
      </div>
    </div>
  `;

  const adminEmail = getAdminEmail();
  return sendEmail({
    orderId: enquiry.id,
    eventType: 'admin_enquiry_notification',
    to: adminEmail,
    subject,
    text,
    html
  });
}

/**
 * EVENT 5A: Driver Registration Form Submitted -> Driver Confirmation Email
 */
async function sendDriverRegistrationReceivedEmail(driver) {
  if (!driver || !driver.email) return;

  const subject = `🚛 Driver Registration Received | Vandi Load`;

  const text = `
Dear ${driver.full_name},

Thank you for registering with Vandi Load.

REGISTRATION DETAILS:
- Name: ${driver.full_name}
- Mobile: ${driver.phone}
- Vehicle Type: ${driver.vehicle_type}
- Vehicle Number: ${driver.vehicle_number}
- Operating City: ${driver.location}

STATUS: Pending Verification
Our administrative team is reviewing your vehicle and driving details. Once approved, your account will be activated and you will start receiving load assignments.

Best regards,
Vandi Load Driver Operations Team
  `.trim();

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #0f172a; color: #f8fafc; border-radius: 8px; overflow: hidden; border: 1px solid #334155;">
      <div style="background: #3b82f6; color: #ffffff; padding: 20px; text-align: center;">
        <h1 style="margin: 0; font-size: 24px; font-weight: bold;">VANDI LOAD</h1>
        <p style="margin: 5px 0 0 0; font-size: 14px; font-weight: 600;">DRIVER REGISTRATION RECEIVED</p>
      </div>
      <div style="padding: 24px;">
        <p style="font-size: 16px; margin-top: 0;">Dear <strong>${driver.full_name}</strong>,</p>
        <p style="font-size: 15px; color: #cbd5e1;">Your driver partner application has been received successfully.</p>
        
        <div style="background: #1e293b; border-left: 4px solid #3b82f6; padding: 16px; border-radius: 6px; margin: 20px 0;">
          <h3 style="margin: 0 0 12px 0; color: #60a5fa; font-size: 16px;">Application Details</h3>
          <p style="margin: 6px 0; font-size: 14px;"><strong>Vehicle:</strong> ${driver.vehicle_type} (${driver.vehicle_number})</p>
          <p style="margin: 6px 0; font-size: 14px;"><strong>Operating City:</strong> ${driver.location}</p>
          <p style="margin: 6px 0; font-size: 14px;"><strong>Status:</strong> <span style="color: #e5a83b; font-weight: bold;">Pending Admin Approval</span></p>
        </div>

        <p style="font-size: 14px; color: #94a3b8;">Our operations team will review your application and contact you for verification.</p>
      </div>
    </div>
  `;

  return sendEmail({
    orderId: driver.id,
    eventType: 'driver_registration_received',
    to: driver.email,
    subject,
    text,
    html
  });
}

/**
 * EVENT 5B: Driver Registration Form Submitted -> Admin Notification Email
 */
async function sendAdminDriverRegistrationNotificationEmail(driver) {
  if (!driver) return;

  const subject = `🚚 New Driver Application: ${driver.full_name} (${driver.vehicle_number})`;

  const text = `
New Driver Registration Received on Vandi Load

- Driver Name: ${driver.full_name}
- Mobile: ${driver.phone}
- Email: ${driver.email || 'Not provided'}
- Vehicle Type: ${driver.vehicle_type}
- Vehicle Number: ${driver.vehicle_number}
- City: ${driver.location}
- Experience: ${driver.experience} years

Review and Approve Driver: ${APP_URL}/admin
  `.trim();

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #0f172a; color: #f8fafc; border-radius: 8px; overflow: hidden; border: 1px solid #334155;">
      <div style="background: #3b82f6; color: #ffffff; padding: 16px; text-align: center;">
        <h2 style="margin: 0; font-size: 20px;">Vandi Load Admin Alert</h2>
        <p style="margin: 4px 0 0 0; font-size: 13px;">NEW DRIVER REGISTRATION</p>
      </div>
      <div style="padding: 20px;">
        <table style="width: 100%; font-size: 14px; color: #cbd5e1; border-collapse: collapse;">
          <tr><td style="padding: 6px 0; color: #94a3b8;">Driver:</td><td style="font-weight: bold; color: #ffffff;">${driver.full_name} (📞 ${driver.phone})</td></tr>
          <tr><td style="padding: 6px 0; color: #94a3b8;">Email:</td><td>${driver.email || 'Not provided'}</td></tr>
          <tr><td style="padding: 6px 0; color: #94a3b8;">Vehicle:</td><td>${driver.vehicle_type} (${driver.vehicle_number})</td></tr>
          <tr><td style="padding: 6px 0; color: #94a3b8;">Location:</td><td>${driver.location}</td></tr>
          <tr><td style="padding: 6px 0; color: #94a3b8;">Experience:</td><td>${driver.experience} years</td></tr>
        </table>

        <div style="margin-top: 20px; text-align: center;">
          <a href="${APP_URL}/admin" style="background: #3b82f6; color: #ffffff; padding: 10px 20px; text-decoration: none; border-radius: 4px; font-weight: bold; display: inline-block;">Review in Admin Panel</a>
        </div>
      </div>
    </div>
  `;

  const adminEmail = getAdminEmail();
  return sendEmail({
    orderId: driver.id,
    eventType: 'admin_driver_registration_notification',
    to: adminEmail,
    subject,
    text,
    html
  });
}

module.exports = {
  getAdminEmail,
  sendDriverAssignmentEmail,
  sendCustomerConfirmationEmail,
  sendAdminConfirmationEmail,
  sendAdminTimeoutCancellationEmail,
  sendCustomerEnquiryReceivedEmail,
  sendAdminEnquiryNotificationEmail,
  sendDriverRegistrationReceivedEmail,
  sendAdminDriverRegistrationNotificationEmail,
  isEmailAlreadySent,
  APP_URL
};
