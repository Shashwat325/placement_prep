import { NavLink, useNavigate } from 'react-router-dom';
import api from '../api/client.js';
import 'bootstrap/dist/css/bootstrap.min.css';
import { useState, useEffect } from 'react';
export default function Navbar() {
  const navigate = useNavigate();
  const user=JSON.parse(localStorage.getItem('user')) || null;
  const [profile, setProfile] = useState(null);
  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/login');
  };
  useEffect(() => {
    api.get('/profile')
      .then((response) => setProfile(response.data))
      .catch(() => setProfile(null));
  }, []);
  const linkClass = ({ isActive }) => `nav-link${isActive ? ' active fw-semibold' : ''}`;


  return (
    <nav className="navbar navbar-expand-lg d-flex align-items-center navbar-dark d-flex bg-dark flex-wrap px-3" style={{ zIndex: 1000, position: 'sticky', top: 0, height: "10vh" }}  >
      <div className="container-fluid d-flex align-items-stretch gap-3 flex-row flex-wrap">
        <NavLink className="navbar-brand" to="/dashboard">
          Placement Prep
        </NavLink>

        <button
          className="navbar-toggler"
          type="button"
          data-bs-toggle="collapse"
          data-bs-target="#mainNavbar"
          aria-controls="mainNavbar"
          aria-expanded="false"
          aria-label="Toggle navigation"
        >
          <span className="navbar-toggler-icon"></span>
        </button>

        <div className="collapse navbar-collapse align-items-center bg-dark" id="mainNavbar">
          <ul className="navbar-nav me-auto d-flex flex-column flex-lg-row mb-2 gap-lg-5 w-100 mb-lg-0">
            <li className="nav-item w-100 w-lg-auto">
              <NavLink className={linkClass} to="/dashboard">
                Dashboard
              </NavLink>
            </li>
            <li className="nav-item w-100 w-lg-auto">
              <NavLink className={linkClass} to="/practice">
                Practice a topic
              </NavLink>
            </li>
              {profile?.user?.role === 'admin' && (
                <li className="nav-item w-100 w-lg-auto">
                <NavLink className={linkClass} to="/admin/questions">
                  Questions
                </NavLink>
                </li>
              )}
          </ul>
          <button className="btn btn-outline-light px-3" onClick={handleLogout}>
            Logout
          </button>
        </div>
      </div>
    </nav>
  );
}