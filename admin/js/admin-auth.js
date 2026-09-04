/**
 * Vandi Load - Admin Authentication & API Fetch Helper
 * Handles session tokens, route protection, and authenticated fetch requests.
 */

const AdminAuth = {
  TOKEN_KEY: 'vandiload_admin_token',
  USER_KEY: 'vandiload_admin_user',

  getToken() {
    return sessionStorage.getItem(this.TOKEN_KEY);
  },

  getUser() {
    try {
      const u = sessionStorage.getItem(this.USER_KEY);
      return u ? JSON.parse(u) : null;
    } catch (e) {
      return null;
    }
  },

  isAuthenticated() {
    return !!this.getToken();
  },

  async login(username, password) {
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      const data = await res.json();

      if (data.success && data.token) {
        sessionStorage.setItem(this.TOKEN_KEY, data.token);
        sessionStorage.setItem(this.USER_KEY, JSON.stringify(data.admin || { username, email: username, fullName: 'Admin' }));
        // Clean up any old localStorage tokens
        localStorage.removeItem(this.TOKEN_KEY);
        localStorage.removeItem(this.USER_KEY);
        return { success: true };
      }
      return { success: false, message: data.message || 'Invalid email or password' };
    } catch (err) {
      return { success: false, message: 'Server connection error. Please verify the server is running.' };
    }
  },

  logout() {
    try {
      if (typeof AdminApp !== 'undefined' && AdminApp.realtimeSource) {
        AdminApp.realtimeSource.close();
      }
    } catch (e) {}
    sessionStorage.removeItem(this.TOKEN_KEY);
    sessionStorage.removeItem(this.USER_KEY);
    localStorage.removeItem(this.TOKEN_KEY);
    localStorage.removeItem(this.USER_KEY);
    window.location.href = 'login.html';
  },

  requireAuth() {
    if (!this.isAuthenticated()) {
      window.location.href = 'login.html';
      return false;
    }
    return true;
  },

  /**
   * Centralized Authenticated Fetch Method
   * Handles Bearer authorization, JSON conversion, and automatic 401 logout
   */
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
      if (res.status === 401) {
        console.warn('Session expired or unauthorized. Redirecting to login.');
        this.logout();
        return { success: false, message: 'Session expired' };
      }
      const data = await res.json();
      return data;
    } catch (err) {
      console.error(`API request error on ${url}:`, err);
      return { success: false, message: err.message || 'API request failed' };
    }
  }
};
