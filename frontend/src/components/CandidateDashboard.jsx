import React, { useState, useEffect } from 'react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3010';

export default function CandidateDashboard({ token, showToast }) {
  const [companies, setCompanies] = useState([]);
  const [interviews, setInterviews] = useState([]);
  const [loading, setLoading] = useState(true);

  // Form states
  const [selectedCompanyId, setSelectedCompanyId] = useState('');
  const [role, setRole] = useState('');
  const [time, setTime] = useState('');
  const [scheduleLoading, setScheduleLoading] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      // 1. Fetch Companies
      const compRes = await fetch(`${API_URL}/api/company`);
      const compData = await compRes.json();
      setCompanies(Array.isArray(compData) ? compData : []);

      // 2. Fetch Interviews
      const intRes = await fetch(`${API_URL}/api/interview`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const intData = await intRes.json();
      setInterviews(Array.isArray(intData) ? intData : []);
    } catch (err) {
      showToast('Failed to load dashboard data: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [token]);

  const handleSchedule = async (e) => {
    e.preventDefault();
    if (!selectedCompanyId || !role || !time) {
      showToast('All scheduling fields are required', 'error');
      return;
    }

    setScheduleLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/interview`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          company_id: selectedCompanyId,
          role,
          scheduled_time: new Date(time).toISOString()
        })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to schedule interview');
      }

      showToast('Interview scheduled successfully!', 'success');
      setSelectedCompanyId('');
      setRole('');
      setTime('');
      // Reload interview list
      fetchData();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setScheduleLoading(false);
    }
  };

  const getCompanyName = (id) => {
    const comp = companies.find((c) => c.id === id);
    return comp ? comp.name : `Company #${id}`;
  };

  return (
    <div className="animate-fade-in">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h2 style={{ fontSize: '2.2rem', fontWeight: '700' }}>Candidate Dashboard</h2>
          <p style={{ color: 'var(--text-muted)' }}>Schedule and manage your mock interviews</p>
        </div>
        <button onClick={fetchData} className="btn btn-secondary">
          Refresh Data
        </button>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '4rem' }}>
          <p style={{ color: 'var(--text-muted)', fontSize: '1.2rem' }}>Loading workspace dashboard...</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: '2.5rem' }}>
          {/* Left panel: Schedule interview form */}
          <div style={{ gridColumn: 'span 4' }} className="glass-panel">
            <div style={{ padding: '2rem' }}>
              <h3 style={{ fontSize: '1.4rem', fontWeight: '600', marginBottom: '1.5rem' }}>Schedule Mock Slot</h3>
              <form onSubmit={handleSchedule}>
                <div className="form-group">
                  <label className="form-label">Target Company</label>
                  <select
                    className="form-input"
                    value={selectedCompanyId}
                    onChange={(e) => setSelectedCompanyId(e.target.value)}
                    required
                    style={{ background: 'rgba(10, 14, 26, 0.9)' }}
                  >
                    <option value="" disabled>Select a company...</option>
                    {companies.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.industry || 'Tech'})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Job Role</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. SDE-1 / Frontend Developer"
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Scheduled Time</label>
                  <input
                    type="datetime-local"
                    className="form-input"
                    value={time}
                    onChange={(e) => setTime(e.target.value)}
                    required
                    style={{ colorScheme: 'dark' }}
                  />
                </div>

                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ width: '100%', marginTop: '1rem' }}
                  disabled={scheduleLoading || companies.length === 0}
                >
                  {scheduleLoading ? 'Booking Slot...' : 'Schedule Interview'}
                </button>
              </form>
            </div>
          </div>

          {/* Right panel: Active interview list & companies */}
          <div style={{ gridColumn: 'span 8', display: 'flex', flexDirection: 'column', gap: '2.5rem' }}>
            {/* Interviews List */}
            <div className="glass-panel" style={{ padding: '2rem' }}>
              <h3 style={{ fontSize: '1.4rem', fontWeight: '600', marginBottom: '1.5rem' }}>My Scheduled Interviews</h3>
              {interviews.length === 0 ? (
                <div style={{ padding: '2rem', textAlign: 'center', border: '1px dashed var(--border-color)', borderRadius: '10px' }}>
                  <p style={{ color: 'var(--text-muted)' }}>No interviews scheduled yet. Use the booking slot tool to start!</p>
                </div>
              ) : (
                <div className="card-grid">
                  {interviews.map((item) => (
                    <div key={item.id} className="glass-panel card">
                      <div className="card-header">
                        <div>
                          <h4 className="card-title">{item.role}</h4>
                          <span style={{ fontSize: '0.9rem', color: 'var(--accent-secondary)', fontWeight: '500' }}>
                            {getCompanyName(item.company_id)}
                          </span>
                        </div>
                        <span className="card-tag tag-scheduled">{item.status}</span>
                      </div>
                      <div className="card-footer">
                        <span className="card-date">
                          📅 {new Date(item.scheduled_time).toLocaleString()}
                        </span>
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                          ID: #{item.id}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Registered Companies List */}
            <div className="glass-panel" style={{ padding: '2rem' }}>
              <h3 style={{ fontSize: '1.4rem', fontWeight: '600', marginBottom: '1.5rem' }}>Active Companies</h3>
              {companies.length === 0 ? (
                <p style={{ color: 'var(--text-muted)', textAlign: 'center' }}>No active companies found. Admin must add some.</p>
              ) : (
                <div className="card-grid">
                  {companies.map((c) => (
                    <div key={c.id} className="glass-panel card" style={{ gap: '0.8rem' }}>
                      <div className="card-header">
                        <h4 className="card-title">{c.name}</h4>
                        <span className="card-tag tag-tech">{c.industry || 'Technology'}</span>
                      </div>
                      <p className="card-body">{c.description || 'No description available.'}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
