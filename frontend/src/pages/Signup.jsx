import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { signup } from '../api/auth.js';
import { useToast } from '../context/ToastContext';

export default function Signup() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', password: '', college: '' });
  const [loading, setLoading] = useState(false);
  const { addToast } = useToast();

  function handleChange(e) {
    setForm({ ...form, [e.target.name]: e.target.value });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    try {
      const { user, token } = await signup(form);
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(user));
      addToast('Account created successfully!', 'success');
      navigate('/dashboard');
    } catch (err) {
      const errorMessage = err.response?.data?.error || 'Signup failed. Please try again.';
      addToast(errorMessage, 'error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-container">
        <form onSubmit={handleSubmit} className="auth-form">
          <h1>Create your account</h1>

          <label>
            Name
            <input
              name="name"
              value={form.name}
              onChange={handleChange}
              required
              placeholder="Enter your full name"
            />
          </label>

          <label>
            Email
            <input
              type="email"
              name="email"
              value={form.email}
              onChange={handleChange}
              required
              placeholder="Enter your email address"
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
              minLength={6}
              placeholder="Create a password"
            />
          </label>

          <label>
            College (optional)
            <input
              name="college"
              value={form.college}
              onChange={handleChange}
              placeholder="Your college/university (optional)"
            />
          </label>

          <button type="submit" disabled={loading}>
            {loading ? 'Creating account...' : 'Sign up'}
          </button>

          <p>
            Already have an account? <Link to="/login">Log in</Link>
          </p>
        </form>
      </div>
    </div>
  );
}