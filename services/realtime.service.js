/**
 * Vandi Load - Admin Real-time Event Broadcaster (SSE)
 * Provides authenticated Server-Sent Events to keep the Admin Panel in sync
 * without requiring manual page refreshes.
 */

// Active connected Admin SSE response objects
const adminClients = new Set();

/**
 * Handle new incoming Admin SSE connection
 */
function handleAdminSSE(req, res) {
  // Set SSE HTTP response headers
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no' // Prevent Nginx buffering SSE
  });

  // Send initial connection handshake
  res.write(`event: connected\ndata: ${JSON.stringify({ message: 'Connected to Vandi Load Admin Realtime Stream', timestamp: Date.now() })}\n\n`);

  adminClients.add(res);

  // Keep connection alive with periodic comment ping every 25 seconds
  const pingInterval = setInterval(() => {
    try {
      res.write(': ping\n\n');
    } catch (e) {
      clearInterval(pingInterval);
    }
  }, 25000);

  // Clean up on client disconnect
  req.on('close', () => {
    clearInterval(pingInterval);
    adminClients.delete(res);
  });
}

/**
 * Broadcast an event to all connected authenticated Admin Panel clients
 * @param {string} eventName - e.g. 'enquiry:new', 'enquiry:updated', 'stats:updated', 'driver:new'
 * @param {object} data - payload object
 */
function broadcastAdminEvent(eventName, data) {
  if (adminClients.size === 0) return;

  const payload = `event: ${eventName}\ndata: ${JSON.stringify(data)}\n\n`;

  for (const client of adminClients) {
    try {
      client.write(payload);
    } catch (err) {
      adminClients.delete(client);
    }
  }
}

/**
 * Get count of active admin realtime connections
 */
function getActiveAdminConnectionsCount() {
  return adminClients.size;
}

module.exports = {
  handleAdminSSE,
  broadcastAdminEvent,
  getActiveAdminConnectionsCount
};
