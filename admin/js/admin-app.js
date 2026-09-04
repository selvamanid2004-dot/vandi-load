/**
 * Vandi Load - Admin Application Controller
 * Handles SPA navigation, data loading, CRUD modals, assignment workflows, and PDF exports.
 */

const AdminApp = {
  currentView: 'dashboard',
  currentContentTab: 'hero',

  // Cached datasets for fast filtering and PDF export
  data: {
    stats: null,
    vehicles: [],
    categories: [],
    gallery: [],
    enquiries: [],
    orders: [],
    drivers: [],
    content: {},
    settings: {}
  },

  // Initialize
  async init() {
    // 1. Require Authentication
    if (typeof AdminAuth !== 'undefined' && !AdminAuth.requireAuth()) {
      return;
    }

    this.updateUserProfile();
    this.setupNavigation();
    this.setupModals();
    await this.loadInitialData();
    this.initRealtimeSync();

    // Check hash for direct route
    const hash = window.location.hash.replace('#', '') || 'dashboard';
    this.navigateTo(hash);
  },

  updateUserProfile() {
    if (typeof AdminAuth === 'undefined') return;
    const user = AdminAuth.getUser();
    if (user) {
      const nameEl = document.getElementById('adminFullName');
      const emailEl = document.getElementById('adminEmail');
      const avatarEl = document.getElementById('adminAvatar');
      if (nameEl) nameEl.textContent = user.fullName || user.username || 'Admin';
      if (emailEl) emailEl.textContent = user.email || 'admin@vandiload.com';
      if (avatarEl) avatarEl.textContent = (user.fullName || user.username || 'A')[0].toUpperCase();
    }
  },

  // Setup sidebar navigation links
  setupNavigation() {
    document.querySelectorAll('.admin-nav-item[data-view]').forEach(item => {
      item.addEventListener('click', (e) => {
        e.preventDefault();
        const view = item.getAttribute('data-view');
        this.navigateTo(view);
        // Close sidebar on mobile
        document.getElementById('adminSidebar')?.classList.remove('open');
      });
    });

    // Support browser Back/Forward & direct URL hash changes
    window.addEventListener('hashchange', () => {
      const hash = window.location.hash.replace('#', '') || 'dashboard';
      if (hash !== this.currentView) {
        this.navigateTo(hash);
      }
    });

    // Mobile sidebar toggle
    const toggle = document.getElementById('adminSidebarToggle');
    const sidebar = document.getElementById('adminSidebar');
    toggle?.addEventListener('click', () => {
      sidebar?.classList.toggle('open');
    });
  },

  // Setup form submission listeners
  setupModals() {
    // Vehicle Form
    const vForm = document.getElementById('vehicleForm');
    vForm?.addEventListener('submit', async (e) => {
      e.preventDefault();
      await this.saveVehicle();
    });

    // Gallery Form
    const gForm = document.getElementById('galleryForm');
    gForm?.addEventListener('submit', async (e) => {
      e.preventDefault();
      await this.saveGalleryItem();
    });
  },

  // Navigate to a specific view
  navigateTo(viewName) {
    if (!document.getElementById(`view-${viewName}`)) {
      viewName = 'dashboard';
    }

    this.currentView = viewName;
    window.location.hash = viewName;

    // Update active nav link
    document.querySelectorAll('.admin-nav-item').forEach(el => el.classList.remove('active'));
    document.querySelector(`.admin-nav-item[data-view="${viewName}"]`)?.classList.add('active');

    // Update active section
    document.querySelectorAll('.admin-view').forEach(el => el.classList.remove('active'));
    document.getElementById(`view-${viewName}`)?.classList.add('active');

    // Update page title
    const titles = {
      dashboard: 'Dashboard',
      vehicles: 'Vehicle Catalog Management',
      categories: 'Vehicle Categories',
      gallery: 'Gallery Photos',
      enquiries: 'Customer Enquiries & Requests',
      orders: 'Assigned Load Orders & Trips',
      drivers: 'Registered Drivers & Applications',
      content: 'Website Content Management',
      reports: 'Reports & PDF Export',
      settings: 'Company Settings'
    };
    const titleEl = document.getElementById('pageTitle');
    if (titleEl) titleEl.textContent = titles[viewName] || 'Admin Portal';

    // Render corresponding view
    this.refreshCurrentView();
  },

  // Refresh active view
  async refreshCurrentView() {
    switch (this.currentView) {
      case 'dashboard':
        await this.loadDashboard();
        break;
      case 'vehicles':
        await this.loadVehicles();
        break;
      case 'categories':
        await this.loadCategories();
        break;
      case 'gallery':
        await this.loadGallery();
        break;
      case 'enquiries':
        await this.loadEnquiries();
        break;
      case 'orders':
        await this.loadOrders();
        break;
      case 'drivers':
        await this.loadDrivers();
        break;
      case 'content':
        await this.loadContent();
        break;
      case 'reports':
        await this.loadReportsView();
        break;
      case 'settings':
        await this.loadSettings();
        break;
    }
  },

  // Load initial global data
  async loadInitialData() {
    try {
      await this.loadCategoriesData();
      await this.loadDashboard();
    } catch (e) {
      console.error('Initial load error:', e);
    }
  },

  // ---------------------------------------------------------------------------
  // 1. DASHBOARD
  // ---------------------------------------------------------------------------
  async loadDashboard() {
    const res = await AdminAPI.getStats();
    if (!res || !res.success) return;

    this.data.stats = res.stats;

    // Stat Cards
    document.getElementById('statTotalVehicles').textContent = res.stats.totalVehicles;
    document.getElementById('statTotalCategories').textContent = res.stats.totalCategories;
    document.getElementById('statNewEnquiries').textContent = res.stats.newEnquiries;
    document.getElementById('statTotalDrivers').textContent = res.stats.totalDrivers;

    // Sidebar Badges
    document.getElementById('navVehiclesCount').textContent = res.stats.totalVehicles;
    document.getElementById('navCategoriesCount').textContent = res.stats.totalCategories;
    
    const enqBadge = document.getElementById('navEnquiriesBadge');
    if (enqBadge) {
      enqBadge.textContent = res.stats.newEnquiries;
      enqBadge.style.display = res.stats.newEnquiries > 0 ? 'inline-block' : 'none';
    }

    const ordBadge = document.getElementById('navOrdersBadge');
    if (ordBadge) {
      ordBadge.textContent = res.stats.activeAssignments || 0;
    }

    const drvBadge = document.getElementById('navDriversBadge');
    if (drvBadge) {
      drvBadge.textContent = res.stats.pendingDrivers;
      drvBadge.style.display = res.stats.pendingDrivers > 0 ? 'inline-block' : 'none';
    }

    // Recent Enquiries
    const enqBody = document.getElementById('dashRecentEnquiries');
    if (res.recentEnquiries && res.recentEnquiries.length > 0) {
      enqBody.innerHTML = res.recentEnquiries.map(e => `
        <tr>
          <td>
            <strong>${e.name}</strong><br />
            <span style="font-size: 0.8rem; color: var(--text-muted);">${e.phone}</span>
          </td>
          <td>
            <span style="font-size: 0.85rem;">${e.pickup_city || '-'} → ${e.drop_city || '-'}</span><br />
            <span style="font-size: 0.75rem; color: var(--brand-accent);">${e.quantity || ''} ${e.goods_category || ''}</span>
          </td>
          <td>
            <span style="font-size: 0.85rem; color: ${e.assigned_driver_name ? '#4ade80' : 'var(--text-muted)'};">
              ${e.assigned_driver_name ? `🚚 ${e.assigned_driver_name}` : 'Unassigned'}
            </span>
          </td>
          <td>
            <span class="status-badge status-${e.status}">${e.status.toUpperCase()}</span>
          </td>
        </tr>
      `).join('');
    } else {
      enqBody.innerHTML = `<tr><td colspan="4" style="text-align: center; color: var(--text-muted);">No enquiries recorded yet.</td></tr>`;
    }

    // Recent Drivers
    const drvBody = document.getElementById('dashRecentDrivers');
    if (res.recentDrivers && res.recentDrivers.length > 0) {
      drvBody.innerHTML = res.recentDrivers.map(d => `
        <tr>
          <td>
            <strong>${d.full_name}</strong><br />
            <span style="font-size: 0.8rem; color: var(--text-muted);">${d.phone}</span>
          </td>
          <td>${d.location}</td>
          <td>
            <span style="font-size: 0.85rem; text-transform: capitalize;">${d.vehicle_type}</span><br />
            <span style="font-size: 0.75rem; color: var(--brand-accent);">${d.vehicle_number}</span>
          </td>
          <td>
            <span class="status-badge status-${d.status}">${d.status.toUpperCase()}</span>
          </td>
        </tr>
      `).join('');
    } else {
      drvBody.innerHTML = `<tr><td colspan="4" style="text-align: center; color: var(--text-muted);">No drivers registered yet.</td></tr>`;
    }
  },

  // ---------------------------------------------------------------------------
  // 2. VEHICLE CATEGORIES
  // ---------------------------------------------------------------------------
  async loadCategoriesData() {
    const res = await AdminAPI.getCategories();
    if (res && res.success) {
      this.data.categories = res.data;
      this.populateCategoryDropdowns();
    }
  },

  populateCategoryDropdowns() {
    const cats = this.data.categories || [];
    
    // Vehicle Form Category Select
    const vCatSelect = document.getElementById('vFormCategory');
    if (vCatSelect) {
      vCatSelect.innerHTML = cats.map(c => `<option value="${c.id}">${c.name} (${c.capacityInfo || ''})</option>`).join('');
    }

    // Vehicle Filter Category Select
    const vFilterSelect = document.getElementById('vehicleCategoryFilter');
    if (vFilterSelect) {
      const currentVal = vFilterSelect.value;
      vFilterSelect.innerHTML = '<option value="all">All Categories</option>' + 
        cats.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
      vFilterSelect.value = currentVal || 'all';
    }

    // Gallery Category Select
    const gCatSelect = document.getElementById('gFormCategory');
    if (gCatSelect) {
      gCatSelect.innerHTML = cats.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
    }

    // Reports Vehicle Category Select
    const repCatSelect = document.getElementById('reportVehicleCategory');
    if (repCatSelect) {
      repCatSelect.innerHTML = '<option value="all">All Categories</option>' + 
        cats.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
    }
  },

  async loadCategories() {
    await this.loadCategoriesData();
    const tbody = document.getElementById('categoriesTableBody');
    if (!tbody) return;

    const cats = this.data.categories;
    if (cats.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: var(--text-muted);">No categories defined. Click "+ Add Category" to create one.</td></tr>`;
      return;
    }

    tbody.innerHTML = cats.map(c => `
      <tr>
        <td>
          <img src="${c.image || '/assets/images/vehicles/small-pickup.jpg'}" alt="${c.name}" style="width: 48px; height: 36px; object-fit: cover; border-radius: 4px;" onerror="this.src='/assets/images/vehicles/small-pickup.jpg'" />
        </td>
        <td>
          <strong style="color: #ffffff;">${c.name}</strong>
          <p style="font-size: 0.8rem; color: var(--text-muted); margin: 0;">${c.description || ''}</p>
        </td>
        <td><code>${c.id}</code></td>
        <td><span style="color: var(--brand-accent); font-weight: 600; font-size: 0.85rem;">${c.capacityInfo || '-'}</span></td>
        <td>${c.displayOrder || 0}</td>
        <td>
          <button class="status-badge ${c.status === 'active' ? 'status-contacted' : 'status-closed'}" style="cursor: pointer; border: none;" onclick="AdminApp.toggleCategoryStatus('${c.id}', '${c.status}')">
            ${c.status === 'active' ? 'ACTIVE' : 'HIDDEN'}
          </button>
        </td>
        <td style="text-align: right;">
          <button class="btn btn-secondary btn-sm" onclick="AdminApp.openCategoryModal('${c.id}')">Edit</button>
          <button class="btn btn-danger btn-sm" onclick="AdminApp.deleteCategory('${c.id}')">Delete</button>
        </td>
      </tr>
    `).join('');
  },

  openCategoryModal(catId = null) {
    const modal = document.getElementById('categoryModal');
    const form = document.getElementById('categoryForm');
    const title = document.getElementById('categoryModalTitle');
    if (!modal || !form) return;

    form.reset();

    if (catId) {
      const cat = this.data.categories.find(c => c.id === catId);
      if (cat) {
        title.textContent = 'Edit Vehicle Category';
        document.getElementById('catFormId').value = cat.id;
        document.getElementById('catFormName').value = cat.name;
        document.getElementById('catFormCapacity').value = cat.capacityInfo || '';
        document.getElementById('catFormDesc').value = cat.description || '';
        document.getElementById('catFormImageUrl').value = cat.image || '';
        document.getElementById('catFormOrder').value = cat.displayOrder || 1;
        document.getElementById('catFormStatus').value = cat.status || 'active';
      }
    } else {
      title.textContent = 'Add Vehicle Category';
      document.getElementById('catFormId').value = '';
      document.getElementById('catFormOrder').value = (this.data.categories.length + 1);
    }

    openModal('categoryModal');
  },

  async saveCategory(e) {
    e.preventDefault();
    const id = document.getElementById('catFormId').value;
    const payload = {
      name: document.getElementById('catFormName').value.trim(),
      capacityInfo: document.getElementById('catFormCapacity').value.trim(),
      description: document.getElementById('catFormDesc').value.trim(),
      image: document.getElementById('catFormImageUrl').value.trim(),
      displayOrder: document.getElementById('catFormOrder').value,
      status: document.getElementById('catFormStatus').value
    };

    let res;
    if (id) {
      res = await AdminAPI.updateCategory(id, payload);
    } else {
      res = await AdminAPI.createCategory(payload);
    }

    if (res && res.success) {
      closeModal('categoryModal');
      await this.loadCategories();
      alert('Category saved successfully!');
    } else {
      alert(res?.message || 'Failed to save category');
    }
  },

  async toggleCategoryStatus(catId, currentStatus) {
    const nextStatus = currentStatus === 'active' ? 'inactive' : 'active';
    await AdminAPI.updateCategoryStatus(catId, nextStatus);
    await this.loadCategories();
  },

  async deleteCategory(catId) {
    if (!confirm(`Are you sure you want to delete category "${catId}"?`)) return;
    const res = await AdminAPI.deleteCategory(catId);
    if (res && res.success) {
      await this.loadCategories();
    } else {
      alert(res?.message || 'Failed to delete category');
    }
  },

  async handleCategoryImageUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    try {
      const res = await AdminAPI.uploadImage(file);
      if (res && res.success) {
        document.getElementById('catFormImageUrl').value = res.url;
      }
    } catch (e) {
      alert('Failed to upload image');
    }
  },

  handleCategorySearch() {
    const term = document.getElementById('categorySearchInput').value.toLowerCase();
    const rows = document.querySelectorAll('#categoriesTableBody tr');
    rows.forEach(r => {
      const text = r.textContent.toLowerCase();
      r.style.display = text.includes(term) ? '' : 'none';
    });
  },

  // ---------------------------------------------------------------------------
  // 3. VEHICLES CRUD
  // ---------------------------------------------------------------------------
  async loadVehicles() {
    await this.loadCategoriesData();

    const category = document.getElementById('vehicleCategoryFilter')?.value || 'all';
    const status = document.getElementById('vehicleStatusFilter')?.value || 'all';
    const search = document.getElementById('vehicleSearchInput')?.value || '';

    const res = await AdminAPI.getVehicles(category, search);
    const tbody = document.getElementById('vehiclesTableBody');
    if (!tbody) return;

    if (!res || !res.success || res.data.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: var(--text-muted);">No vehicles match your filter.</td></tr>`;
      return;
    }

    let list = res.data;
    if (status !== 'all') {
      list = list.filter(v => v.status === status);
    }

    this.data.vehicles = list;

    tbody.innerHTML = list.map(v => {
      const catObj = this.data.categories.find(c => c.id === v.category);
      const catLabel = catObj ? catObj.name : v.category.toUpperCase();

      return `
      <tr>
        <td>
          <img src="${v.image}" alt="${v.name}" style="width: 52px; height: 38px; object-fit: cover; border-radius: 4px;" onerror="this.src='/assets/images/vehicles/mini-pickup.jpg'" />
        </td>
        <td>
          <strong style="color: #ffffff; font-size: 0.95rem;">${v.name}</strong>
          ${v.badge ? `<br /><span class="badge badge-gold" style="font-size: 0.7rem; padding: 1px 6px;">${v.badge}</span>` : ''}
        </td>
        <td><span class="badge badge-green" style="font-size: 0.75rem;">${catLabel}</span></td>
        <td>
          <strong style="color: var(--brand-accent); font-size: 0.85rem;">${v.capacityKg}</strong><br />
          <span style="font-size: 0.8rem; color: var(--text-muted);">${v.capacityBoxes} • ${v.bedSize}</span>
        </td>
        <td>${v.displayOrder || 0}</td>
        <td>
          <button class="status-badge ${v.status === 'active' ? 'status-contacted' : 'status-closed'}" style="cursor: pointer; border: none;" onclick="AdminApp.toggleVehicleStatus('${v.id}', '${v.status}')">
            ${v.status === 'active' ? 'ACTIVE' : 'HIDDEN'}
          </button>
        </td>
        <td style="text-align: right;">
          <button class="btn btn-secondary btn-sm" onclick="AdminApp.openVehicleModal('${v.id}')">Edit</button>
          <button class="btn btn-danger btn-sm" onclick="AdminApp.deleteVehicle('${v.id}')">Delete</button>
        </td>
      </tr>
      `;
    }).join('');
  },

  openVehicleModal(vehicleId = null) {
    const modal = document.getElementById('vehicleModal');
    const form = document.getElementById('vehicleForm');
    const title = document.getElementById('vehicleModalTitle');
    if (!modal || !form) return;

    form.reset();
    this.populateCategoryDropdowns();

    if (vehicleId) {
      const v = this.data.vehicles.find(item => item.id === vehicleId);
      if (v) {
        title.textContent = `Edit Vehicle: ${v.name}`;
        document.getElementById('vFormId').value = v.id;
        document.getElementById('vFormName').value = v.name;
        document.getElementById('vFormCategory').value = v.category;
        document.getElementById('vFormCapacityKg').value = v.capacityKg;
        document.getElementById('vFormCapacityBoxes').value = v.capacityBoxes;
        document.getElementById('vFormBedSize').value = v.bedSize;
        document.getElementById('vFormBadge').value = v.badge || '';
        
        const bestFor = Array.isArray(v.bestFor) ? v.bestFor : (typeof v.bestFor === 'string' ? JSON.parse(v.bestFor || '[]') : []);
        document.getElementById('vFormBestFor').value = bestFor.join('\n');

        document.getElementById('vFormDesc').value = v.description || '';
        document.getElementById('vFormImageUrl').value = v.image;
        document.getElementById('vFormOrder').value = v.displayOrder || 1;
        document.getElementById('vFormStatus').value = v.status || 'active';
      }
    } else {
      title.textContent = 'Add New Vehicle';
      document.getElementById('vFormId').value = '';
      document.getElementById('vFormOrder').value = (this.data.vehicles.length + 1);
    }

    openModal('vehicleModal');
  },

  async saveVehicle() {
    const id = document.getElementById('vFormId').value;
    const bestForLines = document.getElementById('vFormBestFor').value
      .split('\n')
      .map(s => s.trim())
      .filter(Boolean);

    const payload = {
      name: document.getElementById('vFormName').value.trim(),
      category: document.getElementById('vFormCategory').value,
      capacityKg: document.getElementById('vFormCapacityKg').value.trim(),
      capacityBoxes: document.getElementById('vFormCapacityBoxes').value.trim(),
      bedSize: document.getElementById('vFormBedSize').value.trim(),
      badge: document.getElementById('vFormBadge').value.trim(),
      bestFor: bestForLines,
      description: document.getElementById('vFormDesc').value.trim(),
      image: document.getElementById('vFormImageUrl').value.trim() || '/assets/images/vehicles/mini-pickup.jpg',
      displayOrder: document.getElementById('vFormOrder').value,
      status: document.getElementById('vFormStatus').value
    };

    let res;
    if (id) {
      res = await AdminAPI.updateVehicle(id, payload);
    } else {
      res = await AdminAPI.createVehicle(payload);
    }

    if (res && res.success) {
      closeModal('vehicleModal');
      await this.loadVehicles();
      alert('Vehicle saved successfully!');
    } else {
      alert(res?.message || 'Failed to save vehicle');
    }
  },

  async toggleVehicleStatus(id, currentStatus) {
    const nextStatus = currentStatus === 'active' ? 'inactive' : 'active';
    await AdminAPI.updateVehicleStatus(id, nextStatus);
    await this.loadVehicles();
  },

  async deleteVehicle(id) {
    if (!confirm('Are you sure you want to delete this vehicle?')) return;
    const res = await AdminAPI.deleteVehicle(id);
    if (res && res.success) {
      await this.loadVehicles();
    } else {
      alert(res?.message || 'Failed to delete vehicle');
    }
  },

  async handleVehicleImageUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    try {
      const res = await AdminAPI.uploadImage(file);
      if (res && res.success) {
        document.getElementById('vFormImageUrl').value = res.url;
      }
    } catch (e) {
      alert('Failed to upload image');
    }
  },

  handleVehicleSearch() {
    this.loadVehicles();
  },

  handleVehicleCategoryFilter() {
    this.loadVehicles();
  },

  handleVehicleStatusFilter() {
    this.loadVehicles();
  },

  // ---------------------------------------------------------------------------
  // 4. GALLERY
  // ---------------------------------------------------------------------------
  async loadGallery() {
    const category = document.getElementById('galleryCategoryFilter')?.value || 'all';
    const res = await AdminAPI.getGallery(category);
    const grid = document.getElementById('adminGalleryGrid');
    if (!grid) return;

    if (!res || !res.success || res.data.length === 0) {
      grid.innerHTML = `<p style="grid-column: 1/-1; text-align: center; color: var(--text-muted); padding: 40px;">No gallery photos found.</p>`;
      return;
    }

    this.data.gallery = res.data;

    grid.innerHTML = res.data.map(g => `
      <div class="admin-gallery-card">
        <img src="${g.imageUrl}" alt="${g.title}" onerror="this.src='/assets/images/vehicles/mini-pickup.jpg'" />
        <div class="admin-gallery-card-body">
          <h5 style="color: #ffffff; font-size: 0.9rem; margin-bottom: 4px;">${g.title}</h5>
          <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 10px;">
            <span class="badge badge-green" style="font-size: 0.7rem; text-transform: uppercase;">${g.category}</span>
            <div>
              <button class="btn btn-danger btn-sm" style="padding: 3px 8px; font-size: 0.75rem;" onclick="AdminApp.deleteGalleryItem(${g.id})">Delete</button>
            </div>
          </div>
        </div>
      </div>
    `).join('');
  },

  openGalleryModal() {
    document.getElementById('galleryForm')?.reset();
    this.populateCategoryDropdowns();
    openModal('galleryModal');
  },

  async saveGalleryItem() {
    const payload = {
      title: document.getElementById('gFormTitle').value.trim(),
      category: document.getElementById('gFormCategory').value,
      imageUrl: document.getElementById('gFormImageUrl').value.trim(),
      displayOrder: document.getElementById('gFormOrder').value
    };

    const res = await AdminAPI.createGalleryItem(payload);
    if (res && res.success) {
      closeModal('galleryModal');
      await this.loadGallery();
      alert('Photo added to gallery!');
    } else {
      alert(res?.message || 'Failed to add gallery photo');
    }
  },

  async deleteGalleryItem(id) {
    if (!confirm('Are you sure you want to delete this gallery photo?')) return;
    const res = await AdminAPI.deleteGalleryItem(id);
    if (res && res.success) {
      await this.loadGallery();
    }
  },

  async handleGalleryImageUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    try {
      const res = await AdminAPI.uploadImage(file);
      if (res && res.success) {
        document.getElementById('gFormImageUrl').value = res.url;
      }
    } catch (e) {
      alert('Failed to upload image');
    }
  },

  handleGalleryFilter() {
    this.loadGallery();
  },

  // ---------------------------------------------------------------------------
  // 5. ENQUIRIES & ASSIGNMENTS
  // ---------------------------------------------------------------------------
  async loadEnquiries() {
    const status = document.getElementById('enquiryStatusFilter')?.value || 'all';
    const assignmentStatus = document.getElementById('enquiryAssignmentFilter')?.value || 'all';
    const search = document.getElementById('enquirySearchInput')?.value || '';

    const res = await AdminAPI.getEnquiries({ status, assignmentStatus, search });
    const tbody = document.getElementById('enquiriesTableBody');
    if (!tbody) return;

    if (!res || !res.success || res.data.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: var(--text-muted);">No enquiries found.</td></tr>`;
      return;
    }

    this.data.enquiries = res.data;

    tbody.innerHTML = res.data.map(e => {
      const isAssigned = !!e.assigned_driver_name || !!e.assigned_person;
      const status = e.assignment_status || 'Pending';
      const assignBadgeColor = {
        'Pending': 'status-pending',
        'Assigned': 'status-contacted',
        'Waiting for Driver Confirmation': 'badge-gold',
        'Driver Confirmed': 'status-approved',
        'In Progress': 'badge-gold',
        'Completed': 'status-approved',
        'Cancelled': 'status-rejected',
        'Cancelled - Driver Did Not Confirm': 'status-rejected'
      }[status] || 'status-pending';

      let timerHtml = '';
      if (status === 'Waiting for Driver Confirmation' && e.driver_confirmation_deadline) {
        const remainingMs = new Date(e.driver_confirmation_deadline).getTime() - Date.now();
        if (remainingMs > 0) {
          const mins = Math.floor(remainingMs / 60000);
          const secs = Math.floor((remainingMs % 60000) / 1000);
          timerHtml = `<div style="font-size: 0.72rem; color: var(--brand-accent); margin-top: 3px; font-weight: 600;">⏱️ ${mins}m ${secs}s left (Driver has 5m to confirm)</div>`;
        } else {
          timerHtml = `<div style="font-size: 0.72rem; color: #ef4444; margin-top: 3px;">⚠️ Confirmation window expired</div>`;
        }
      } else if (status === 'Cancelled - Driver Did Not Confirm') {
        timerHtml = `<div style="font-size: 0.72rem; color: #ef4444; margin-top: 3px;">Driver did not confirm within 5 minutes. Order automatically cancelled.</div>`;
      }

      return `
      <tr>
        <td>
          <strong style="color: var(--brand-accent); font-size: 0.85rem;">${e.request_code || `#${e.id}`}</strong><br />
          <span style="font-size: 0.75rem; color: var(--text-muted);">${new Date(e.created_at).toLocaleDateString('en-IN')}</span>
        </td>
        <td>
          <strong style="color: #ffffff;">${e.name}</strong><br />
          <a href="tel:${e.phone}" style="color: #4ade80; font-size: 0.85rem; text-decoration: none;">📞 ${e.phone}</a>
        </td>
        <td>
          <div style="font-size: 0.85rem; font-weight: 600; color: #ffffff;">
            <span>${e.pickup_city || 'Not specified'}${e.pickup_district ? `, ${e.pickup_district}` : ''}${e.pickup_state ? ` (${e.pickup_state})` : ''}</span>
            <span style="color: var(--text-muted); margin: 0 4px;">→</span>
            <span>${e.drop_city || 'Not specified'}${e.drop_district ? `, ${e.drop_district}` : ''}${e.drop_state ? ` (${e.drop_state})` : ''}</span>
          </div>
          ${e.pickup_address ? `<div style="font-size: 0.76rem; color: #cbd5e1; margin-top: 3px;">📍 <strong>Pickup:</strong> ${e.pickup_address}</div>` : ''}
          ${e.drop_address ? `<div style="font-size: 0.76rem; color: #cbd5e1; margin-top: 2px;">🎯 <strong>Drop:</strong> ${e.drop_address}</div>` : ''}
          <div style="margin-top: 4px; display: flex; gap: 4px; flex-wrap: wrap;">
            ${(e.pickup_latitude && e.pickup_longitude) ? `
              <button type="button" class="btn btn-secondary btn-sm" style="padding: 2px 8px; font-size: 0.72rem; display: inline-flex; align-items: center; gap: 4px;" onclick="AdminApp.viewPickupMap(${e.id})">
                <span>📍 Pickup Map</span>
              </button>
            ` : ''}
            ${(e.drop_latitude && e.drop_longitude) ? `
              <button type="button" class="btn btn-secondary btn-sm" style="padding: 2px 8px; font-size: 0.72rem; display: inline-flex; align-items: center; gap: 4px;" onclick="AdminApp.viewDropMap(${e.id})">
                <span>🎯 Drop Map</span>
              </button>
            ` : ''}
          </div>
        </td>
        <td>
          <span style="font-size: 0.85rem;">${e.quantity || ''} ${e.goods_category || ''}</span>
          ${e.vehicle_preferred ? `<br /><span style="font-size: 0.75rem; color: var(--brand-accent);">Vehicle: ${e.vehicle_preferred}</span>` : ''}
          ${e.message ? `<br /><span style="font-size: 0.75rem; color: var(--text-muted); font-style: italic;">"${e.message}"</span>` : ''}
        </td>
        <td>
          ${isAssigned ? `
            <strong style="color: #4ade80; font-size: 0.85rem;">🚚 ${e.assigned_driver_name || e.assigned_person}</strong>
            ${e.assigned_driver_phone ? `<br /><span style="font-size: 0.75rem; color: var(--text-muted);">${e.assigned_driver_phone}</span>` : ''}
          ` : `
            <span style="color: var(--text-muted); font-size: 0.85rem;">Not Assigned</span>
          `}
          <br /><span class="status-badge ${assignBadgeColor}" style="font-size: 0.7rem; margin-top: 4px;">${status === 'Waiting for Driver Confirmation' ? 'WAITING FOR DRIVER' : status.toUpperCase()}</span>
          ${timerHtml}
        </td>
        <td>
          <select class="form-select" style="padding: 4px 8px; font-size: 0.8rem; width: auto;" onchange="AdminApp.updateEnquiryStatus(${e.id}, this.value)">
            <option value="new" ${e.status === 'new' ? 'selected' : ''}>New</option>
            <option value="contacted" ${e.status === 'contacted' ? 'selected' : ''}>Contacted</option>
            <option value="closed" ${e.status === 'closed' ? 'selected' : ''}>Closed</option>
          </select>
        </td>
        <td style="text-align: right;">
          <button class="btn btn-primary btn-sm" onclick="AdminApp.openAssignEnquiryModal(${e.id})">
            ${isAssigned ? 'Reassign' : 'Assign Driver'}
          </button>
          <button class="btn btn-danger btn-sm" onclick="AdminApp.deleteEnquiry(${e.id})">✕</button>
        </td>
      </tr>
      `;
    }).join('');
  },

  async openAssignEnquiryModal(enquiryId) {
    const modal = document.getElementById('assignEnquiryModal');
    const enquiry = this.data.enquiries.find(e => e.id === enquiryId) || this.data.orders.find(o => o.id === enquiryId);
    if (!modal || !enquiry) return;

    document.getElementById('assignEnquiryId').value = enquiry.id;
    document.getElementById('assignEnquirySubtitle').textContent = `Request ${enquiry.request_code || enquiry.id}: ${enquiry.name} (${enquiry.pickup_city || ''} → ${enquiry.drop_city || ''})`;

    const nameEl = document.getElementById('assignEnquiryCustomerName');
    if (nameEl) nameEl.textContent = `${enquiry.name} (📞 ${enquiry.phone || 'N/A'})`;

    const addrEl = document.getElementById('assignEnquiryPickupAddress');
    if (addrEl) {
      const fullPickup = [enquiry.pickup_address, enquiry.pickup_city, enquiry.pickup_district, enquiry.pickup_state].filter(Boolean).join(', ');
      const fullDrop = [enquiry.drop_address, enquiry.drop_city, enquiry.drop_district, enquiry.drop_state].filter(Boolean).join(', ');
      addrEl.innerHTML = `
        <div><strong>📍 Pickup:</strong> ${fullPickup || 'Not specified'}</div>
        <div style="margin-top: 2px;"><strong>🎯 Drop:</strong> ${fullDrop || 'Not specified'}</div>
      `;
    }

    const mapBtnContainer = document.getElementById('assignEnquiryMapBtnContainer');
    if (mapBtnContainer) {
      let buttons = [];
      if (enquiry.pickup_latitude && enquiry.pickup_longitude) {
        buttons.push(`
          <button type="button" class="btn btn-secondary btn-sm" style="padding: 2px 8px; font-size: 0.75rem;" onclick="AdminApp.viewPickupMap(${enquiry.id})">
            📍 View Pickup Map
          </button>
        `);
      }
      if (enquiry.drop_latitude && enquiry.drop_longitude) {
        buttons.push(`
          <button type="button" class="btn btn-secondary btn-sm" style="padding: 2px 8px; font-size: 0.75rem;" onclick="AdminApp.viewDropMap(${enquiry.id})">
            🎯 View Drop Map
          </button>
        `);
      }
      if (buttons.length > 0) {
        mapBtnContainer.innerHTML = `<div style="display: flex; gap: 6px; flex-wrap: wrap;">${buttons.join('')}</div>`;
      } else {
        mapBtnContainer.innerHTML = `<span style="font-size: 0.72rem; color: var(--text-muted);">No GPS coordinates attached to this enquiry.</span>`;
      }
    }

    // Load Drivers for select dropdown
    const drvRes = await AdminAPI.getDrivers('all');
    const driverSelect = document.getElementById('assignDriverSelect');
    if (driverSelect && drvRes && drvRes.data) {
      driverSelect.innerHTML = '<option value="">-- Choose Registered Driver --</option>' + 
        drvRes.data.map(d => `<option value="${d.id}" data-name="${d.full_name}" data-phone="${d.phone}">${d.full_name} (${d.vehicle_type} - ${d.vehicle_number})</option>`).join('');

      if (enquiry.assigned_driver_id) {
        driverSelect.value = enquiry.assigned_driver_id;
      }
    }

    document.getElementById('assignPersonInput').value = enquiry.assigned_person || '';
    document.getElementById('assignStatusSelect').value = enquiry.assignment_status || 'Waiting for Driver Confirmation';
    document.getElementById('assignNotesText').value = enquiry.admin_notes || '';

    openModal('assignEnquiryModal');
  },

  async saveEnquiryAssignment(e) {
    e.preventDefault();
    const id = document.getElementById('assignEnquiryId').value;
    const driverSelect = document.getElementById('assignDriverSelect');
    const selectedDriverOpt = driverSelect.options[driverSelect.selectedIndex];

    const driverId = driverSelect.value ? parseInt(driverSelect.value, 10) : null;
    const driverName = driverId ? selectedDriverOpt.getAttribute('data-name') : null;
    const driverPhone = driverId ? selectedDriverOpt.getAttribute('data-phone') : null;
    const assignedPerson = document.getElementById('assignPersonInput').value.trim();
    const assignmentStatus = document.getElementById('assignStatusSelect').value;
    const adminNotes = document.getElementById('assignNotesText').value.trim();

    const res = await AdminAPI.assignEnquiry(id, {
      driverId,
      driverName,
      driverPhone,
      assignedPerson,
      assignmentStatus,
      adminNotes
    });

    if (res && res.success) {
      closeModal('assignEnquiryModal');
      await this.loadEnquiries();
      if (this.currentView === 'orders') await this.loadOrders();
      alert(driverId ? `Driver assigned! A 5-minute confirmation timer has started and an email notification was dispatched.` : 'Assignment saved successfully!');
    } else {
      alert(res?.message || 'Failed to save assignment');
    }
  },

  async updateEnquiryStatus(id, status) {
    await AdminAPI.updateEnquiryStatus(id, status);
  },

  async deleteEnquiry(id) {
    if (!confirm('Are you sure you want to delete this enquiry?')) return;
    const res = await AdminAPI.deleteEnquiry(id);
    if (res && res.success) {
      await this.loadEnquiries();
    }
  },

  handleEnquirySearch() {
    this.loadEnquiries();
  },

  handleEnquiryStatusFilter() {
    this.loadEnquiries();
  },

  handleEnquiryAssignmentFilter() {
    this.loadEnquiries();
  },

  // ---------------------------------------------------------------------------
  // 6. ORDERS VIEW
  // ---------------------------------------------------------------------------
  async loadOrders() {
    const assignmentStatus = document.getElementById('orderAssignmentFilter')?.value || 'all';
    const driverId = document.getElementById('orderDriverFilter')?.value || 'all';
    const search = document.getElementById('orderSearchInput')?.value || '';

    // Populate drivers dropdown in orders view if needed
    const drvRes = await AdminAPI.getDrivers('all');
    const drvFilter = document.getElementById('orderDriverFilter');
    if (drvFilter && drvRes && drvRes.data) {
      const cur = drvFilter.value;
      drvFilter.innerHTML = '<option value="all">All Drivers</option>' + 
        drvRes.data.map(d => `<option value="${d.id}">${d.full_name}</option>`).join('');
      drvFilter.value = cur || 'all';
    }

    const res = await AdminAPI.getEnquiries({ assignmentStatus, driverId, search });
    const tbody = document.getElementById('ordersTableBody');
    if (!tbody) return;

    if (!res || !res.success || res.data.length === 0) {
      tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; color: var(--text-muted);">No orders found.</td></tr>`;
      return;
    }

    this.data.orders = res.data;

    tbody.innerHTML = res.data.map(o => {
      const status = o.assignment_status || 'Pending';
      const statusClass = {
        'Pending': 'status-pending',
        'Assigned': 'status-contacted',
        'Waiting for Driver Confirmation': 'badge-gold',
        'Driver Confirmed': 'status-approved',
        'In Progress': 'badge-gold',
        'Completed': 'status-approved',
        'Cancelled': 'status-rejected',
        'Cancelled - Driver Did Not Confirm': 'status-rejected'
      }[status] || 'status-pending';

      let timerInfo = '';
      if (status === 'Waiting for Driver Confirmation' && o.driver_confirmation_deadline) {
        const remainingMs = new Date(o.driver_confirmation_deadline).getTime() - Date.now();
        if (remainingMs > 0) {
          const mins = Math.floor(remainingMs / 60000);
          const secs = Math.floor((remainingMs % 60000) / 1000);
          timerInfo = `
            <div style="font-size: 0.72rem; color: var(--brand-accent); margin-top: 3px; font-weight: 600;">
              ⏱️ ${mins}m ${secs}s remaining
            </div>
            <div style="font-size: 0.7rem; color: var(--text-muted);">Driver has 5 minutes to confirm.</div>
          `;
        } else {
          timerInfo = `<div style="font-size: 0.72rem; color: #ef4444; margin-top: 3px;">⚠️ 5m confirmation window expired</div>`;
        }
      } else if (status === 'Cancelled - Driver Did Not Confirm') {
        timerInfo = `<div style="font-size: 0.72rem; color: #ef4444; margin-top: 3px; line-height: 1.2;">Driver did not confirm within 5 minutes. Order automatically cancelled.</div>`;
      } else if (status === 'Driver Confirmed' && o.driver_confirmed_at) {
        timerInfo = `<div style="font-size: 0.72rem; color: #4ade80; margin-top: 3px;">Confirmed: ${new Date(o.driver_confirmed_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</div>`;
      }

      return `
      <tr>
        <td><strong style="color: var(--brand-accent); font-size: 0.85rem;">${o.request_code || `#${o.id}`}</strong></td>
        <td>
          <strong style="color: #ffffff;">${o.name}</strong><br />
          <span style="font-size: 0.8rem; color: var(--text-muted);">${o.phone}</span>
        </td>
        <td>
          <div style="font-size: 0.85rem; font-weight: 600; color: #ffffff;">
            <span>${o.pickup_city || '-'}${o.pickup_district ? `, ${o.pickup_district}` : ''}${o.pickup_state ? ` (${o.pickup_state})` : ''}</span>
            <span style="color: var(--text-muted); margin: 0 4px;">→</span>
            <span>${o.drop_city || '-'}${o.drop_district ? `, ${o.drop_district}` : ''}${o.drop_state ? ` (${o.drop_state})` : ''}</span>
          </div>
          ${o.pickup_address ? `<div style="font-size: 0.76rem; color: #cbd5e1; margin-top: 3px;">📍 <strong>Pickup:</strong> ${o.pickup_address}</div>` : ''}
          ${o.drop_address ? `<div style="font-size: 0.76rem; color: #cbd5e1; margin-top: 2px;">🎯 <strong>Drop:</strong> ${o.drop_address}</div>` : ''}
          <div style="margin-top: 4px; display: flex; gap: 4px; flex-wrap: wrap;">
            ${(o.pickup_latitude && o.pickup_longitude) ? `
              <button type="button" class="btn btn-secondary btn-sm" style="padding: 2px 8px; font-size: 0.72rem; display: inline-flex; align-items: center; gap: 4px;" onclick="AdminApp.viewPickupMap(${o.id})">
                <span>📍 Pickup Map</span>
              </button>
            ` : ''}
            ${(o.drop_latitude && o.drop_longitude) ? `
              <button type="button" class="btn btn-secondary btn-sm" style="padding: 2px 8px; font-size: 0.72rem; display: inline-flex; align-items: center; gap: 4px;" onclick="AdminApp.viewDropMap(${o.id})">
                <span>🎯 Drop Map</span>
              </button>
            ` : ''}
          </div>
          <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 2px;">${o.quantity || ''} ${o.goods_category || ''}</div>
        </td>
        <td>
          <strong style="color: ${o.assigned_driver_name ? '#4ade80' : 'var(--text-muted)'}; font-size: 0.85rem;">
            ${o.assigned_driver_name ? `🚚 ${o.assigned_driver_name}` : 'Unassigned'}
          </strong>
          <br /><span class="status-badge ${statusClass}" style="font-size: 0.7rem; margin-top: 4px;">${status === 'Waiting for Driver Confirmation' ? 'WAITING FOR DRIVER' : status.toUpperCase()}</span>
          ${timerInfo}
        </td>
        <td>${o.assigned_driver_phone || '-'}</td>
        <td>
          <select class="form-select" style="padding: 4px 8px; font-size: 0.8rem; width: auto;" onchange="AdminApp.quickUpdateOrderStatus(${o.id}, this.value)">
            <option value="Pending" ${status === 'Pending' ? 'selected' : ''}>Pending</option>
            <option value="Waiting for Driver Confirmation" ${status === 'Waiting for Driver Confirmation' ? 'selected' : ''}>Waiting for Driver Confirmation</option>
            <option value="Driver Confirmed" ${status === 'Driver Confirmed' ? 'selected' : ''}>Driver Confirmed</option>
            <option value="In Progress" ${status === 'In Progress' ? 'selected' : ''}>In Progress</option>
            <option value="Completed" ${status === 'Completed' ? 'selected' : ''}>Completed</option>
            <option value="Cancelled" ${status === 'Cancelled' ? 'selected' : ''}>Cancelled</option>
            <option value="Cancelled - Driver Did Not Confirm" ${status === 'Cancelled - Driver Did Not Confirm' ? 'selected' : ''}>Cancelled - Driver Did Not Confirm</option>
          </select>
        </td>
        <td><span style="font-size: 0.8rem; color: var(--text-muted);">${new Date(o.created_at).toLocaleDateString('en-IN')}</span></td>
        <td style="text-align: right;">
          <button class="btn btn-secondary btn-sm" onclick="AdminApp.openAssignEnquiryModal(${o.id})">Edit</button>
        </td>
      </tr>
      `;
    }).join('');
  },

  async quickUpdateOrderStatus(orderId, newStatus) {
    await AdminAPI.assignEnquiry(orderId, { assignmentStatus: newStatus });
    await this.loadOrders();
  },

  handleOrderSearch() {
    this.loadOrders();
  },

  handleOrderFilter() {
    this.loadOrders();
  },

  // ---------------------------------------------------------------------------
  // 7. DRIVERS
  // ---------------------------------------------------------------------------
  async loadDrivers() {
    const status = document.getElementById('driverStatusFilter')?.value || 'all';
    const search = document.getElementById('driverSearchInput')?.value || '';

    const res = await AdminAPI.getDrivers(status, search);
    const tbody = document.getElementById('driversTableBody');
    if (!tbody) return;

    if (!res || !res.success || res.data.length === 0) {
      tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; color: var(--text-muted);">No drivers found.</td></tr>`;
      return;
    }

    this.data.drivers = res.data;

    tbody.innerHTML = res.data.map(d => `
      <tr>
        <td>
          <strong style="color: #ffffff; font-size: 0.95rem;">${d.full_name}</strong>
        </td>
        <td>
          <a href="tel:${d.phone}" style="color: #4ade80; text-decoration: none;">📞 ${d.phone}</a>
        </td>
        <td>${d.location}</td>
        <td>
          <span style="text-transform: capitalize; font-weight: 600;">${d.vehicle_type}</span><br />
          <code style="color: var(--brand-accent); font-size: 0.8rem;">${d.vehicle_number}</code>
        </td>
        <td>${d.experience} yrs</td>
        <td>
          <span class="badge ${d.active_orders > 0 ? 'badge-gold' : 'badge-green'}" style="font-size: 0.75rem;">
            ${d.active_orders || 0} active / ${d.total_assigned_orders || 0} total
          </span>
        </td>
        <td>
          <select class="form-select" style="padding: 4px 8px; font-size: 0.8rem; width: auto; font-weight: 600; color: ${d.status === 'approved' ? '#4ade80' : (d.status === 'rejected' ? '#f87171' : 'var(--brand-accent)')};" onchange="AdminApp.updateDriverStatus(${d.id}, this.value)">
            <option value="pending" ${d.status === 'pending' ? 'selected' : ''}>Pending</option>
            <option value="approved" ${d.status === 'approved' ? 'selected' : ''}>Approved</option>
            <option value="rejected" ${d.status === 'rejected' ? 'selected' : ''}>Rejected</option>
          </select>
        </td>
        <td style="text-align: right; white-space: nowrap;">
          <button class="btn btn-secondary btn-sm" onclick="AdminApp.openDriverDetailsModal(${d.id})" title="View Profile & Verification Documents">
            Details / Docs
          </button>
          <button class="btn btn-secondary btn-sm" onclick="AdminApp.openEditDriverModal(${d.id})" title="Edit Driver Profile">
            ✏️ Edit
          </button>
          <button class="btn btn-primary btn-sm" onclick="AdminApp.openDriverAssignOrderModal(${d.id}, '${d.full_name.replace(/'/g, "\\'")}', '${d.phone}')">
            Assign Order
          </button>
          <button class="btn btn-danger btn-sm" onclick="AdminApp.deleteDriver(${d.id})">✕</button>
        </td>
      </tr>
    `).join('');
  },

  async openDriverAssignOrderModal(driverId, driverName, driverPhone) {
    const modal = document.getElementById('driverAssignOrderModal');
    if (!modal) return;

    document.getElementById('driverAssignDriverId').value = driverId;
    document.getElementById('driverAssignDriverName').value = driverName;
    document.getElementById('driverAssignDriverPhone').value = driverPhone;
    document.getElementById('driverAssignTitle').textContent = `Assign Order to ${driverName}`;

    // Fetch open or pending enquiries
    const select = document.getElementById('driverOpenEnquiriesSelect');
    select.innerHTML = '<option value="">Loading available orders...</option>';

    const res = await AdminAPI.getEnquiries({ assignmentStatus: 'all' });
    if (res && res.success && res.data.length > 0) {
      select.innerHTML = '<option value="">-- Select Customer Enquiry / Order --</option>' +
        res.data.map(e => `
          <option value="${e.id}">
            ${e.request_code || `#${e.id}`} - ${e.name} (${e.pickup_city || ''} → ${e.drop_city || ''}) [${e.assignment_status || 'Pending'}]
          </option>
        `).join('');
    } else {
      select.innerHTML = '<option value="">No customer enquiries found</option>';
    }

    openModal('driverAssignOrderModal');
  },

  async confirmDriverOrderAssignment(e) {
    e.preventDefault();
    const enquiryId = document.getElementById('driverOpenEnquiriesSelect').value;
    if (!enquiryId) {
      alert('Please select an enquiry to assign.');
      return;
    }

    const driverId = parseInt(document.getElementById('driverAssignDriverId').value, 10);
    const driverName = document.getElementById('driverAssignDriverName').value;
    const driverPhone = document.getElementById('driverAssignDriverPhone').value;
    const assignmentStatus = document.getElementById('driverAssignTripStatus').value;
    const adminNotes = document.getElementById('driverAssignNotes').value.trim();

    const res = await AdminAPI.assignEnquiry(enquiryId, {
      driverId,
      driverName,
      driverPhone,
      assignmentStatus,
      adminNotes
    });

    if (res && res.success) {
      closeModal('driverAssignOrderModal');
      await this.loadDrivers();
      alert(`Trip assigned to ${driverName} successfully!`);
    } else {
      alert(res?.message || 'Failed to assign order');
    }
  },

  async openDriverDetailsModal(driverId) {
    const modal = document.getElementById('driverDetailsModal');
    const modalBody = document.getElementById('driverDetailsModalBody');
    if (!modal || !modalBody) return;

    modalBody.innerHTML = `
      <div style="text-align: center; padding: 40px 0; color: var(--text-muted);">
        <div style="font-size: 1.5rem; margin-bottom: 8px;">🔄</div>
        <p>Loading driver details & verification documents...</p>
      </div>
    `;
    openModal('driverDetailsModal');

    const res = await AdminAPI.getDriver(driverId);
    if (!res || !res.success || !res.data) {
      modalBody.innerHTML = `<div class="alert-box" style="background: rgba(239, 68, 68, 0.15); color: #f87171; padding: 14px; border-radius: 8px;">Failed to load driver details.</div>`;
      return;
    }

    const d = res.data;
    const status = (d.status || 'pending').toLowerCase();
    const statusColor = status === 'approved' ? '#4ade80' : (status === 'rejected' ? '#f87171' : 'var(--brand-accent)');
    const createdDate = d.created_at ? new Date(d.created_at).toLocaleString('en-IN') : '-';

    const photoStatus = d.photo_verification_status || 'Pending Verification';
    const licenceStatus = d.licence_verification_status || 'Pending Verification';
    const aadhaarStatus = d.aadhaar_verification_status || 'Pending Verification';

    function getDocStatusBadge(statusVal) {
      if (statusVal === 'Verified') return '<span class="badge badge-green" style="font-size: 0.7rem; padding: 2px 6px;">✔ Verified</span>';
      if (statusVal === 'Rejected') return '<span class="badge badge-red" style="font-size: 0.7rem; padding: 2px 6px; background: rgba(239,68,68,0.2); color: #f87171;">✕ Rejected</span>';
      return '<span class="badge badge-gold" style="font-size: 0.7rem; padding: 2px 6px;">⏳ Pending Verification</span>';
    }

    modalBody.innerHTML = `
      <!-- Header Summary Card -->
      <div style="background: rgba(13, 19, 31, 0.7); border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 16px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 14px;">
        <div style="display: flex; align-items: center; gap: 16px;">
          <div id="dModalPhotoWrapper" style="width: 64px; height: 64px; border-radius: 50%; background: rgba(229, 168, 59, 0.15); border: 2px solid var(--brand-accent); color: var(--brand-accent); display: flex; align-items: center; justify-content: center; font-size: 1.6rem; font-weight: 800; overflow: hidden; flex-shrink: 0; position: relative;">
            <span id="dModalPhotoFallback">${(d.full_name || 'D')[0].toUpperCase()}</span>
            <img id="dModalHeaderPhoto" src="" alt="${d.full_name}" style="display: none; width: 100%; height: 100%; object-fit: cover;" />
          </div>
          <div>
            <div style="display: flex; align-items: center; gap: 8px;">
              <h3 style="color: #ffffff; font-size: 1.25rem; margin: 0;">${d.full_name}</h3>
              ${d.driver_photo_doc ? '<span class="badge badge-green" style="font-size: 0.68rem; padding: 2px 6px;">Photo Uploaded</span>' : ''}
            </div>
            <div style="font-size: 0.85rem; color: var(--text-muted); display: flex; gap: 12px; flex-wrap: wrap; margin-top: 4px;">
              <span>📞 <a href="tel:${d.phone}" style="color: #4ade80; text-decoration: none;">${d.phone}</a></span>
              ${d.email ? `<span>✉️ ${d.email}</span>` : ''}
              <span>📍 ${d.location || 'Tamil Nadu'}</span>
            </div>
          </div>
        </div>
        <div style="display: flex; align-items: center; gap: 10px;">
          <span style="font-size: 0.82rem; color: var(--text-muted);">Status:</span>
          <select class="form-select" style="padding: 4px 10px; font-size: 0.82rem; font-weight: 700; width: auto; color: ${statusColor};" onchange="AdminApp.updateDriverStatus(${d.id}, this.value); AdminApp.openDriverDetailsModal(${d.id});">
            <option value="pending" ${status === 'pending' ? 'selected' : ''}>Pending</option>
            <option value="approved" ${status === 'approved' ? 'selected' : ''}>Approved</option>
            <option value="rejected" ${status === 'rejected' ? 'selected' : ''}>Rejected</option>
          </select>
        </div>
      </div>

      <!-- Address Card -->
      <div style="background: rgba(13, 19, 31, 0.5); border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 12px 16px; margin-bottom: 20px;">
        <div style="font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase; margin-bottom: 4px;">Residential / Operating Address</div>
        <div style="font-size: 0.92rem; color: #ffffff; line-height: 1.5;">${d.address || 'Address not provided'}</div>
      </div>

      <!-- Profile Details Grid -->
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px; margin-bottom: 20px;">
        <div class="stat-card" style="padding: 12px 14px;">
          <div style="font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase;">Vehicle Type</div>
          <div style="font-size: 0.95rem; font-weight: 700; color: #ffffff; margin-top: 4px; text-transform: capitalize;">${d.vehicle_type || '-'}</div>
        </div>
        <div class="stat-card" style="padding: 12px 14px;">
          <div style="font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase;">Registration Number</div>
          <div style="font-size: 0.95rem; font-weight: 700; color: var(--brand-accent); margin-top: 4px;"><code>${d.vehicle_number || '-'}</code></div>
        </div>
        <div class="stat-card" style="padding: 12px 14px;">
          <div style="font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase;">Experience</div>
          <div style="font-size: 0.95rem; font-weight: 700; color: #ffffff; margin-top: 4px;">⭐ ${d.experience || 0} Years</div>
        </div>
        <div class="stat-card" style="padding: 12px 14px;">
          <div style="font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase;">Registered On</div>
          <div style="font-size: 0.85rem; font-weight: 600; color: #ffffff; margin-top: 4px;">${createdDate}</div>
        </div>
      </div>

      ${d.message ? `
      <div style="background: rgba(13, 19, 31, 0.5); border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 12px 14px; margin-bottom: 20px;">
        <div style="font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase; margin-bottom: 4px;">Driver Message / Notes</div>
        <div style="font-size: 0.88rem; color: #ffffff;">${d.message}</div>
      </div>
      ` : ''}

      <!-- Document Verification Section -->
      <div style="border-top: 1px solid var(--border-color); padding-top: 18px; margin-bottom: 20px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px; flex-wrap: wrap; gap: 8px;">
          <h4 style="color: var(--brand-accent-light); font-size: 1rem; margin: 0; display: flex; align-items: center; gap: 8px;">
            <span>🔒 Document Verification & Status</span>
            <span style="font-size: 0.75rem; font-weight: normal; color: var(--text-muted);">(Admin Only)</span>
          </h4>
          <span style="font-size: 0.75rem; color: var(--text-muted);">Admin can manually review and set document statuses</span>
        </div>

        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 14px;">
          <!-- 1. Driver Photo Card -->
          <div style="background: rgba(13, 19, 31, 0.7); border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 16px;">
            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 10px;">
              <div style="display: flex; align-items: center; gap: 8px;">
                <span style="font-size: 1.3rem;">📷</span>
                <div>
                  <div style="font-weight: 700; color: #ffffff; font-size: 0.92rem;">Driver Photo</div>
                  <div style="font-size: 0.75rem; color: var(--text-muted); overflow: hidden; text-overflow: ellipsis; max-width: 140px; white-space: nowrap;">${d.driver_photo_original_name || (d.driver_photo_doc ? 'Uploaded Photo' : 'Not Uploaded')}</div>
                </div>
              </div>
              <div id="photoStatusBadgeContainer">${getDocStatusBadge(photoStatus)}</div>
            </div>

            <!-- Admin Status Selector -->
            <div style="margin-top: 10px; margin-bottom: 12px; display: flex; align-items: center; gap: 6px;">
              <span style="font-size: 0.75rem; color: var(--text-muted);">Status:</span>
              <select class="form-select" style="padding: 2px 6px; font-size: 0.75rem; width: auto;" onchange="AdminApp.updateDriverDocStatus(${d.id}, 'photo', this.value);">
                <option value="Pending Verification" ${photoStatus === 'Pending Verification' ? 'selected' : ''}>Pending Verification</option>
                <option value="Verified" ${photoStatus === 'Verified' ? 'selected' : ''}>Verified</option>
                <option value="Rejected" ${photoStatus === 'Rejected' ? 'selected' : ''}>Rejected</option>
              </select>
            </div>

            ${d.driver_photo_doc ? `
              <div style="display: flex; gap: 6px;">
                <button type="button" class="btn btn-secondary btn-sm" style="flex: 1; font-size: 0.78rem; padding: 4px 6px;" onclick="AdminApp.viewDocument(${d.id}, 'photo', '${(d.driver_photo_original_name || 'Driver_Photo.jpg').replace(/'/g, "\\'")}')">
                  👁️ View
                </button>
                <button type="button" class="btn btn-primary btn-sm" style="flex: 1; font-size: 0.78rem; padding: 4px 6px;" onclick="AdminApp.downloadDocument(${d.id}, 'photo', '${(d.driver_photo_original_name || 'Driver_Photo.jpg').replace(/'/g, "\\'")}')">
                  ⬇️ Download
                </button>
              </div>
            ` : `
              <p style="font-size: 0.78rem; color: var(--text-muted); margin-top: 10px; margin-bottom: 0;">No photo file uploaded.</p>
            `}
          </div>

          <!-- 2. Driving Licence Card -->
          <div style="background: rgba(13, 19, 31, 0.7); border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 16px;">
            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 10px;">
              <div style="display: flex; align-items: center; gap: 8px;">
                <span style="font-size: 1.3rem;">🪪</span>
                <div>
                  <div style="font-weight: 700; color: #ffffff; font-size: 0.92rem;">Driving Licence</div>
                  <div style="font-size: 0.75rem; color: var(--text-muted); overflow: hidden; text-overflow: ellipsis; max-width: 140px; white-space: nowrap;">${d.driving_licence_original_name || (d.driving_licence_doc ? 'Uploaded Document' : 'Not Uploaded')}</div>
                </div>
              </div>
              <div id="licenceStatusBadgeContainer">${getDocStatusBadge(licenceStatus)}</div>
            </div>

            <!-- Admin Status Selector -->
            <div style="margin-top: 10px; margin-bottom: 12px; display: flex; align-items: center; gap: 6px;">
              <span style="font-size: 0.75rem; color: var(--text-muted);">Status:</span>
              <select class="form-select" style="padding: 2px 6px; font-size: 0.75rem; width: auto;" onchange="AdminApp.updateDriverDocStatus(${d.id}, 'licence', this.value);">
                <option value="Pending Verification" ${licenceStatus === 'Pending Verification' ? 'selected' : ''}>Pending Verification</option>
                <option value="Verified" ${licenceStatus === 'Verified' ? 'selected' : ''}>Verified</option>
                <option value="Rejected" ${licenceStatus === 'Rejected' ? 'selected' : ''}>Rejected</option>
              </select>
            </div>

            ${d.driving_licence_doc ? `
              <div style="display: flex; gap: 6px;">
                <button type="button" class="btn btn-secondary btn-sm" style="flex: 1; font-size: 0.78rem; padding: 4px 6px;" onclick="AdminApp.viewDocument(${d.id}, 'licence', '${(d.driving_licence_original_name || 'Driving_Licence').replace(/'/g, "\\'")}')">
                  👁️ View
                </button>
                <button type="button" class="btn btn-primary btn-sm" style="flex: 1; font-size: 0.78rem; padding: 4px 6px;" onclick="AdminApp.downloadDocument(${d.id}, 'licence', '${(d.driving_licence_original_name || 'Driving_Licence.pdf').replace(/'/g, "\\'")}')">
                  ⬇️ Download
                </button>
              </div>
            ` : `
              <p style="font-size: 0.78rem; color: var(--text-muted); margin-top: 10px; margin-bottom: 0;">No document file uploaded.</p>
            `}
          </div>

          <!-- 3. Aadhaar Card (ID Proof) Card -->
          <div style="background: rgba(13, 19, 31, 0.7); border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 16px;">
            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 10px;">
              <div style="display: flex; align-items: center; gap: 8px;">
                <span style="font-size: 1.3rem;">📄</span>
                <div>
                  <div style="font-weight: 700; color: #ffffff; font-size: 0.92rem;">ID Proof (Aadhaar)</div>
                  <div style="font-size: 0.75rem; color: var(--text-muted); overflow: hidden; text-overflow: ellipsis; max-width: 140px; white-space: nowrap;">${d.aadhaar_card_original_name || (d.aadhaar_card_doc ? 'Uploaded Document' : 'Not Uploaded')}</div>
                </div>
              </div>
              <div id="aadhaarStatusBadgeContainer">${getDocStatusBadge(aadhaarStatus)}</div>
            </div>

            <!-- Admin Status Selector -->
            <div style="margin-top: 10px; margin-bottom: 12px; display: flex; align-items: center; gap: 6px;">
              <span style="font-size: 0.75rem; color: var(--text-muted);">Status:</span>
              <select class="form-select" style="padding: 2px 6px; font-size: 0.75rem; width: auto;" onchange="AdminApp.updateDriverDocStatus(${d.id}, 'aadhaar', this.value);">
                <option value="Pending Verification" ${aadhaarStatus === 'Pending Verification' ? 'selected' : ''}>Pending Verification</option>
                <option value="Verified" ${aadhaarStatus === 'Verified' ? 'selected' : ''}>Verified</option>
                <option value="Rejected" ${aadhaarStatus === 'Rejected' ? 'selected' : ''}>Rejected</option>
              </select>
            </div>

            ${d.aadhaar_card_doc ? `
              <div style="display: flex; gap: 6px;">
                <button type="button" class="btn btn-secondary btn-sm" style="flex: 1; font-size: 0.78rem; padding: 4px 6px;" onclick="AdminApp.viewDocument(${d.id}, 'aadhaar', '${(d.aadhaar_card_original_name || 'Aadhaar_Card').replace(/'/g, "\\'")}')">
                  👁️ View
                </button>
                <button type="button" class="btn btn-primary btn-sm" style="flex: 1; font-size: 0.78rem; padding: 4px 6px;" onclick="AdminApp.downloadDocument(${d.id}, 'aadhaar', '${(d.aadhaar_card_original_name || 'Aadhaar_Card.pdf').replace(/'/g, "\\'")}')">
                  ⬇️ Download
                </button>
              </div>
            ` : `
              <p style="font-size: 0.78rem; color: var(--text-muted); margin-top: 10px; margin-bottom: 0;">No document file uploaded.</p>
            `}
          </div>
        </div>
      </div>

      <!-- In-Modal Document Viewer Frame (Dynamic) -->
      <div id="driverDocPreviewContainer" style="display: none; border-top: 1px solid var(--border-color); padding-top: 16px; margin-top: 14px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
          <h5 id="previewDocTitle" style="color: #ffffff; font-size: 0.95rem; margin: 0;">Document Preview</h5>
          <button type="button" class="btn btn-secondary btn-sm" style="padding: 2px 8px; font-size: 0.75rem;" onclick="document.getElementById('driverDocPreviewContainer').style.display = 'none';">✕ Close Preview</button>
        </div>
        <div id="previewDocContent" style="background: #000; border-radius: var(--radius-md); overflow: hidden; min-height: 250px; display: flex; align-items: center; justify-content: center;">
          <!-- Injected dynamically -->
        </div>
      </div>

      <div style="display: flex; justify-content: flex-end; gap: 10px; margin-top: 20px; border-top: 1px solid var(--border-color); padding-top: 16px;">
        <button type="button" class="btn btn-secondary" onclick="closeModal('driverDetailsModal')">Close</button>
        <button type="button" class="btn btn-secondary" onclick="closeModal('driverDetailsModal'); AdminApp.openEditDriverModal(${d.id});">
          ✏️ Edit Profile
        </button>
        <button type="button" class="btn btn-primary" onclick="closeModal('driverDetailsModal'); AdminApp.openDriverAssignOrderModal(${d.id}, '${(d.full_name || '').replace(/'/g, "\\'")}', '${d.phone}');">
          Assign Trip
        </button>
      </div>
    `;

    // Asynchronously stream secure photo into header avatar if available
    if (d.driver_photo_doc) {
      AdminAPI.getDriverDocumentBlob(d.id, 'photo')
        .then(({ blob }) => {
          const url = URL.createObjectURL(blob);
          const imgEl = document.getElementById('dModalHeaderPhoto');
          const fallbackEl = document.getElementById('dModalPhotoFallback');
          if (imgEl && fallbackEl) {
            imgEl.src = url;
            imgEl.style.display = 'block';
            fallbackEl.style.display = 'none';
          }
        })
        .catch(err => {
          console.warn('Driver photo avatar fetch warning:', err.message);
        });
    }
  },

  async viewDocument(driverId, docType, originalName) {
    try {
      const previewContainer = document.getElementById('driverDocPreviewContainer');
      const previewContent = document.getElementById('previewDocContent');
      const previewTitle = document.getElementById('previewDocTitle');

      if (previewTitle) previewTitle.textContent = `Preview: ${originalName}`;
      if (previewContent) previewContent.innerHTML = '<p style="color: var(--text-muted); padding: 20px;">Loading secure document...</p>';
      if (previewContainer) {
        previewContainer.style.display = 'block';
        previewContainer.scrollIntoView({ behavior: 'smooth' });
      }

      const { blob, contentType } = await AdminAPI.getDriverDocumentBlob(driverId, docType, false);
      const objectUrl = URL.createObjectURL(blob);

      if (contentType.includes('pdf')) {
        if (previewContent) {
          previewContent.innerHTML = `
            <iframe src="${objectUrl}" style="width: 100%; height: 450px; border: none;" title="${originalName}"></iframe>
          `;
        }
      } else {
        if (previewContent) {
          previewContent.innerHTML = `
            <img src="${objectUrl}" alt="${originalName}" style="max-width: 100%; max-height: 450px; object-fit: contain; padding: 8px;" />
          `;
        }
      }
    } catch (err) {
      alert(err.message || 'Failed to load document preview.');
    }
  },

  async downloadDocument(driverId, docType, originalName) {
    try {
      const { blob } = await AdminAPI.getDriverDocumentBlob(driverId, docType, true);
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = objectUrl;
      a.download = originalName || `document_${docType}.pdf`;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        a.remove();
        URL.revokeObjectURL(objectUrl);
      }, 1000);
    } catch (err) {
      alert(err.message || 'Failed to download document.');
    }
  },

  async updateDriverStatus(id, status) {
    const res = await AdminAPI.updateDriverStatus(id, status);
    if (res && res.success) {
      await this.loadDrivers();
      if (typeof this.loadDashboard === 'function') this.loadDashboard();
    } else {
      alert(res?.message || 'Failed to update driver status');
      await this.loadDrivers();
    }
  },

  async updateDriverDocStatus(driverId, docType, status) {
    try {
      const res = await AdminAPI.updateDriverDocVerification(driverId, docType, status);
      if (res && res.success) {
        // Update badge container in modal dynamically
        let containerId = 'photoStatusBadgeContainer';
        if (docType === 'licence' || docType === 'driving_licence') containerId = 'licenceStatusBadgeContainer';
        else if (docType === 'aadhaar' || docType === 'aadhaar_card') containerId = 'aadhaarStatusBadgeContainer';

        const el = document.getElementById(containerId);
        if (el) {
          if (status === 'Verified') el.innerHTML = '<span class="badge badge-green" style="font-size: 0.7rem; padding: 2px 6px;">✔ Verified</span>';
          else if (status === 'Rejected') el.innerHTML = '<span class="badge badge-red" style="font-size: 0.7rem; padding: 2px 6px; background: rgba(239,68,68,0.2); color: #f87171;">✕ Rejected</span>';
          else el.innerHTML = '<span class="badge badge-gold" style="font-size: 0.7rem; padding: 2px 6px;">⏳ Pending Verification</span>';
        }
      } else {
        alert(res?.message || 'Failed to update document verification status');
      }
    } catch (err) {
      alert(err.message || 'Error updating document verification status');
    }
  },

  async openEditDriverModal(driverId) {
    const res = await AdminAPI.getDriver(driverId);
    if (!res || !res.success || !res.data) {
      alert('Failed to load driver details for editing');
      return;
    }

    const d = res.data;
    document.getElementById('editDriverId').value = d.id;
    document.getElementById('editDriverFullName').value = d.full_name || '';
    document.getElementById('editDriverPhone').value = d.phone || '';
    document.getElementById('editDriverEmail').value = d.email || '';
    document.getElementById('editDriverLocation').value = d.location || '';
    document.getElementById('editDriverAddress').value = d.address || '';
    document.getElementById('editDriverVehicleType').value = d.vehicle_type || 'other';
    document.getElementById('editDriverVehicleNumber').value = d.vehicle_number || '';
    document.getElementById('editDriverExperience').value = d.experience || 0;
    document.getElementById('editDriverStatus').value = (d.status || 'pending').toLowerCase();
    document.getElementById('editDriverAdminNotes').value = d.admin_notes || '';

    // Initialize State & District dropdowns
    if (typeof IndiaLocations !== 'undefined') {
      IndiaLocations.bindStateDistrictPair('editDriverState', 'editDriverDistrict', d.state, d.district);
    }

    openModal('editDriverModal');
  },

  async saveEditedDriver(e) {
    e.preventDefault();
    const id = document.getElementById('editDriverId').value;
    if (!id) return;

    const saveBtn = document.getElementById('saveDriverBtn');
    if (saveBtn) {
      saveBtn.disabled = true;
      saveBtn.innerHTML = '<span>Saving changes...</span>';
    }

    const payload = {
      fullName: document.getElementById('editDriverFullName').value.trim(),
      phone: document.getElementById('editDriverPhone').value.trim(),
      email: document.getElementById('editDriverEmail').value.trim(),
      state: document.getElementById('editDriverState')?.value || '',
      district: document.getElementById('editDriverDistrict')?.value || '',
      location: document.getElementById('editDriverLocation').value.trim(),
      address: document.getElementById('editDriverAddress').value.trim(),
      vehicleType: document.getElementById('editDriverVehicleType').value,
      vehicleNumber: document.getElementById('editDriverVehicleNumber').value.trim(),
      experience: parseInt(document.getElementById('editDriverExperience').value, 10) || 0,
      status: document.getElementById('editDriverStatus').value,
      adminNotes: document.getElementById('editDriverAdminNotes').value.trim()
    };

    try {
      const res = await AdminAPI.updateDriver(id, payload);
      if (res && res.success) {
        closeModal('editDriverModal');
        await this.loadDrivers();
        if (typeof this.loadDashboard === 'function') this.loadDashboard();
        alert('Driver details updated successfully!');
      } else {
        alert(res?.message || 'Failed to update driver details');
      }
    } catch (err) {
      console.error('Error saving driver:', err);
      alert(err.message || 'Error updating driver');
    } finally {
      if (saveBtn) {
        saveBtn.disabled = false;
        saveBtn.innerHTML = '<span>Save Driver Changes</span>';
      }
    }
  },

  viewPickupMap(enquiryOrOrderId) {
    this.viewLocationMap(enquiryOrOrderId, 'pickup');
  },

  viewDropMap(enquiryOrOrderId) {
    this.viewLocationMap(enquiryOrOrderId, 'drop');
  },

  viewLocationMap(enquiryOrOrderId, locationType = 'pickup') {
    const item = (this.data.enquiries && this.data.enquiries.find(e => e.id === enquiryOrOrderId)) ||
                 (this.data.orders && this.data.orders.find(o => o.id === enquiryOrOrderId));
    if (!item) {
      alert('Enquiry details not found.');
      return;
    }

    const isDrop = (locationType === 'drop' || locationType === 'delivery');
    const lat = isDrop ? (item.drop_latitude || item.delivery_latitude) : item.pickup_latitude;
    const lng = isDrop ? (item.drop_longitude || item.delivery_longitude) : item.pickup_longitude;
    const address = isDrop ? (item.drop_address || item.delivery_address) : item.pickup_address;
    const city = isDrop ? item.drop_city : item.pickup_city;
    const district = isDrop ? item.drop_district : item.pickup_district;
    const state = isDrop ? item.drop_state : item.pickup_state;
    const label = isDrop ? 'Delivery Destination' : 'Pickup Location';

    if (!lat || !lng) {
      alert(`No GPS map coordinates available for this ${isDrop ? 'delivery destination' : 'pickup location'}.`);
      return;
    }

    const nameEl = document.getElementById('adminMapCustomerName');
    if (nameEl) nameEl.textContent = `${item.name} (📞 ${item.phone || 'N/A'}) - Request ${item.request_code || '#' + item.id} [${label.toUpperCase()}]`;

    const addrEl = document.getElementById('adminMapAddressText');
    if (addrEl) {
      const fullAddr = [address, city, district, state].filter(Boolean).join(', ');
      addrEl.textContent = fullAddr || `${label} pinned point`;
    }

    const coordsEl = document.getElementById('adminMapCoordsText');
    if (coordsEl) {
      coordsEl.textContent = `📍 Coordinates: ${Number(lat).toFixed(6)}, ${Number(lng).toFixed(6)}`;
    }

    const navBtn = document.getElementById('adminGoogleMapsNavBtn');
    if (navBtn && typeof MapHelper !== 'undefined') {
      navBtn.href = MapHelper.getNavigationUrl(lat, lng);
    }

    openModal('adminMapModal');

    // Render interactive map inside modal with small delay for sizing
    setTimeout(() => {
      if (typeof MapHelper !== 'undefined') {
        MapHelper.renderReadOnlyMap('adminMapContainer', lat, lng, address || item.name);
      }
    }, 150);
  },

  async deleteDriver(id) {
    if (!confirm('Are you sure you want to remove this driver application?')) return;
    const res = await AdminAPI.deleteDriver(id);
    if (res && res.success) {
      await this.loadDrivers();
    }
  },

  handleDriverSearch() {
    this.loadDrivers();
  },

  handleDriverStatusFilter() {
    this.loadDrivers();
  },

  // ---------------------------------------------------------------------------
  // 8. WEBSITE CONTENT MANAGEMENT
  // ---------------------------------------------------------------------------
  async loadContent() {
    const res = await AdminAPI.getContent();
    if (!res || !res.success) return;

    this.data.content = res.data;
    const { hero, about, how_it_works, why_us, cta, footer } = res.data;

    // Populate Hero
    if (hero) {
      document.getElementById('cHeroBadge').value = hero.badge || '';
      document.getElementById('cHeroHeading').value = hero.heading || '';
      document.getElementById('cHeroLead').value = hero.lead || '';
      document.getElementById('cHeroBtnPrimary').value = hero.btn_primary || '';
      document.getElementById('cHeroBtnSecondary').value = hero.btn_secondary || '';
    }

    // Populate About
    if (about) {
      document.getElementById('cAboutTitle').value = about.title || '';
      document.getElementById('cAboutLead').value = about.lead || '';
      document.getElementById('cAboutDesc').value = about.description || '';
      document.getElementById('cAboutStatNum').value = about.stats_number || '';
      document.getElementById('cAboutStatLabel').value = about.stats_label || '';
    }

    // Populate How It Works Steps
    const stepsContainer = document.getElementById('howItWorksStepsContainer');
    if (stepsContainer) {
      const steps = how_it_works?.steps || [
        { num: 1, title: "Tell Us About Your Load", desc: "Tell us what you want to send..." },
        { num: 2, title: "We Find the Right Vehicle", desc: "Our team reviews your load..." },
        { num: 3, title: "We Arrange Your Driver", desc: "We assign a verified, reliable driver..." },
        { num: 4, title: "Your Load Gets Picked Up", desc: "The vehicle reaches your doorstep..." },
        { num: 5, title: "Your Load Reaches Its Destination", desc: "Your goods arrive safely..." }
      ];

      document.getElementById('cHowTitle').value = how_it_works?.title || 'How It Works';
      document.getElementById('cHowSubtitle').value = how_it_works?.subtitle || 'Moving your load with Vandi Load is quick and simple.';

      stepsContainer.innerHTML = steps.map((s, idx) => `
        <div style="background: rgba(255,255,255,0.03); border: 1px solid var(--border-color); padding: 12px; border-radius: 6px; margin-bottom: 12px;">
          <div style="font-weight: 700; color: #ffffff; margin-bottom: 8px;">Step ${idx + 1}</div>
          <div class="form-group">
            <label class="form-label" style="font-size: 0.75rem;">Step Title</label>
            <input type="text" class="form-input how-step-title" data-idx="${idx}" value="${s.title.replace(/"/g, '&quot;')}" />
          </div>
          <div class="form-group" style="margin-bottom: 0;">
            <label class="form-label" style="font-size: 0.75rem;">Step Description</label>
            <textarea class="form-textarea how-step-desc" data-idx="${idx}" rows="2">${s.desc}</textarea>
          </div>
        </div>
      `).join('');
    }

    // Populate Why Us Points
    const pointsContainer = document.getElementById('whyUsPointsContainer');
    if (pointsContainer) {
      const points = why_us?.points || [
        { title: "Right Vehicle", desc: "We help you select the exact vehicle size..." },
        { title: "Verified Drivers", desc: "Experienced drivers with checked background documents..." },
        { title: "Quick Response", desc: "Our team contacts you quickly..." },
        { title: "Easy Request", desc: "No complicated signups..." },
        { title: "Reliable Service", desc: "Safe, on-time pickup and careful handling..." }
      ];

      document.getElementById('cWhyTitle').value = why_us?.title || 'Why Choose Vandi Load?';
      document.getElementById('cWhySubtitle').value = why_us?.subtitle || 'We focus on what matters most.';

      pointsContainer.innerHTML = points.map((p, idx) => `
        <div style="background: rgba(255,255,255,0.03); border: 1px solid var(--border-color); padding: 12px; border-radius: 6px; margin-bottom: 12px;">
          <div style="font-weight: 700; color: #ffffff; margin-bottom: 8px;">Trust Point ${idx + 1}</div>
          <div class="form-group">
            <label class="form-label" style="font-size: 0.75rem;">Point Title</label>
            <input type="text" class="form-input why-point-title" data-idx="${idx}" value="${p.title.replace(/"/g, '&quot;')}" />
          </div>
          <div class="form-group" style="margin-bottom: 0;">
            <label class="form-label" style="font-size: 0.75rem;">Point Description</label>
            <textarea class="form-textarea why-point-desc" data-idx="${idx}" rows="2">${p.desc}</textarea>
          </div>
        </div>
      `).join('');
    }

    // Populate CTA & Footer
    if (cta) {
      document.getElementById('cCtaTitle').value = cta.title || '';
      document.getElementById('cCtaDesc').value = cta.description || '';
      document.getElementById('cCtaBtn').value = cta.btn_text || '';
    }
    if (footer) {
      document.getElementById('cFooterDesc').value = footer.description || '';
      document.getElementById('cFooterCopy').value = footer.copyright || '';
    }
  },

  switchContentTab(tabKey) {
    this.currentContentTab = tabKey;
    document.querySelectorAll('.content-tab-btn').forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-tab') === tabKey);
    });
    document.querySelectorAll('.content-tab-pane').forEach(pane => {
      pane.style.display = pane.id === `contentTab-${tabKey}` ? 'block' : 'none';
    });
  },

  async saveHeroContent(e) {
    e.preventDefault();
    const payload = {
      badge: document.getElementById('cHeroBadge').value.trim(),
      heading: document.getElementById('cHeroHeading').value.trim(),
      lead: document.getElementById('cHeroLead').value.trim(),
      btn_primary: document.getElementById('cHeroBtnPrimary').value.trim(),
      btn_secondary: document.getElementById('cHeroBtnSecondary').value.trim()
    };
    const res = await AdminAPI.updateContent('hero', payload);
    if (res && res.success) alert('Hero section updated successfully!');
  },

  async saveAboutContent(e) {
    e.preventDefault();
    const payload = {
      title: document.getElementById('cAboutTitle').value.trim(),
      lead: document.getElementById('cAboutLead').value.trim(),
      description: document.getElementById('cAboutDesc').value.trim(),
      stats_number: document.getElementById('cAboutStatNum').value.trim(),
      stats_label: document.getElementById('cAboutStatLabel').value.trim()
    };
    const res = await AdminAPI.updateContent('about', payload);
    if (res && res.success) alert('About section updated successfully!');
  },

  async saveHowItWorksContent(e) {
    e.preventDefault();
    const steps = [];
    document.querySelectorAll('.how-step-title').forEach((el, idx) => {
      const descEl = document.querySelector(`.how-step-desc[data-idx="${idx}"]`);
      steps.push({
        num: idx + 1,
        title: el.value.trim(),
        desc: descEl ? descEl.value.trim() : ''
      });
    });

    const payload = {
      title: document.getElementById('cHowTitle').value.trim(),
      subtitle: document.getElementById('cHowSubtitle').value.trim(),
      steps
    };

    const res = await AdminAPI.updateContent('how_it_works', payload);
    if (res && res.success) alert('How It Works section updated successfully!');
  },

  async saveWhyUsContent(e) {
    e.preventDefault();
    const points = [];
    document.querySelectorAll('.why-point-title').forEach((el, idx) => {
      const descEl = document.querySelector(`.why-point-desc[data-idx="${idx}"]`);
      points.push({
        title: el.value.trim(),
        desc: descEl ? descEl.value.trim() : ''
      });
    });

    const payload = {
      title: document.getElementById('cWhyTitle').value.trim(),
      subtitle: document.getElementById('cWhySubtitle').value.trim(),
      points
    };

    const res = await AdminAPI.updateContent('why_us', payload);
    if (res && res.success) alert('Why Choose Us points updated successfully!');
  },

  async saveFooterContent(e) {
    e.preventDefault();
    const ctaPayload = {
      title: document.getElementById('cCtaTitle').value.trim(),
      description: document.getElementById('cCtaDesc').value.trim(),
      btn_text: document.getElementById('cCtaBtn').value.trim()
    };
    const footerPayload = {
      description: document.getElementById('cFooterDesc').value.trim(),
      copyright: document.getElementById('cFooterCopy').value.trim()
    };

    await AdminAPI.updateContent('cta', ctaPayload);
    await AdminAPI.updateContent('footer', footerPayload);
    alert('CTA and Footer content updated successfully!');
  },

  // ---------------------------------------------------------------------------
  // 9. REPORTS & PDF EXPORT
  // ---------------------------------------------------------------------------
  async loadReportsView() {
    await this.loadCategoriesData();
  },

  async exportVehiclesPDF() {
    await this.loadVehicles();
    const cat = document.getElementById('vehicleCategoryFilter')?.value || 'all';
    const status = document.getElementById('vehicleStatusFilter')?.value || 'all';
    PDFExport.exportReport('vehicles', this.data.vehicles, { category: cat, status });
  },

  async exportCategoriesPDF() {
    await this.loadCategoriesData();
    PDFExport.exportReport('categories', this.data.categories, {});
  },

  async exportDriversPDF() {
    await this.loadDrivers();
    const status = document.getElementById('driverStatusFilter')?.value || 'all';
    PDFExport.exportReport('drivers', this.data.drivers, { status });
  },

  async exportEnquiriesPDF() {
    await this.loadEnquiries();
    const status = document.getElementById('enquiryStatusFilter')?.value || 'all';
    const assignmentStatus = document.getElementById('enquiryAssignmentFilter')?.value || 'all';
    PDFExport.exportReport('enquiries', this.data.enquiries, { status, assignmentStatus });
  },

  async exportOrdersPDF() {
    await this.loadOrders();
    const assignmentStatus = document.getElementById('orderAssignmentFilter')?.value || 'all';
    PDFExport.exportReport('orders', this.data.orders, { assignmentStatus });
  },

  async exportCustomEnquiriesPDF() {
    const status = document.getElementById('reportEnquiryStatus').value;
    const assignmentStatus = document.getElementById('reportEnquiryAssignStatus').value;
    const res = await AdminAPI.getEnquiries({ status, assignmentStatus });
    if (res && res.data) {
      PDFExport.exportReport('enquiries', res.data, { status, assignmentStatus });
    }
  },

  async exportCustomDriversPDF() {
    const status = document.getElementById('reportDriverStatus').value;
    const res = await AdminAPI.getDrivers(status);
    if (res && res.data) {
      PDFExport.exportReport('drivers', res.data, { status });
    }
  },

  async exportCustomVehiclesPDF() {
    const category = document.getElementById('reportVehicleCategory').value;
    const status = document.getElementById('reportVehicleStatus').value;
    const res = await AdminAPI.getVehicles(category);
    let list = res?.data || [];
    if (status !== 'all') list = list.filter(v => v.status === status);
    PDFExport.exportReport('vehicles', list, { category, status });
  },

  async exportCustomCategoriesPDF() {
    const status = document.getElementById('reportCategoryStatus').value;
    const res = await AdminAPI.getCategories();
    let list = res?.data || [];
    if (status !== 'all') list = list.filter(c => c.status === status);
    PDFExport.exportReport('categories', list, { status });
  },

  // ---------------------------------------------------------------------------
  // 10. SETTINGS
  // ---------------------------------------------------------------------------
  async loadSettings() {
    const res = await AdminAPI.getSettings();
    if (!res || !res.success) return;

    this.data.settings = res.data;
    const s = res.data;

    document.getElementById('setCompanyName').value = s.company_name || '';
    document.getElementById('setTagline').value = s.company_tagline || '';
    document.getElementById('setPhone').value = s.phone_number || '';
    document.getElementById('setWhatsapp').value = s.whatsapp_number || '';
    document.getElementById('setEmail').value = s.email || '';
    document.getElementById('setHours').value = s.working_hours || '';
    document.getElementById('setAddress').value = s.address || '';
  },

  async saveSettings(e) {
    e.preventDefault();
    const payload = {
      company_name: document.getElementById('setCompanyName').value.trim(),
      company_tagline: document.getElementById('setTagline').value.trim(),
      phone_number: document.getElementById('setPhone').value.trim(),
      whatsapp_number: document.getElementById('setWhatsapp').value.trim(),
      email: document.getElementById('setEmail').value.trim(),
      working_hours: document.getElementById('setHours').value.trim(),
      address: document.getElementById('setAddress').value.trim()
    };

    const res = await AdminAPI.updateSettings(payload);
    if (res && res.success) {
      alert('Company settings saved successfully!');
    } else {
      alert(res?.message || 'Failed to save settings');
    }
  },

  async handleChangePassword(e) {
    e.preventDefault();
    const currentPassword = document.getElementById('adminCurrentPassword').value;
    const newPassword = document.getElementById('adminNewPassword').value;
    const confirmPassword = document.getElementById('adminConfirmPassword').value;
    const alertBox = document.getElementById('adminPassAlert');
    const submitBtn = document.getElementById('adminChangePassBtn');

    function showAlert(msg, isSuccess = false) {
      if (!alertBox) return;
      alertBox.textContent = msg;
      alertBox.style.display = 'block';
      alertBox.style.background = isSuccess ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)';
      alertBox.style.color = isSuccess ? '#4ade80' : '#f87171';
      alertBox.style.border = isSuccess ? '1px solid rgba(34, 197, 94, 0.4)' : '1px solid rgba(239, 68, 68, 0.4)';
    }

    if (!currentPassword || !newPassword || !confirmPassword) {
      showAlert('All password fields are required.');
      return;
    }

    if (newPassword.length < 6) {
      showAlert('New password must be at least 6 characters long.');
      return;
    }

    if (newPassword !== confirmPassword) {
      showAlert('New password and confirm password do not match.');
      return;
    }

    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span>Updating password...</span>';

    try {
      const res = await AdminAPI.changePassword(currentPassword, newPassword, confirmPassword);
      if (res && res.success) {
        showAlert('Password updated successfully! You can now log in with your new password.', true);
        document.getElementById('adminChangePasswordForm').reset();
      } else {
        showAlert(res?.message || 'Failed to update password.');
      }
    } catch (err) {
      showAlert('Error connecting to server. Please try again.');
    } finally {
      submitBtn.disabled = false;
      submitBtn.innerHTML = '<span>Update Password</span>';
    }
  },

  // ---------------------------------------------------------------------------
  // 12. REAL-TIME DATA SYNCHRONIZATION (Server-Sent Events)
  // ---------------------------------------------------------------------------
  initRealtimeSync() {
    if (typeof AdminAuth === 'undefined' || !AdminAuth.isAuthenticated()) return;
    const token = AdminAuth.getToken();
    if (!token) return;

    if (this.realtimeSource) {
      try { this.realtimeSource.close(); } catch (e) {}
    }

    const sseUrl = `/api/admin/events?token=${encodeURIComponent(token)}`;
    this.realtimeSource = new EventSource(sseUrl);

    this.realtimeSource.onopen = () => {
      if (this._wasDisconnected) {
        this._wasDisconnected = false;
        // Resync latest data after temporary disconnect
        this.resyncRealtimeData();
      }
    };

    this.realtimeSource.onerror = (err) => {
      this._wasDisconnected = true;
    };

    // Listen for new enquiry event
    this.realtimeSource.addEventListener('enquiry:new', (e) => {
      try {
        const item = JSON.parse(e.data);
        if (!item || !item.id) return;
        this.handleRealtimeNewEnquiry(item);
      } catch (err) {
        console.error('Error handling enquiry:new SSE:', err);
      }
    });

    // Listen for enquiry update (assignment, driver confirm, status update, timeout)
    this.realtimeSource.addEventListener('enquiry:updated', (e) => {
      try {
        const item = JSON.parse(e.data);
        if (!item || !item.id) return;
        this.handleRealtimeUpdatedEnquiry(item);
      } catch (err) {
        console.error('Error handling enquiry:updated SSE:', err);
      }
    });

    // Listen for enquiry delete
    this.realtimeSource.addEventListener('enquiry:deleted', (e) => {
      try {
        const payload = JSON.parse(e.data);
        if (!payload || !payload.id) return;
        this.handleRealtimeDeletedEnquiry(payload.id);
      } catch (err) {
        console.error('Error handling enquiry:deleted SSE:', err);
      }
    });

    // Listen for new driver application
    this.realtimeSource.addEventListener('driver:new', (e) => {
      try {
        const driver = JSON.parse(e.data);
        if (!driver || !driver.id) return;
        this.handleRealtimeNewDriver(driver);
      } catch (err) {
        console.error('Error handling driver:new SSE:', err);
      }
    });

    // Cleanup on page unload
    window.addEventListener('beforeunload', () => {
      if (this.realtimeSource) {
        try { this.realtimeSource.close(); } catch (e) {}
      }
    });
  },

  async resyncRealtimeData() {
    try {
      await this.loadDashboard();
      if (this.currentView === 'enquiries') {
        await this.loadEnquiries();
      } else if (this.currentView === 'orders') {
        await this.loadOrders();
      } else if (this.currentView === 'drivers') {
        await this.loadDrivers();
      }
    } catch (e) {
      console.error('Error resyncing realtime data:', e);
    }
  },

  handleRealtimeNewEnquiry(item) {
    // 1. Deduplicate check: prevent duplicate items in memory
    if (this.data.enquiries && !this.data.enquiries.some(e => e.id === item.id)) {
      this.data.enquiries.unshift(item);
    }
    if (this.data.orders && !this.data.orders.some(o => o.id === item.id)) {
      this.data.orders.unshift(item);
    }

    // 2. Show non-intrusive notification toast
    this.showToast(`🔔 New Enquiry: ${item.request_code || '#' + item.id} from ${item.name}`);

    // 3. Update dashboard stats / badges
    this.loadDashboard();

    // 4. Update currently active view dynamically without page reload
    if (this.currentView === 'enquiries') {
      this.loadEnquiries();
    } else if (this.currentView === 'orders') {
      this.loadOrders();
    }
  },

  handleRealtimeUpdatedEnquiry(item) {
    // Deduplicate/Update in memory
    if (this.data.enquiries) {
      const idx = this.data.enquiries.findIndex(e => e.id === item.id);
      if (idx !== -1) {
        this.data.enquiries[idx] = { ...this.data.enquiries[idx], ...item };
      }
    }
    if (this.data.orders) {
      const idx = this.data.orders.findIndex(o => o.id === item.id);
      if (idx !== -1) {
        this.data.orders[idx] = { ...this.data.orders[idx], ...item };
      }
    }

    // Update dashboard stats & badges
    this.loadDashboard();

    // Re-render active view
    if (this.currentView === 'enquiries') {
      this.loadEnquiries();
    } else if (this.currentView === 'orders') {
      this.loadOrders();
    }
  },

  handleRealtimeDeletedEnquiry(id) {
    if (this.data.enquiries) {
      this.data.enquiries = this.data.enquiries.filter(e => e.id !== id);
    }
    if (this.data.orders) {
      this.data.orders = this.data.orders.filter(o => o.id !== id);
    }

    this.loadDashboard();
    if (this.currentView === 'enquiries') {
      this.loadEnquiries();
    } else if (this.currentView === 'orders') {
      this.loadOrders();
    }
  },

  handleRealtimeNewDriver(driver) {
    this.showToast(`🔔 New Driver Registration: ${driver.full_name}`);
    this.loadDashboard();
    if (this.currentView === 'drivers') {
      this.loadDrivers();
    }
  },

  showToast(message) {
    let container = document.getElementById('adminToastContainer');
    if (!container) {
      container = document.createElement('div');
      container.id = 'adminToastContainer';
      container.style.cssText = 'position: fixed; top: 24px; right: 24px; z-index: 99999; display: flex; flex-direction: column; gap: 10px; pointer-events: none; max-width: 380px;';
      document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.style.cssText = 'background: #1e293b; color: #f8fafc; border: 1px solid #3b82f6; border-left: 4px solid #3b82f6; padding: 12px 18px; border-radius: 8px; box-shadow: 0 10px 25px rgba(0,0,0,0.5); font-size: 0.85rem; font-family: inherit; pointer-events: auto; transition: all 0.3s ease; opacity: 0; transform: translateY(-10px);';
    toast.textContent = message;

    container.appendChild(toast);

    requestAnimationFrame(() => {
      toast.style.opacity = '1';
      toast.style.transform = 'translateY(0)';
    });

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(-10px)';
      setTimeout(() => {
        if (toast.parentNode) toast.parentNode.removeChild(toast);
      }, 300);
    }, 4500);
  }
};

// Initialize on DOM load
document.addEventListener('DOMContentLoaded', () => {
  AdminApp.init();
});
