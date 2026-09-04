/**
 * Vandi Load - Driver Portal API Client
 * Centralized client for fetching driver dashboard metrics, assigned orders, and updating trip statuses.
 */

const DriverAPI = {
  async getProfile() {
    return await DriverAuth.fetchWithAuth('/api/driver/profile');
  },

  async getOrders(status = 'all', search = '') {
    let url = '/api/driver/orders';
    const params = new URLSearchParams();
    if (status && status !== 'all') params.append('status', status);
    if (search) params.append('search', search);
    if (params.toString()) url += `?${params.toString()}`;

    return await DriverAuth.fetchWithAuth(url);
  },

  async getOrder(id) {
    return await DriverAuth.fetchWithAuth(`/api/driver/orders/${id}`);
  },

  async updateTripStatus(id, assignmentStatus, notes = '') {
    return await DriverAuth.fetchWithAuth(`/api/driver/orders/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ assignmentStatus, notes })
    });
  },

  async changePassword(currentPassword, newPassword, confirmPassword) {
    return await DriverAuth.fetchWithAuth('/api/driver/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ currentPassword, newPassword, confirmPassword })
    });
  }
};
