import React, { useState } from 'react';

const API_URL = import.meta.env.VITE_API_URL || '';

export default function LoginRegister({ onLoginSuccess, showToast }) {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password || (!isLogin && !name)) {
      showToast('Please fill out all fields', 'error');
      return;
    }

    setLoading(true);
    const endpoint = isLogin ? '/api/auth/login' : '/api/auth/register';
    const payload = isLogin ? { email, password } : { email, password, name };

    try {
      const response = await fetch(`${API_URL}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Something went wrong');
      }

      if (isLogin) {
        showToast('Login successful!', 'success');
        onLoginSuccess(data.token);
      } else {
        showToast('Registration successful! Please login.', 'success');
        setIsLogin(true);
        setPassword('');
      }
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: '450px', margin: '4rem auto', width: '100%' }} className="glass-panel animate-fade-in">
      <div style={{ padding: '2.5rem' }}>
        <h2 style={{ fontSize: '2rem', marginBottom: '0.5rem', textAlign: 'center', fontWeight: '700' }}>
          {isLogin ? 'Welcome Back' : 'Get Started'}
        </h2>
        <p style={{ color: 'var(--text-muted)', textAlign: 'center', marginBottom: '2rem', fontSize: '0.95rem' }}>
          {isLogin ? 'Sign in to access your PlaceMux workspace' : 'Create an account to start mock interviews'}
        </p>

        <form onSubmit={handleSubmit}>
          {!isLogin && (
            <div className="form-group">
              <label className="form-label">Full Name</label>
              <input
                type="text"
                className="form-input"
                placeholder="John Doe"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
          )}

          <div className="form-group">
            <label className="form-label">Email Address</label>
            <input
              type="email"
              className="form-input"
              placeholder="candidate@placemux.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Password</label>
            <input
              type="password"
              className="form-input"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: '100%', marginTop: '1rem', padding: '0.9rem' }}
            disabled={loading}
          >
            {loading ? 'Please wait...' : isLogin ? 'Sign In' : 'Create Account'}
          </button>
        </form>

        <div style={{ marginTop: '2rem', textAlign: 'center', fontSize: '0.9rem' }}>
          <span style={{ color: 'var(--text-muted)' }}>
            {isLogin ? "Don't have an account? " : 'Already have an account? '}
          </span>
          <button
            onClick={() => {
              setIsLogin(!isLogin);
              setEmail('');
              setPassword('');
              setName('');
            }}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--accent-secondary)',
              cursor: 'pointer',
              fontWeight: '600',
              fontFamily: 'var(--font-family)',
              textDecoration: 'underline'
            }}
          >
            {isLogin ? 'Sign Up' : 'Sign In'}
          </button>
        </div>
      </div>
    </div>
  );
}
