import { Routes, Route, Navigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import Nav from './components/Nav';
import Launch from './pages/Launch';
import DeepLink from './pages/DeepLink';
import Roster from './pages/Roster';
import Grades from './pages/Grades';
import GradesRest from './pages/GradesRest';

function App() {
  const [session, setSession] = useState(null);
  const [sessionId, setSessionId] = useState(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sid = params.get('session');
    if (sid) {
      setSessionId(sid);
      fetch(`/api/session/${sid}`)
        .then(res => res.json())
        .then(data => setSession(data))
        .catch(err => console.error('Session fetch error:', err));
    }
  }, []);

  if (!sessionId) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
        <div className="card" style={{ textAlign: 'center', maxWidth: 500 }}>
          <h2>🔒 LTI Tool Provider</h2>
          <p style={{ marginTop: 12, color: '#666' }}>
            This tool must be launched from the LMS platform via LTI 1.3.
          </p>
          <p style={{ marginTop: 12 }}>
            <a href="http://localhost:3000/lms/course/123/launch?tool=demo" className="btn btn-primary">
              Go to LMS Launch Page
            </a>
          </p>
        </div>
      </div>
    );
  }

  if (!session) {
    return <div className="loading">Loading session...</div>;
  }

  return (
    <div className="app">
      <Nav session={session} sessionId={sessionId} />
      <div className="main">
        <Routes>
          <Route path="/launch" element={<Launch session={session} sessionId={sessionId} />} />
          <Route path="/deeplink" element={<DeepLink session={session} sessionId={sessionId} />} />
          <Route path="/roster" element={<Roster session={session} sessionId={sessionId} />} />
          <Route path="/grades" element={<Grades session={session} sessionId={sessionId} />} />
          <Route path="/grades-rest" element={<GradesRest session={session} sessionId={sessionId} />} />
          <Route path="*" element={<Navigate to={`/launch?session=${sessionId}`} />} />
        </Routes>
      </div>
    </div>
  );
}

export default App;
