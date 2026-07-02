import React, { useState, useEffect } from 'react';
import LoginRegister from './components/LoginRegister';
import CandidateDashboard from './components/CandidateDashboard';
import AdminDashboard from './components/AdminDashboard';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3010';

export default function App() {
  const [token, setToken] = useState(localStorage.getItem('token') || '');
  const [user, setUser] = useState(null);
  const [activeTab, setActiveTab] = useState('candidate'); // 'candidate' or 'admin'
  const [toast, setToast] = useState(null);

  // Global Toast System
  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => {
      setToast(null);
    }, 4000);
  };

  const fetchProfile = async (authToken) => {
    try {
      const response = await fetch(`${API_URL}/api/auth/me`, {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      const data = await response.json();
      if (response.ok && data.user) {
        setUser(data.user);
      } else {
        // Token invalid/expired
        handleLogout();
      }
    } catch (err) {
      console.error('Failed to load user profile:', err);
    }
  };

  useEffect(() => {
    if (token) {
      fetchProfile(token);
    }
  }, [token]);

  const handleLoginSuccess = (newToken) => {
    localStorage.setItem('token', newToken);
    setToken(newToken);
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    setToken('');
    setUser(null);
    setActiveTab('candidate');
    showToast('Logged out successfully', 'success');
  };

  return (
    <div>
      {/* Toast Alert */}
      {toast && (
        <div className={`toast toast-${toast.type}`}>
          {toast.type === 'success' ? '✅' : '❌'} {toast.message}
        </div>
      )}

      {/* Navigation Navbar */}
      <nav className="navbar">
        <div className="brand">
          <div className="brand-dot"></div>
          PlaceMux
        </div>
        {token && user && (
          <div className="nav-links">
            <span style={{ color: 'var(--text-muted)', fontSize: '0.95rem', marginRight: '1rem' }}>
              Hi, <strong style={{ color: 'var(--text-main)' }}>{user.name}</strong>
            </span>
            <button
              onClick={() => setActiveTab('candidate')}
              className={`nav-item ${activeTab === 'candidate' ? 'active' : ''}`}
              style={{ background: 'none', border: 'none', fontFamily: 'var(--font-family)', fontWeight: '600' }}
            >
              Candidate Console
            </button>
            <button
              onClick={() => setActiveTab('admin')}
              className={`nav-item ${activeTab === 'admin' ? 'active' : ''}`}
              style={{ background: 'none', border: 'none', fontFamily: 'var(--font-family)', fontWeight: '600' }}
            >
              Admin Console
            </button>
            <button
              onClick={handleLogout}
              className="nav-item nav-btn-logout"
              style={{ background: 'rgba(255, 23, 68, 0.1)', border: '1px solid rgba(255, 23, 68, 0.2)', padding: '0.4rem 1rem', borderRadius: '8px', cursor: 'pointer', fontFamily: 'var(--font-family)' }}
            >
              Logout
            </button>
          </div>
        )}
      </nav>

      {/* Main Content Area */}
      <main className="main-container">
        {!token ? (
          <LoginRegister onLoginSuccess={handleLoginSuccess} showToast={showToast} />
        ) : (
          <div>
            {activeTab === 'candidate' ? (
              <CandidateDashboard token={token} showToast={showToast} />
            ) : (
              <AdminDashboard token={token} showToast={showToast} />
            )}
          </div>
        )}
      </main>
    </div>
  );
}
