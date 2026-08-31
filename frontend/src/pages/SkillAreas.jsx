import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getSkillAreas } from '../api/questions.js';
import Navbar from '../components/Navbar.jsx';
import api from '../api/client.js';
export default function SkillAreas() {
  const navigate = useNavigate();
  const [areas, setAreas] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getSkillAreas()
      .then((data) => {
        setAreas(data);
        setLoading(false);
      })
      .catch(() => {
        setError('Failed to load skill areas.');
        setLoading(false);
      });
  }, []);

  if (loading) return (
    <>
      <Navbar />
      <div className="dashboard">
        <div className="test-complete">
          <h1>Loading topics...</h1>
          <p>Fetching available practice areas</p>
        </div>
      </div>
    </>
  );
  if (error) return (
    <>
      <Navbar />
      <div className="dashboard">
        <p className="error-text">{error}</p>
      </div>
    </>
  );
    function handlearea(area){
    if(area.type==='speaking'){
      api.post(`/interview/warmup`).catch(()=>{});
    }
    navigate(`/practice/${area.id}/topics`);
  }
  // Show all skill areas - speaking exercises now work with voice service integration
  const skillAreasToShow = areas;

  return (
    <>
      <Navbar />
      <div className="dashboard">
        <header>
          <h1>Choose a Topic to Practice</h1>
        </header>

        <section>
          <h2>Available Practice Areas</h2>
          {skillAreasToShow.length === 0 ? (
            <p className="no-data">No skill areas available yet. Please check back later.</p>
          ) : (
            <div className="skill-area-grid">
              {skillAreasToShow.map((area) => (
                <button
                  key={area.id}
                  onClick={() => handlearea(area)}
                  className="skill-area-card"
                >
                  <div className="skill-area-icon">{area.icon || '📚'}</div>
                  <div className="skill-area-content">
                    <h3>{area.name}</h3>
                    <p className="skill-area-description">{area.description || 'Practice and improve your skills'}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </section>
      </div>
    </>
  );
}