/**
 * Vandi Load - Admin API Client
 * Centralized authenticated REST API layer.
 */

const AdminAPI = {
  // ---------------------------------------------------------------------------
  // AUTH
  // ---------------------------------------------------------------------------
  async login(username, password) {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    return await res.json();
  },

  async getMe() {
    return await AdminAuth.fetchWithAuth('/api/auth/me');
  },

  async changePassword(currentPassword, newPassword, confirmPassword) {
    return await AdminAuth.fetchWithAuth('/api/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ currentPassword, newPassword, confirmPassword })
    });
  },

  // ---------------------------------------------------------------------------
  // DASHBOARD STATS
  // ---------------------------------------------------------------------------
  async getStats() {
    return await AdminAuth.fetchWithAuth('/api/admin/stats');
  },

  // ---------------------------------------------------------------------------
  // VEHICLES
  // ---------------------------------------------------------------------------
  async getVehicles(category = 'all', search = '') {
    let url = '/api/vehicles/admin/all';
    const params = new URLSearchParams();
    if (category && category !== 'all') params.append('category', category);
    if (search) params.append('search', search);
    if (params.toString()) url += `?${params.toString()}`;

    return await AdminAuth.fetchWithAuth(url);
  },

  async createVehicle(payload) {
    return await AdminAuth.fetchWithAuth('/api/vehicles/admin/create', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  },

  async updateVehicle(id, payload) {
    return await AdminAuth.fetchWithAuth(`/api/vehicles/admin/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload)
    });
  },

  async updateVehicleStatus(id, status) {
    return await AdminAuth.fetchWithAuth(`/api/vehicles/admin/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status })
    });
  },

  async deleteVehicle(id) {
    return await AdminAuth.fetchWithAuth(`/api/vehicles/admin/${id}`, {
      method: 'DELETE'
    });
  },

  // ---------------------------------------------------------------------------
  // CATEGORIES
  // ---------------------------------------------------------------------------
  async getCategories() {
    return await AdminAuth.fetchWithAuth('/api/categories/admin/all');
  },

  async createCategory(payload) {
    return await AdminAuth.fetchWithAuth('/api/categories/admin/create', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  },

  async updateCategory(id, payload) {
    return await AdminAuth.fetchWithAuth(`/api/categories/admin/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload)
    });
  },

  async updateCategoryStatus(id, status) {
    return await AdminAuth.fetchWithAuth(`/api/categories/admin/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status })
    });
  },

  async deleteCategory(id) {
    return await AdminAuth.fetchWithAuth(`/api/categories/admin/${id}`, {
      method: 'DELETE'
    });
  },

  // ---------------------------------------------------------------------------
  // GALLERY
  // ---------------------------------------------------------------------------
  async getGallery(category = 'all') {
    let url = '/api/gallery/admin/all';
    if (category && category !== 'all') url += `?category=${category}`;
    return await AdminAuth.fetchWithAuth(url);
  },

  async createGalleryItem(payload) {
    return await AdminAuth.fetchWithAuth('/api/gallery/admin/create', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  },

  async updateGalleryStatus(id, status) {
    return await AdminAuth.fetchWithAuth(`/api/gallery/admin/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status })
    });
  },

  async deleteGalleryItem(id) {
    return await AdminAuth.fetchWithAuth(`/api/gallery/admin/${id}`, {
      method: 'DELETE'
    });
  },

  // ---------------------------------------------------------------------------
  // ENQUIRIES / ORDERS & ASSIGNMENTS
  // ---------------------------------------------------------------------------
  async getEnquiries(filters = {}) {
    let url = '/api/enquiries/admin/all';
    const params = new URLSearchParams();
    if (filters.status && filters.status !== 'all') params.append('status', filters.status);
    if (filters.assignmentStatus && filters.assignmentStatus !== 'all') params.append('assignmentStatus', filters.assignmentStatus);
    if (filters.driverId && filters.driverId !== 'all') params.append('driverId', filters.driverId);
    if (filters.search) params.append('search', filters.search);
    if (filters.dateFrom) params.append('dateFrom', filters.dateFrom);
    if (filters.dateTo) params.append('dateTo', filters.dateTo);
    if (params.toString()) url += `?${params.toString()}`;

    return await AdminAuth.fetchWithAuth(url);
  },

  async assignEnquiry(id, payload) {
    return await AdminAuth.fetchWithAuth(`/api/enquiries/admin/${id}/assign`, {
      method: 'PATCH',
      body: JSON.stringify(payload)
    });
  },

  async updateEnquiryStatus(id, status, adminNotes = '') {
    return await AdminAuth.fetchWithAuth(`/api/enquiries/admin/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status, adminNotes })
    });
  },

  async deleteEnquiry(id) {
    return await AdminAuth.fetchWithAuth(`/api/enquiries/admin/${id}`, {
      method: 'DELETE'
    });
  },

  // ---------------------------------------------------------------------------
  // DRIVER APPLICATIONS & REGISTERED DRIVERS
  // ---------------------------------------------------------------------------
  async getDrivers(status = 'all', search = '') {
    let url = '/api/driver-applications/admin/all';
    const params = new URLSearchParams();
    if (status && status !== 'all') params.append('status', status);
    if (search) params.append('search', search);
    if (params.toString()) url += `?${params.toString()}`;

    return await AdminAuth.fetchWithAuth(url);
  },

  async getDriver(id) {
    return await AdminAuth.fetchWithAuth(`/api/driver-applications/admin/${id}`);
  },

  async getDriverOrders(driverId) {
    return await AdminAuth.fetchWithAuth(`/api/driver-applications/admin/${driverId}/orders`);
  },

  async getDriverDocumentBlob(driverId, docType, download = false) {
    const token = AdminAuth.getToken();
    if (!token) throw new Error('Unauthenticated admin');
    const url = `/api/driver-applications/admin/${driverId}/document/${docType}${download ? '?download=1' : ''}`;
    const res = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      throw new Error(errJson.message || `Failed to fetch document (status ${res.status})`);
    }
    const blob = await res.blob();
    const contentType = res.headers.get('Content-Type') || '';
    return { blob, contentType };
  },

  async updateDriverStatus(id, status, adminNotes = '') {
    return await AdminAuth.fetchWithAuth(`/api/driver-applications/admin/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status, adminNotes })
    });
  },

  async updateDriverDocVerification(id, docType, status) {
    return await AdminAuth.fetchWithAuth(`/api/driver-applications/admin/${id}/doc-verification`, {
      method: 'PATCH',
      body: JSON.stringify({ docType, status })
    });
  },

  async updateDriver(id, data) {
    return await AdminAuth.fetchWithAuth(`/api/driver-applications/admin/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  },

  async deleteDriver(id) {
    return await AdminAuth.fetchWithAuth(`/api/driver-applications/admin/${id}`, {
      method: 'DELETE'
    });
  },

  // ---------------------------------------------------------------------------
  // WEBSITE CONTENT
  // ---------------------------------------------------------------------------
  async getContent() {
    return await AdminAuth.fetchWithAuth('/api/content');
  },

  async updateContent(sectionKey, contentJson) {
    return await AdminAuth.fetchWithAuth(`/api/content/${sectionKey}`, {
      method: 'PUT',
      body: JSON.stringify({ content: contentJson })
    });
  },

  // ---------------------------------------------------------------------------
  // SETTINGS
  // ---------------------------------------------------------------------------
  async getSettings() {
    return await AdminAuth.fetchWithAuth('/api/settings');
  },

  async updateSettings(settingsObj) {
    return await AdminAuth.fetchWithAuth('/api/settings', {
      method: 'PUT',
      body: JSON.stringify(settingsObj)
    });
  },

  // ---------------------------------------------------------------------------
  // IMAGE UPLOAD
  // ---------------------------------------------------------------------------
  async uploadImage(file) {
    const formData = new FormData();
    formData.append('image', file);

    const token = AdminAuth.getToken();
    const res = await fetch('/api/upload', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`
      },
      body: formData
    });
    return await res.json();
  }
};
