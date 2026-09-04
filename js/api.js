/**
 * Vandi Load - Public Client API Service
 */

const ClientAPI = {
  async getCategories() {
    try {
      const res = await fetch('/api/categories');
      const json = await res.json();
      return json.success ? json.data : null;
    } catch (e) {
      console.warn('Using local categories fallback');
      return null;
    }
  },

  async getVehicles() {
    try {
      const res = await fetch('/api/vehicles');
      const json = await res.json();
      return json.success ? json.data : null;
    } catch (e) {
      console.warn('Using local vehicle data fallback');
      return null;
    }
  },

  async getGallery() {
    try {
      const res = await fetch('/api/gallery');
      const json = await res.json();
      return json.success ? json.data : null;
    } catch (e) {
      console.warn('Using local gallery data fallback');
      return null;
    }
  },

  async getContent() {
    try {
      const res = await fetch('/api/content');
      const json = await res.json();
      return json.success ? json.data : null;
    } catch (e) {
      return null;
    }
  },

  async getSettings() {
    try {
      const res = await fetch('/api/settings');
      const json = await res.json();
      return json.success ? json.data : null;
    } catch (e) {
      return null;
    }
  },

  async submitEnquiry(data) {
    const res = await fetch('/api/enquiries', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    return await res.json();
  },

  async submitDriverApplication(data) {
    const isFormData = typeof FormData !== 'undefined' && data instanceof FormData;
    const res = await fetch('/api/driver-applications', {
      method: 'POST',
      headers: isFormData ? {} : { 'Content-Type': 'application/json' },
      body: isFormData ? data : JSON.stringify(data)
    });
    return await res.json();
  }
};
