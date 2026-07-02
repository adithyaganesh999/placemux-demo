import React, { useState, useEffect } from 'react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3010';

export default function AdminDashboard({ token, showToast }) {
  const [stats, setStats] = useState({ total_users: 0, total_companies: 0, total_interviews: 0 });
  const [loading, setLoading] = useState(true);

  // Form states
  const [name, setName] = useState('');
  const [industry, setIndustry] = useState('');
  const [description, setDescription] = useState('');
  const [addLoading, setAddLoading] = useState(false);

  const fetchStats = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/admin/stats`);
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch admin stats');
      }
      setStats(data);
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  const handleAddCompany = async (e) => {
    e.preventDefault();
    if (!name || !industry) {
      showToast('Company Name and Industry are required', 'error');
      return;
    }

    setAddLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/company`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ name, industry, description })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to create company');
      }

      showToast(`Company "${name}" registered successfully!`, 'success');
      setName('');
      setIndustry('');
      setDescription('');
      // Reload stats count
      fetchStats();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setAddLoading(false);
    }
  };

  return (
    <div className="animate-fade-in">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h2 style={{ fontSize: '2.2rem', fontWeight: '700' }}>Admin Console</h2>
          <p style={{ color: 'var(--text-muted)' }}>Aggregate microservice insights and directory management</p>
        </div>
        <button onClick={fetchStats} className="btn btn-secondary">
          Refresh Metrics
        </button>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '4rem' }}>
          <p style={{ color: 'var(--text-muted)', fontSize: '1.2rem' }}>Loading statistical nodes...</p>
        </div>
      ) : (
        <div>
          {/* Stats Widgets */}
          <div className="stats-grid">
            <div className="glass-panel stat-card">
              <span className="stat-label">Total Authenticated Users</span>
              <span className="stat-value">{stats.total_users}</span>
            </div>
            <div className="glass-panel stat-card">
              <span className="stat-label">Active Company Listings</span>
              <span className="stat-value">{stats.total_companies}</span>
            </div>
            <div className="glass-panel stat-card">
              <span className="stat-label">Booked Mock Interviews</span>
              <span className="stat-value">{stats.total_interviews}</span>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: '2.5rem' }}>
            {/* Create Company Form */}
            <div style={{ gridColumn: 'span 5' }} className="glass-panel">
              <div style={{ padding: '2rem' }}>
                <h3 style={{ fontSize: '1.4rem', fontWeight: '600', marginBottom: '1.5rem' }}>Register New Company</h3>
                <form onSubmit={handleAddCompany}>
                  <div className="form-group">
                    <label className="form-label">Company Name</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="e.g. Microsoft / Amazon"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Industry Sector</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="e.g. Cloud Computing / E-commerce"
                      value={industry}
                      onChange={(e) => setIndustry(e.target.value)}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Company Description</label>
                    <textarea
                      className="form-input"
                      rows="4"
                      placeholder="Enter company description and profile overview..."
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      style={{ resize: 'vertical', fontFamily: 'var(--font-family)' }}
                    />
                  </div>

                  <button
                    type="submit"
                    className="btn btn-primary"
                    style={{ width: '100%', marginTop: '1rem' }}
                    disabled={addLoading}
                  >
                    {addLoading ? 'Adding...' : 'Register Company'}
                  </button>
                </form>
              </div>
            </div>

            {/* Info panel */}
            <div style={{ gridColumn: 'span 7' }} className="glass-panel">
              <div style={{ padding: '2rem' }}>
                <h3 style={{ fontSize: '1.4rem', fontWeight: '600', marginBottom: '1.5rem' }}>System Infrastructure Log</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <p style={{ color: 'var(--text-muted)' }}>
                    This console utilizes the **Admin Service** (gRPC Port 5006 / HTTP Port 3006) which runs an aggregation loop. 
                    It directly requests database connection pools to aggregate total records across independent schemas:
                  </p>
                  <ul style={{ paddingLeft: '1.5rem', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <li>🔒 **users** table: located inside Neon `auth_db`.</li>
                    <li>🏢 **companies** table: located inside Neon `company_db`.</li>
                    <li>📅 **interviews** table: located inside Neon `interview_db`.</li>
                  </ul>
                  <div style={{ marginTop: '1rem', padding: '1rem', background: 'rgba(0, 0, 0, 0.2)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                    <span style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--accent-secondary)', display: 'block', marginBottom: '0.2rem' }}>
                      GATEWAY ROUTING LOG:
                    </span>
                    <code style={{ fontSize: '0.85rem', color: 'var(--text-main)' }}>
                      GET /api/admin/stats ──► gRPC AdminService.GetSystemStats()
                    </code>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
