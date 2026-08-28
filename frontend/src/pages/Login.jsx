import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { login } from '../api/auth.js';
import { useToast } from '../context/ToastContext';

export default function Login() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const { addToast } = useToast();

  function handleChange(e) {
    setForm({ ...form, [e.target.name]: e.target.value });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    try {
      const { user, token } = await login(form);
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(user));
      addToast('Login successful!', 'success');
      navigate('/dashboard');
    } catch (err) {
      const errorMessage = err.response?.data?.error || 'Login failed. Please try again.';
      addToast(errorMessage, 'error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-container">
        <form onSubmit={handleSubmit} className="auth-form">
          <h1>Welcome Back</h1>

          <label>
            Email
            <input
              type="email"
              name="email"
              value={form.email}
              onChange={handleChange}
              required
              placeholder="Enter your email"
            />
          </label>

          <label>
            Password
            <input
              type="password"
              name="password"
              value={form.password}
              onChange={handleChange}
              required
              placeholder="Enter your password"
            />
          </label>

          <button type="submit" disabled={loading}>
            {loading ? 'Logging in...' : 'Log in'}
          </button>

          <p>
            Don't have an account? <Link to="/signup">Sign up</Link>
          </p>
        </form>
      </div>
    </div>
  );
}