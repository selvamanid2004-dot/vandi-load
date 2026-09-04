/**
 * Vandi Load - Driver Authentication Helper
 * Manages driver token lifecycle, session persistence, and authenticated fetch requests.
 */

const DriverAuth = {
  TOKEN_KEY: 'vandiload_driver_token',
  PROFILE_KEY: 'vandiload_driver_profile',

  getToken() {
    return sessionStorage.getItem(this.TOKEN_KEY);
  },

  getDriver() {
    try {
      const data = sessionStorage.getItem(this.PROFILE_KEY);
      return data ? JSON.parse(data) : null;
    } catch (e) {
      return null;
    }
  },

  isAuthenticated() {
    return !!this.getToken();
  },

  async login(phone, password) {
    try {
      const res = await fetch('/api/driver/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, password })
      });
      const data = await res.json();

      if (data.success && data.token) {
        sessionStorage.setItem(this.TOKEN_KEY, data.token);
        sessionStorage.setItem(this.PROFILE_KEY, JSON.stringify(data.driver));
        // Clean up legacy localStorage tokens
        localStorage.removeItem(this.TOKEN_KEY);
        localStorage.removeItem(this.PROFILE_KEY);
        return { success: true, driver: data.driver };
      }

      return { success: false, message: data.message || 'Login failed' };
    } catch (err) {
      return { success: false, message: 'Server connection error. Please try again.' };
    }
  },

  logout() {
    sessionStorage.removeItem(this.TOKEN_KEY);
    sessionStorage.removeItem(this.PROFILE_KEY);
    localStorage.removeItem(this.TOKEN_KEY);
    localStorage.removeItem(this.PROFILE_KEY);
    window.location.href = '/driver/login.html';
  },

  requireAuth() {
    if (!this.isAuthenticated()) {
      window.location.href = '/driver/login.html';
      return false;
    }
    return true;
  },

  async fetchWithAuth(url, options = {}) {
    const token = this.getToken();
    if (!token) {
      this.logout();
      return { success: false, message: 'Unauthenticated' };
    }

    const defaultHeaders = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    };

    const finalOptions = {
      ...options,
      headers: {
        ...defaultHeaders,
        ...(options.headers || {})
      }
    };

    try {
      const res = await fetch(url, finalOptions);
      if (res.status === 401 || res.status === 403) {
        console.warn('Driver session invalid or expired.');
        this.logout();
        return { success: false, message: 'Session expired' };
      }
      return await res.json();
    } catch (err) {
      console.error(`Driver API error on ${url}:`, err);
      return { success: false, message: err.message || 'API request failed' };
    }
  }
};
