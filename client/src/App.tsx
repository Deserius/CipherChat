import { Navigate, Route, Routes, useParams } from 'react-router-dom';
import Landing from './pages/Landing';
import RoomPage from './pages/Room';
import { PrivacyPage, TermsPage } from './pages/Legal';
import AboutPage from './pages/About';
import { DestroyedPage, ErrorPage, LeftPage } from './pages/Status';

function JoinRedirect() {
  const { code } = useParams();
  return <Navigate to={`/${code ? `?room=${code}` : ''}`} replace={false} />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/r/:code" element={<Landing />} />
      <Route path="/room/:code" element={<RoomPage />} />
      <Route path="/privacy" element={<PrivacyPage />} />
      <Route path="/terms" element={<TermsPage />} />
      <Route path="/about" element={<AboutPage />} />
      <Route path="/left" element={<LeftPage />} />
      <Route path="/destroyed" element={<DestroyedPage />} />
      <Route path="/error" element={<ErrorPage />} />
      <Route path="/join/:code" element={<JoinRedirect />} />
      <Route path="*" element={<Landing />} />
    </Routes>
  );
}
