const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:5000/api').replace(/\/$/, '');

export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

export async function request(path, { token, ...options } = {}) {
  let response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      ...options,
      headers: {
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options.headers
      }
    });
  } catch (error) {
    if (error?.name === 'AbortError') throw error;
    throw new ApiError('Could not reach ExpenseTrack. Check that the backend is running and try again.');
  }

  if (response.status === 204) return null;
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 401 && token) window.dispatchEvent(new Event('expensetrack:unauthorized'));
    throw new ApiError(payload.message || 'The request could not be completed.', response.status);
  }
  return payload;
}

export const authApi = {
  register: (name, email, password) => request('/auth/register', { method: 'POST', body: JSON.stringify({ name, email, password }) }),
  login: (email, password) => request('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  me: token => request('/auth/me', { token })
};

export const expensesApi = {
  list: (token, filters, signal) => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => { if (value !== '' && value !== undefined && value !== null) params.set(key, value); });
    const query = params.size ? `?${params.toString()}` : '';
    return request(`/expenses${query}`, { token, signal });
  },
  create: (token, expense) => request('/expenses', { token, method: 'POST', body: JSON.stringify(expense) }),
  update: (token, id, expense) => request(`/expenses/${encodeURIComponent(id)}`, { token, method: 'PUT', body: JSON.stringify(expense) }),
  remove: (token, id) => request(`/expenses/${encodeURIComponent(id)}`, { token, method: 'DELETE' })
};
