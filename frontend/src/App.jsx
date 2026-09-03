import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Signup from './pages/Signup.jsx';
import Login from './pages/Login.jsx';
import Dashboard from './pages/Dashboard.jsx';
import SkillAreas from './pages/SkillAreas.jsx';
import Topics from './pages/Topics.jsx';
import TakeTest from './pages/TakeTest.jsx';
import AdminQuestionUpload from './pages/AdminQuestionUpload.jsx';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<SkillAreas />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/admin/questions" element={<AdminQuestionUpload />} />
        <Route path="/login" element={<Login />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/practice" element={<SkillAreas />} />
        <Route path="/practice/:skillAreaId/topics" element={<Topics />} />
        <Route path="/test/:skillAreaId/:topicId" element={<TakeTest />} />
      </Routes>
    </BrowserRouter>
  );
}