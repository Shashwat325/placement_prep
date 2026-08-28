import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/client.js';
import { useToast } from '../context/ToastContext';
import Navbar from '../components/Navbar.jsx';

export default function Dashboard() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const { addToast } = useToast();

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      navigate('/login');
      return;
    }

    api.get('/profile')
      .then((res) => setProfile(res.data))
      .catch(() => {
        addToast('Failed to load profile. Try logging in again.', 'error');
      })
      .finally(() => setLoading(false));
  }, [navigate, addToast]);

  if (loading) return (
    <>
      <Navbar />
      <div className="dashboard">
        <div className="test-complete">
          <h1>Loading your dashboard...</h1>
          <p>Fetching your data</p>
        </div>
      </div>
    </>
  );
  if (!profile) return (
    <>
      <Navbar />
      <div className="dashboard">
        <p>Loading your dashboard...</p>
      </div>
    </>
  );

  return (
    <>
      <Navbar />
      <div className="dashboard">
        <header>
          <h1 className='text-black'>Welcome back, {profile.user.name}</h1>
        </header>

        <section>
          <h2>Your Progress Overview</h2>
          <div className="stats-grid">
            <div className="card text-center bg-light border-0 shadow-sm stat-card">
              <div className="card-body">
                <h3 className="card-title fw-bold text-black">Topics Practiced</h3>
                <p className="card-text display-4 fw-bold">{profile.skills_practiced || 0}</p>
              </div>
            </div>
            <div className="card text-center bg-light border-0 shadow-sm stat-card">
              <div className="card-body">
                <h3 className="card-title fw-bold text-black">Tests Taken</h3>
                <p className="card-text display-4 fw-bold">{profile.tests_taken || 0}</p>
              </div>
            </div>
            <div className="card text-center bg-light border-0 shadow-sm stat-card">
              <div className="card-body">
                <h3 className="card-title fw-bold text-black">Average Score</h3>
                <p className="card-text display-4 fw-bold">{profile.average_score?.toFixed(1) || 0}%</p>
              </div>
            </div>
            <div className="card text-center bg-light border-0 shadow-sm stat-card">
              <div className="card-body">
                <h3 className="card-title fw-bold text-black">Streak</h3>
                <p className="card-text display-4 fw-bold">{profile.streak || 0} days</p>
              </div>
            </div>
          </div>
        </section>

        <section>
          <h2>Scores by Skill Area</h2>
          {profile.scores.length === 0 ? (
            <p className="no-data">No attempts yet — take a test to see your scores here.</p>
          ) : (
            <div className="score-cards card-body ">
              {profile.scores.map((s) => (
                <div key={s.skill_area} className="score-card fw-bold text-center text-black bg-light border-0 shadow-sm h-100">
                  <h3>{s.skill_area}</h3>
                  <div className="score-value fw-bold text-black">{Number(s.average_score).toFixed(1)}%</div>
                  <p className="score-subtext fw-bold">({s.attempts_count} attempts)</p>
                  <div className="score-bar ">
                    <div className="score-bar-fill" style={{ width: `${Math.min(s.average_score, 100)}%` }}></div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section>
          <h2>Recent Activity</h2>
          {profile.recentAttempts.length === 0 ? (
            <p className="no-data">No recent attempts yet.</p>
          ) : (
            <ul className="activity-list card">
              {profile.recentAttempts.map((a) => (
                <li key={a.id} className="activity-item">
                  <div className="activity-info">
                    <h4>{a.skill_area}</h4>
                    <p className="activity-date">{new Date(a.timestamp).toLocaleDateString()}</p>
                  </div>
                  <div className="activity-score">
                    {Number(a.total_score).toFixed(1)}%
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}