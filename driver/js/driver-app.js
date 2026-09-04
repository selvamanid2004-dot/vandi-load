/**
 * Vandi Load - Driver Portal Application Controller
 * Handles live dashboard rendering, real-time status transitions, trip detail modals, and customer calling.
 */

const DriverApp = {
  currentFilter: 'all',
  searchQuery: '',
  profile: null,
  orders: [],

  async init() {
    if (!DriverAuth.requireAuth()) return;

    this.setupEventListeners();
    await this.loadProfile();
    await this.loadOrders();
  },

  setupEventListeners() {
    // Filter Pills
    document.querySelectorAll('.filter-pill[data-status]').forEach(pill => {
      pill.addEventListener('click', () => {
        document.querySelectorAll('.filter-pill').forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
        this.currentFilter = pill.getAttribute('data-status');
        this.loadOrders();
      });
    });

    // Search Input
    const searchInput = document.getElementById('tripSearchInput');
    let debounceTimer;
    searchInput?.addEventListener('input', (e) => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        this.searchQuery = e.target.value.trim();
        this.loadOrders();
      }, 250);
    });

    // Cancel Form Submit
    const cancelForm = document.getElementById('cancelTripForm');
    cancelForm?.addEventListener('submit', async (e) => {
      e.preventDefault();
      await this.handleCancelSubmit();
    });

    // Change Password Form Submit
    const changePassForm = document.getElementById('driverChangePasswordForm');
    changePassForm?.addEventListener('submit', async (e) => {
      e.preventDefault();
      await this.handleChangePasswordSubmit(e);
    });
  },

  showToast(message, type = 'success') {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    let icon = '✔';
    if (type === 'error') icon = '❌';
    if (type === 'info') icon = 'ℹ';

    toast.innerHTML = `<span>${icon}</span> <span>${message}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 3500);
  },

  async loadProfile() {
    try {
      const res = await DriverAPI.getProfile();
      if (!res || !res.success) return;

      this.profile = res.driver;
      const stats = res.stats || {};

      // Header info
      document.getElementById('headerDriverName').textContent = this.profile.full_name || 'Driver Partner';
      document.getElementById('headerDriverPhone').textContent = this.profile.phone || '';
      document.getElementById('headerAvatar').textContent = (this.profile.full_name || 'D')[0].toUpperCase();

      // Banner info
      document.getElementById('bannerDriverName').textContent = this.profile.full_name || 'Driver Partner';
      document.getElementById('bannerAvatar').textContent = (this.profile.full_name || 'D')[0].toUpperCase();
      document.getElementById('bannerCity').textContent = `📍 ${this.profile.location || 'Tamil Nadu'}`;
      document.getElementById('bannerVehicle').textContent = `🚛 ${this.profile.vehicle_type ? this.profile.vehicle_type.toUpperCase() : 'Commercial'} • ${this.profile.vehicle_number || ''}`;
      document.getElementById('bannerExp').textContent = `⭐ ${this.profile.experience || 0} Years Exp`;
      document.getElementById('bannerStatus').textContent = (this.profile.status || 'approved').toUpperCase();

      // Stats counts
      document.getElementById('statTotalTrips').textContent = stats.totalTrips || 0;
      document.getElementById('statAssignedTrips').textContent = stats.newAssigned || 0;
      document.getElementById('statActiveTrips').textContent = (stats.inProgressCount || 0) + (stats.acceptedCount || 0);
      document.getElementById('statCompletedTrips').textContent = stats.completedCount || 0;

    } catch (err) {
      console.error('Error loading driver profile:', err);
    }
  },

  async loadOrders() {
    const listContainer = document.getElementById('tripsListContainer');
    if (!listContainer) return;

    listContainer.innerHTML = `
      <div style="text-align: center; padding: 40px 0; color: var(--text-muted);">
        <div style="font-size: 1.5rem; margin-bottom: 8px;">🔄</div>
        <p>Loading assigned trips...</p>
      </div>
    `;

    try {
      const res = await DriverAPI.getOrders(this.currentFilter, this.searchQuery);
      if (!res || !res.success) {
        listContainer.innerHTML = `<div class="empty-state"><div class="empty-icon">⚠️</div><h3 class="empty-title">Failed to load trips</h3><p class="empty-desc">${res?.message || 'Please refresh the page.'}</p></div>`;
        return;
      }

      this.orders = res.data || [];

      if (this.orders.length === 0) {
        listContainer.innerHTML = `
          <div class="empty-state">
            <div class="empty-icon">🚚</div>
            <h3 class="empty-title">No Assigned Trips Found</h3>
            <p class="empty-desc">${this.searchQuery || this.currentFilter !== 'all' ? 'No orders match your filter criteria.' : 'When the Vandi Load admin assigns a load request to you, it will appear here.'}</p>
          </div>
        `;
        return;
      }

      listContainer.innerHTML = this.orders.map(order => this.renderOrderCard(order)).join('');

    } catch (err) {
      console.error('Error loading orders:', err);
      listContainer.innerHTML = `<div class="empty-state"><div class="empty-icon">⚠️</div><h3 class="empty-title">Error loading trips</h3><p class="empty-desc">Could not connect to the server.</p></div>`;
    }
  },

  renderOrderCard(o) {
    const status = o.assignment_status || 'Pending';
    const isCancelled = status.startsWith('Cancelled') || o.driver_confirmation_status === 'Cancelled - Driver Did Not Confirm' || !!o.cancelled_at;
    const isWaiting = (status === 'Waiting for Driver Confirmation' || status === 'Assigned') && !isCancelled;
    const isConfirmed = (status === 'Driver Confirmed' || status === 'Accepted');

    let isExpired = false;
    let remainingMs = 0;
    if (isWaiting && o.driver_confirmation_deadline) {
      remainingMs = new Date(o.driver_confirmation_deadline).getTime() - Date.now();
      if (remainingMs <= 0) {
        isExpired = true;
      }
    }

    const statusClass = (isCancelled ? 'cancelled' : (isConfirmed ? 'driverconfirmed' : (isWaiting ? 'waiting' : status.toLowerCase().replace(/\s+/g, ''))));
    const assignedDateFormatted = o.driver_assigned_at || o.assigned_at 
      ? new Date(o.driver_assigned_at || o.assigned_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
      : (o.created_at ? new Date(o.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '-');

    const deadlineFormatted = o.driver_confirmation_deadline
      ? new Date(o.driver_confirmation_deadline).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
      : '-';

    // Action button depending on current state
    let actionButtons = '';
    let timerNoticeHtml = '';

    if (isCancelled || isExpired) {
      timerNoticeHtml = `
        <div style="background: rgba(239, 68, 68, 0.15); border: 1px solid #ef4444; color: #fca5a5; padding: 10px 14px; border-radius: 6px; margin-bottom: 14px; font-size: 0.88rem; font-weight: 600;">
          ⚠️ This order is no longer available. (5-minute confirmation deadline expired)
        </div>
      `;
    } else if (isWaiting) {
      const mins = Math.floor(Math.max(0, remainingMs) / 60000);
      const secs = Math.floor((Math.max(0, remainingMs) % 60000) / 1000);

      timerNoticeHtml = `
        <div style="background: rgba(229, 168, 59, 0.15); border: 1px solid var(--brand-gold); color: #ffffff; padding: 10px 14px; border-radius: 6px; margin-bottom: 14px;">
          <div style="font-weight: 700; color: var(--brand-gold); font-size: 0.9rem; margin-bottom: 4px;">
            ⏱️ Please confirm this order within 5 minutes.
          </div>
          <div style="font-size: 0.82rem; color: #cbd5e1;">
            Assigned: <strong>${assignedDateFormatted}</strong> | Deadline: <strong style="color: #ef4444;">${deadlineFormatted}</strong> (${mins}m ${secs}s remaining)
          </div>
        </div>
      `;

      actionButtons = `
        <button class="btn btn-accept" style="background: #10b981; font-weight: 700; font-size: 0.9rem; padding: 8px 20px;" onclick="DriverApp.handleStatusTransition(${o.id}, 'Driver Confirmed')">
          <span>✔ Confirm Order</span>
        </button>
      `;
    } else if (isConfirmed) {
      actionButtons = `
        <span style="background: rgba(16, 185, 129, 0.15); border: 1px solid #10b981; color: #4ade80; padding: 6px 14px; border-radius: 4px; font-size: 0.84rem; font-weight: 700; display: inline-flex; align-items: center; gap: 6px;">
          ✔ Order Confirmed
        </span>
        <button class="btn btn-transit" onclick="DriverApp.handleStatusTransition(${o.id}, 'In Progress')">
          <span>🚛 Start Transit / In Progress</span>
        </button>
      `;
    } else if (status === 'In Progress') {
      actionButtons = `
        <button class="btn btn-complete" onclick="DriverApp.handleStatusTransition(${o.id}, 'Completed')">
          <span>🏁 Mark as Delivered & Completed</span>
        </button>
      `;
    }

    const isCancelable = !isCancelled && status !== 'Completed';

    return `
      <div class="trip-card">
        <div class="trip-card-header">
          <div class="trip-code-wrap">
            <span class="trip-code">${o.request_code || `#${o.id}`}</span>
            <span class="status-pill status-${statusClass}">${isCancelled ? 'CANCELLED' : (isWaiting ? 'WAITING CONFIRMATION' : (isConfirmed ? 'DRIVER CONFIRMED' : status.toUpperCase()))}</span>
          </div>
          <span class="trip-date">Assigned: ${assignedDateFormatted}</span>
        </div>

        ${timerNoticeHtml}

        <!-- Route Visualization -->
        <div class="trip-route-box">
          <div class="route-dot pickup"></div>
          <div>
            <div class="route-type">Pickup Location</div>
            <div class="route-city">${o.pickup_city || 'City Origin'}${o.pickup_district ? `, ${o.pickup_district}` : ''}${o.pickup_state ? ` (${o.pickup_state})` : ''}</div>
            ${o.pickup_address ? `<div style="font-size: 0.76rem; color: #cbd5e1; margin-top: 2px;">📍 ${o.pickup_address}</div>` : ''}
          </div>
          <div class="route-arrow">➔</div>
          <div class="route-dot drop"></div>
          <div>
            <div class="route-type">Delivery Destination</div>
            <div class="route-city">${o.drop_city || 'City Destination'}${o.drop_district ? `, ${o.drop_district}` : ''}${o.drop_state ? ` (${o.drop_state})` : ''}</div>
            ${o.drop_address ? `<div style="font-size: 0.76rem; color: #cbd5e1; margin-top: 2px;">🎯 ${o.drop_address}</div>` : ''}
          </div>
        </div>

        <div style="margin-bottom: 14px; display: flex; gap: 8px; align-items: center; flex-wrap: wrap;">
          ${(o.pickup_latitude && o.pickup_longitude) ? `
            <a href="https://www.google.com/maps/dir/?api=1&destination=${o.pickup_latitude},${o.pickup_longitude}" target="_blank" rel="noopener noreferrer" class="btn btn-secondary btn-sm" style="font-size: 0.78rem; padding: 4px 10px; display: inline-flex; align-items: center; gap: 4px;">
              <span>🗺️ Nav Pickup</span>
            </a>
          ` : ''}
          ${((o.drop_latitude || o.delivery_latitude) && (o.drop_longitude || o.delivery_longitude)) ? `
            <a href="https://www.google.com/maps/dir/?api=1&destination=${o.drop_latitude || o.delivery_latitude},${o.drop_longitude || o.delivery_longitude}" target="_blank" rel="noopener noreferrer" class="btn btn-secondary btn-sm" style="font-size: 0.78rem; padding: 4px 10px; display: inline-flex; align-items: center; gap: 4px;">
              <span>🗺️ Nav Delivery</span>
            </a>
          ` : ''}
          <button type="button" class="btn btn-secondary btn-sm" style="font-size: 0.78rem; padding: 4px 10px; display: inline-flex; align-items: center; gap: 4px;" onclick="DriverApp.openTripDetailsModal(${o.id})">
            <span>📍 View Maps & Details</span>
          </button>
        </div>

        <!-- Load & Customer Details -->
        <div class="trip-info-grid">
          <div class="trip-info-item">
            <span class="info-label">Customer Name</span>
            <span class="info-val" style="color: #ffffff;">${o.name || '-'}</span>
          </div>
          <div class="trip-info-item">
            <span class="info-label">Customer Contact</span>
            <span class="info-val">
              <a href="tel:${o.phone}" class="btn btn-call" style="padding: 3px 10px; font-size: 0.8rem; text-decoration: none;">
                📞 Call ${o.phone}
              </a>
            </span>
          </div>
          <div class="trip-info-item">
            <span class="info-label">Goods / Cargo Category</span>
            <span class="info-val">${o.goods_category || 'General Cargo'}</span>
          </div>
          <div class="trip-info-item">
            <span class="info-label">Quantity / Volume</span>
            <span class="info-val" style="color: var(--brand-gold);">${o.quantity || '-'}</span>
          </div>
          <div class="trip-info-item">
            <span class="info-label">Vehicle Preferred</span>
            <span class="info-val">${o.vehicle_preferred || 'Best Fit Vehicle'}</span>
          </div>
          <div class="trip-info-item">
            <span class="info-label">Assignment Time</span>
            <span class="info-val">${assignedDateFormatted}</span>
          </div>
          ${o.admin_notes ? `
          <div class="trip-info-item" style="grid-column: 1 / -1;">
            <span class="info-label" style="color: var(--brand-gold);">Admin Instructions / Pickup Notes:</span>
            <div style="background: rgba(229, 168, 59, 0.1); border-left: 3px solid var(--brand-gold); padding: 6px 12px; border-radius: 4px; font-size: 0.84rem; color: #ffffff; margin-top: 4px;">
              ${o.admin_notes}
            </div>
          </div>
          ` : ''}
          ${o.driver_notes ? `
          <div class="trip-info-item" style="grid-column: 1 / -1;">
            <span class="info-label" style="color: #94a3b8;">Driver Notes:</span>
            <div style="font-size: 0.84rem; color: var(--text-muted); margin-top: 2px;">
              ${o.driver_notes}
            </div>
          </div>
          ` : ''}
        </div>

        <!-- Footer Actions -->
        <div class="trip-card-actions">
          <button class="btn btn-secondary" onclick="DriverApp.openTripDetailsModal(${o.id})">
            <span>🔍 View Full Details & Map</span>
          </button>

          <div class="action-buttons-group" style="display: flex; gap: 8px; align-items: center;">
            ${isCancelable && !isWaiting ? `
              <button class="btn btn-cancel" onclick="DriverApp.openCancelModal(${o.id})">
                Cancel Trip
              </button>
            ` : ''}
            ${actionButtons}
          </div>
        </div>
      </div>
    `;
  },

  async handleStatusTransition(orderId, nextStatus) {
    let confirmMsg = `Are you sure you want to change this trip status to "${nextStatus}"?`;
    if (nextStatus === 'Driver Confirmed' || nextStatus === 'Accepted') {
      confirmMsg = 'Confirm and accept this assigned load? The customer and admin will be notified immediately.';
    } else if (nextStatus === 'In Progress') {
      confirmMsg = 'Start transit for this trip? (Goods are being picked up or in transit)';
    } else if (nextStatus === 'Completed') {
      confirmMsg = 'Mark this trip as delivered and completed?';
    }

    if (!confirm(confirmMsg)) return;

    try {
      const res = await DriverAPI.updateTripStatus(orderId, nextStatus);
      if (res && res.success) {
        this.showToast(nextStatus === 'Driver Confirmed' ? 'Order Confirmed! Customer & Admin notified.' : `Trip status updated to ${nextStatus}!`, 'success');
        await this.loadProfile();
        await this.loadOrders();
      } else {
        this.showToast(res?.message || 'Failed to update trip status', 'error');
        await this.loadOrders();
      }
    } catch (err) {
      this.showToast('Network error updating trip status', 'error');
    }
  },

  openTripDetailsModal(orderId) {
    const order = this.orders.find(o => o.id === orderId);
    if (!order) return;

    const modalBody = document.getElementById('tripDetailsModalBody');
    if (!modalBody) return;

    const status = order.assignment_status || 'Pending';
    const statusClass = status.toLowerCase().replace(/\s+/g, '');

    const fullPickup = [order.pickup_address, order.pickup_city, order.pickup_district, order.pickup_state].filter(Boolean).join(', ');
    const fullDrop = [order.drop_address, order.drop_city, order.drop_district, order.drop_state].filter(Boolean).join(', ');

    modalBody.innerHTML = `
      <div style="margin-bottom: 18px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
          <h3 style="font-size: 1.3rem; color: var(--brand-gold);">${order.request_code || `#${order.id}`}</h3>
          <span class="status-pill status-${statusClass}">${status}</span>
        </div>
        <p style="font-size: 0.8rem; color: var(--text-muted);">Assigned on: ${order.assigned_at ? new Date(order.assigned_at).toLocaleString('en-IN') : new Date(order.created_at).toLocaleString('en-IN')}</p>
      </div>

      <div class="trip-route-box" style="margin-bottom: 16px;">
        <div class="route-dot pickup"></div>
        <div>
          <div class="route-type">Pickup Location</div>
          <div class="route-city">${order.pickup_city || 'Origin'}${order.pickup_district ? `, ${order.pickup_district}` : ''}${order.pickup_state ? ` (${order.pickup_state})` : ''}</div>
          ${order.pickup_address ? `<div style="font-size: 0.78rem; color: #cbd5e1; margin-top: 3px;">📍 ${order.pickup_address}</div>` : ''}
        </div>
        <div class="route-arrow">➔</div>
        <div class="route-dot drop"></div>
        <div>
          <div class="route-type">Delivery Destination</div>
          <div class="route-city">${order.drop_city || 'Destination'}${order.drop_district ? `, ${order.drop_district}` : ''}${order.drop_state ? ` (${order.drop_state})` : ''}</div>
          ${order.drop_address ? `<div style="font-size: 0.78rem; color: #cbd5e1; margin-top: 3px;">🎯 ${order.drop_address}</div>` : ''}
        </div>
      </div>

      ${(order.pickup_latitude && order.pickup_longitude) ? `
      <!-- Pickup Location Map Section -->
      <div style="margin-bottom: 20px; background: rgba(13, 19, 31, 0.7); border: 1px solid var(--border-subtle); border-radius: var(--radius-md); padding: 14px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; flex-wrap: wrap; gap: 8px;">
          <div>
            <div style="font-weight: 700; color: #4ade80; font-size: 0.92rem;">📍 Exact Pickup Map Location</div>
            <div style="font-size: 0.78rem; color: #cbd5e1; margin-top: 2px;">${fullPickup}</div>
          </div>
          <a href="https://www.google.com/maps/dir/?api=1&destination=${order.pickup_latitude},${order.pickup_longitude}" target="_blank" rel="noopener noreferrer" class="btn btn-primary btn-sm" style="display: inline-flex; align-items: center; gap: 6px; padding: 5px 12px; font-size: 0.82rem;">
            <span>🗺️ Navigate to Pickup</span>
          </a>
        </div>
        <div id="driverPickupMapContainer" style="height: 240px; border-radius: 8px; overflow: hidden; border: 1px solid var(--border-subtle); background: #0f172a;"></div>
      </div>
      ` : ''}

      ${((order.drop_latitude || order.delivery_latitude) && (order.drop_longitude || order.delivery_longitude)) ? `
      <!-- Delivery Destination Map Section -->
      <div style="margin-bottom: 20px; background: rgba(13, 19, 31, 0.7); border: 1px solid var(--border-subtle); border-radius: var(--radius-md); padding: 14px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; flex-wrap: wrap; gap: 8px;">
          <div>
            <div style="font-weight: 700; color: var(--brand-gold); font-size: 0.92rem;">🎯 Exact Delivery Destination Map</div>
            <div style="font-size: 0.78rem; color: #cbd5e1; margin-top: 2px;">${fullDrop}</div>
          </div>
          <a href="https://www.google.com/maps/dir/?api=1&destination=${order.drop_latitude || order.delivery_latitude},${order.drop_longitude || order.delivery_longitude}" target="_blank" rel="noopener noreferrer" class="btn btn-primary btn-sm" style="display: inline-flex; align-items: center; gap: 6px; padding: 5px 12px; font-size: 0.82rem;">
            <span>🗺️ Navigate to Delivery</span>
          </a>
        </div>
        <div id="driverDropMapContainer" style="height: 240px; border-radius: 8px; overflow: hidden; border: 1px solid var(--border-subtle); background: #0f172a;"></div>
      </div>
      ` : ''}

      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-bottom: 20px;">
        <div class="trip-info-item">
          <span class="info-label">Customer Name</span>
          <span class="info-val" style="color: #ffffff;">${order.name}</span>
        </div>
        <div class="trip-info-item">
          <span class="info-label">Customer Phone</span>
          <span class="info-val">
            <a href="tel:${order.phone}" class="btn btn-call" style="padding: 4px 10px; font-size: 0.82rem; text-decoration: none;">
              📞 ${order.phone}
            </a>
          </span>
        </div>
        <div class="trip-info-item">
          <span class="info-label">Cargo Goods Type</span>
          <span class="info-val">${order.goods_category || 'General Freight'}</span>
        </div>
        <div class="trip-info-item">
          <span class="info-label">Load Quantity / Size</span>
          <span class="info-val" style="color: var(--brand-gold);">${order.quantity || '-'}</span>
        </div>
        <div class="trip-info-item">
          <span class="info-label">Vehicle Type</span>
          <span class="info-val">${order.vehicle_preferred || 'Best Fit'}</span>
        </div>
        <div class="trip-info-item">
          <span class="info-label">Completed Timestamp</span>
          <span class="info-val">${order.completed_at ? new Date(order.completed_at).toLocaleString('en-IN') : 'In Progress / Pending'}</span>
        </div>
      </div>

      ${order.message ? `
      <div style="margin-bottom: 16px;">
        <span class="info-label" style="font-size: 0.78rem; color: var(--text-muted);">Customer Message / Special Requirements:</span>
        <div style="background: var(--bg-surface-elevated); padding: 10px 14px; border-radius: var(--radius-md); font-size: 0.88rem; color: #ffffff; margin-top: 4px; border: 1px solid var(--border-subtle);">
          ${order.message}
        </div>
      </div>
      ` : ''}

      ${order.admin_notes ? `
      <div style="margin-bottom: 16px;">
        <span class="info-label" style="font-size: 0.78rem; color: var(--brand-gold);">Admin Coordinator Instructions:</span>
        <div style="background: rgba(229, 168, 59, 0.1); border-left: 3px solid var(--brand-gold); padding: 10px 14px; border-radius: var(--radius-md); font-size: 0.88rem; color: #ffffff; margin-top: 4px;">
          ${order.admin_notes}
        </div>
      </div>
      ` : ''}

      ${order.driver_notes ? `
      <div style="margin-bottom: 16px;">
        <span class="info-label" style="font-size: 0.78rem; color: #94a3b8;">Driver Trip Notes:</span>
        <div style="background: var(--bg-surface-elevated); padding: 10px 14px; border-radius: var(--radius-md); font-size: 0.88rem; color: var(--text-muted); margin-top: 4px; border: 1px solid var(--border-subtle);">
          ${order.driver_notes}
        </div>
      </div>
      ` : ''}

      <div style="margin-top: 24px; display: flex; justify-content: flex-end; gap: 10px;">
        <button class="btn btn-secondary" onclick="DriverApp.closeModal('tripDetailsModal')">Close</button>
        <a href="tel:${order.phone}" class="btn btn-call">📞 Call Customer</a>
      </div>
    `;

    this.openModal('tripDetailsModal');

    const hasPickup = !!(order.pickup_latitude && order.pickup_longitude);
    const hasDrop = !!((order.drop_latitude || order.delivery_latitude) && (order.drop_longitude || order.delivery_longitude));

    if (hasPickup || hasDrop) {
      setTimeout(() => {
        if (typeof MapHelper !== 'undefined') {
          if (hasPickup) {
            MapHelper.renderReadOnlyMap('driverPickupMapContainer', order.pickup_latitude, order.pickup_longitude, order.pickup_address || 'Pickup Point');
          }
          if (hasDrop) {
            MapHelper.renderReadOnlyMap('driverDropMapContainer', order.drop_latitude || order.delivery_latitude, order.drop_longitude || order.delivery_longitude, order.drop_address || 'Delivery Destination');
          }
        }
      }, 150);
    }
  },

  openCancelModal(orderId) {
    document.getElementById('cancelOrderId').value = orderId;
    document.getElementById('cancelReasonInput').value = '';
    this.openModal('cancelTripModal');
  },

  async handleCancelSubmit() {
    const orderId = document.getElementById('cancelOrderId').value;
    const reason = document.getElementById('cancelReasonInput').value.trim();

    if (!reason) {
      alert('Please provide a reason for cancelling this assigned trip.');
      return;
    }

    try {
      const res = await DriverAPI.updateTripStatus(orderId, 'Cancelled', reason);
      if (res && res.success) {
        this.closeModal('cancelTripModal');
        this.showToast('Trip has been marked as Cancelled.', 'info');
        await this.loadProfile();
        await this.loadOrders();
      } else {
        alert(res?.message || 'Failed to cancel trip');
      }
    } catch (err) {
      alert('Network error cancelling trip');
    }
  },

  openModal(id) {
    const el = document.getElementById(id);
    if (el) el.classList.add('active');
  },

  closeModal(id) {
    const el = document.getElementById(id);
    if (el) el.classList.remove('active');
  },

  openChangePasswordModal() {
    const alertBox = document.getElementById('driverPassAlert');
    if (alertBox) alertBox.style.display = 'none';
    const form = document.getElementById('driverChangePasswordForm');
    if (form) form.reset();
    this.openModal('driverChangePasswordModal');
  },

  async handleChangePasswordSubmit(e) {
    if (e) e.preventDefault();
    const currentPass = document.getElementById('driverCurrentPass')?.value || '';
    const newPass = document.getElementById('driverNewPass')?.value || '';
    const confirmPass = document.getElementById('driverConfirmPass')?.value || '';
    const alertBox = document.getElementById('driverPassAlert');
    const submitBtn = document.getElementById('driverChangePassBtn');

    function showAlert(msg, isSuccess = false) {
      if (!alertBox) return;
      alertBox.textContent = msg;
      alertBox.style.display = 'block';
      alertBox.style.background = isSuccess ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)';
      alertBox.style.color = isSuccess ? '#4ade80' : '#f87171';
      alertBox.style.border = isSuccess ? '1px solid rgba(34, 197, 94, 0.4)' : '1px solid rgba(239, 68, 68, 0.4)';
    }

    if (!currentPass || !newPass || !confirmPass) {
      showAlert('All fields are required.');
      return;
    }

    if (newPass.length < 6) {
      showAlert('New password must be at least 6 characters long.');
      return;
    }

    if (newPass !== confirmPass) {
      showAlert('New password and confirm password do not match.');
      return;
    }

    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<span>Updating...</span>';
    }

    try {
      const res = await DriverAPI.changePassword(currentPass, newPass, confirmPass);
      if (res && res.success) {
        showAlert('Password updated successfully! Next time you login, please use your new password.', true);
        document.getElementById('driverChangePasswordForm')?.reset();
        setTimeout(() => {
          this.closeModal('driverChangePasswordModal');
          this.showToast('Password changed successfully!', 'success');
        }, 1500);
      } else {
        showAlert(res?.message || 'Failed to update password.');
      }
    } catch (err) {
      showAlert('Connection error. Please try again.');
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<span>Update Password</span>';
      }
    }
  }
};

// Initialize on DOM load
document.addEventListener('DOMContentLoaded', () => {
  DriverApp.init();
});
