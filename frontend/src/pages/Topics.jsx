import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getTopics } from '../api/questions.js';
import Navbar from '../components/Navbar.jsx';

export default function Topics() {
  const { skillAreaId } = useParams();
  const navigate = useNavigate();
  const [topics, setTopics] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    getTopics(skillAreaId)
      .then((data) => {
        setTopics(data);
        setLoading(false);
      })
      .catch(() => {
        setError('Failed to load topics. Please try again.');
        setLoading(false);
      });
  }, [skillAreaId]);

  if (loading) {
    return (
      <>
        <Navbar />
        <div className="dashboard">
          <div className="test-complete">
            <h1>Loading topics...</h1>
          </div>
        </div>
      </>
    );
  }

  if (error) {
    return (
      <>
        <Navbar />
        <div className="dashboard">
          <p className="error-text">{error}</p>
        </div>
      </>
    );
  }

  return (
    <>
      <Navbar />
      <div className="dashboard">
        <header>
          <h1>Choose a Topic</h1>
        </header>

        <section>
          {topics.length === 0 ? (
            <p className="no-data">No topics available for this skill area yet.</p>
          ) : (
            <div className="skill-area-grid">
              {topics.map((topic) => (
                <button
                  key={topic.id}
                  onClick={() => navigate(`/test/${skillAreaId}/${topic.id}`)}
                  className="skill-area-card"
                  disabled={Number(topic.question_count) === 0}
                >
                  <div className="skill-area-icon">📝</div>
                  <div className="skill-area-content">
                    <h3>{topic.name}</h3>
                    <p className="skill-area-description">
                      {Number(topic.question_count) === 0
                        ? 'No questions yet'
                        : `${topic.question_count} question${topic.question_count === '1' ? '' : 's'}`}
                    </p>
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