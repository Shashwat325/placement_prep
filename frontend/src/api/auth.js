import api from './client.js';

export async function signup({ name, email, password, college }) {
  const res = await api.post('/auth/signup', { name, email, password, college });
  return res.data; // { user, token }
}

export async function login({ email, password }) {
  const res = await api.post('/auth/login', { email, password });
  return res.data; // { user, token }
}