import axios from 'axios';

const isHttpDevServer = window.location.protocol.startsWith('http');

const api = axios.create({
  baseURL: isHttpDevServer ? '/api' : 'http://127.0.0.1:3001/api',
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Request interceptor - attach token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('u2crm_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor - handle auth errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 || error.response?.status === 403) {
      localStorage.removeItem('u2crm_token');
      localStorage.removeItem('u2crm_user');
      if (window.location.protocol === 'file:') {
        window.location.hash = '#/login';
      } else {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default api;
