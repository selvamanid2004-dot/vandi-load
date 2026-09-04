/**
 * Vandi Load - Server-Side Confirmation Timer Service
 * Reliably enforces the 5-minute driver confirmation window.
 * 
 * Features:
 * - Active in-memory setTimeout for exact 5-minute execution
 * - Periodic database scanner (every 10s) ensuring cancellations happen even after server restarts or network outages
 * - Atomic database state updates preventing race conditions with driver confirmation
 * - Dispatches Admin Timeout Cancellation Email ONLY (never to customer)
 */

const db = require('../database/db');
const { sendAdminTimeoutCancellationEmail } = require('./email.service');
const { broadcastAdminEvent } = require('./realtime.service');

// Default timeout is 5 minutes (300,000 ms)
const CONFIRMATION_TIMEOUT_MS = parseInt(process.env.CONFIRMATION_TIMEOUT_MS, 10) || 5 * 60 * 1000;

// Active memory timers mapped by orderId
const activeTimers = new Map();
let scanInterval = null;

/**
 * Start or refresh the 5-minute confirmation timer for an assigned order
 */
function startConfirmationTimer(orderId) {
  cancelConfirmationTimer(orderId);

  try {
    const order = db.prepare('SELECT id, driver_confirmation_deadline, driver_confirmation_status, driver_confirmed_at, cancelled_at FROM contact_enquiries WHERE id = ?').get(orderId);
    if (!order) return;

    if (order.driver_confirmed_at || order.cancelled_at || order.driver_confirmation_status !== 'Waiting for Driver Confirmation') {
      return;
    }

    let delay = CONFIRMATION_TIMEOUT_MS;
    if (order.driver_confirmation_deadline) {
      const remaining = new Date(order.driver_confirmation_deadline).getTime() - Date.now();
      delay = Math.max(0, remaining);
    }

    if (delay <= 0) {
      // Deadline already expired
      handleTimeoutCancellation(orderId);
      return;
    }

    console.log(`⏱️ [Timer Started] 5-minute confirmation window started for Order #${orderId} (Expires in ${Math.round(delay / 1000)}s)`);

    const timer = setTimeout(() => {
      activeTimers.delete(orderId);
      handleTimeoutCancellation(orderId);
    }, delay);

    // Allow node process to exit gracefully if needed
    if (timer.unref) {
      timer.unref();
    }

    activeTimers.set(orderId, timer);
  } catch (err) {
    console.error(`Error setting confirmation timer for Order #${orderId}:`, err.message);
  }
}

/**
 * Cancel an active in-memory timer
 */
function cancelConfirmationTimer(orderId) {
  if (activeTimers.has(orderId)) {
    clearTimeout(activeTimers.get(orderId));
    activeTimers.delete(orderId);
    console.log(`⏱️ [Timer Cleared] Confirmation timer stopped for Order #${orderId}`);
  }
}

/**
 * Execute atomic server-side cancellation when 5-minute window expires
 */
async function handleTimeoutCancellation(orderId) {
  try {
    // Atomic update: only cancels if still Waiting for Driver Confirmation and not already confirmed/cancelled
    const update = db.prepare(`
      UPDATE contact_enquiries SET
        assignment_status = 'Cancelled - Driver Did Not Confirm',
        driver_confirmation_status = 'Cancelled - Driver Did Not Confirm',
        cancelled_at = CURRENT_TIMESTAMP,
        cancellation_reason = 'Driver did not confirm within 5 minutes',
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
        AND driver_confirmation_status = 'Waiting for Driver Confirmation'
        AND driver_confirmed_at IS NULL
        AND cancelled_at IS NULL
    `);

    const result = update.run(orderId);

    if (result.changes > 0) {
      console.log(`⚠️ [AUTO-CANCELLED] Order #${orderId} automatically cancelled due to 5-minute driver confirmation timeout.`);

      const order = db.prepare('SELECT * FROM contact_enquiries WHERE id = ?').get(orderId);
      if (order) {
        // Broadcast real-time update to connected admin portals
        broadcastAdminEvent('enquiry:updated', order);
        // Send email to ADMIN ONLY (NO email to customer)
        await sendAdminTimeoutCancellationEmail(order);
      }
    } else {
      console.log(`ℹ [Timer Info] Order #${orderId} was already confirmed or cancelled prior to timeout execution.`);
    }
  } catch (err) {
    console.error(`Error during timeout cancellation for Order #${orderId}:`, err.message);
  } finally {
    activeTimers.delete(orderId);
  }
}

/**
 * Periodic scanner to catch overdue unconfirmed orders and recover state after server restarts
 */
function scanOverdueOrders() {
  try {
    const pendingOrders = db.prepare(`
      SELECT id, driver_confirmation_deadline, driver_confirmation_status, driver_assigned_at, driver_confirmed_at, cancelled_at
      FROM contact_enquiries
      WHERE driver_confirmation_status = 'Waiting for Driver Confirmation'
        AND driver_confirmed_at IS NULL
        AND cancelled_at IS NULL
    `).all();

    const now = Date.now();

    for (const order of pendingOrders) {
      const deadline = order.driver_confirmation_deadline ? new Date(order.driver_confirmation_deadline).getTime() : 0;

      if (!deadline || deadline <= now) {
        // Overdue! Cancel immediately
        console.log(`🚨 [Scanner Catch] Order #${order.id} found overdue in database. Executing automatic cancellation.`);
        handleTimeoutCancellation(order.id);
      } else if (!activeTimers.has(order.id)) {
        // Active order with remaining time, schedule in-memory timer
        startConfirmationTimer(order.id);
      }
    }
  } catch (err) {
    console.error('Error in overdue orders scanner:', err.message);
  }
}

/**
 * Initialize background timer services
 */
function initTimerService() {
  console.log('✔ Initializing Server-side 5-minute Confirmation Timer Service...');
  
  // Initial scan on startup
  scanOverdueOrders();

  // Periodic recurring check every 10 seconds
  if (!scanInterval) {
    scanInterval = setInterval(scanOverdueOrders, 10000);
    if (scanInterval.unref) {
      scanInterval.unref();
    }
  }
}

module.exports = {
  startConfirmationTimer,
  cancelConfirmationTimer,
  handleTimeoutCancellation,
  scanOverdueOrders,
  initTimerService,
  CONFIRMATION_TIMEOUT_MS
};
