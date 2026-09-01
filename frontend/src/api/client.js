import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_UR || 'http://localhost:5000/api',
});

// Automatically attach the JWT token (if we have one) to every request,
// so individual pages don't need to remember to do this themselves.
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Add response interceptor to log errors (toast handling stays in components)
api.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error('API Error:', error);
    return Promise.reject(error);
  }
);

export default api;