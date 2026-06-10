import { NavLink, useSearchParams } from 'react-router-dom';

function Nav({ session }) {
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get('session');
  const qs = `?session=${sessionId}`;

  const claims = session.claims;
  const context = claims['https://purl.imsglobal.org/spec/lti/claim/context'];
  const messageType = claims['https://purl.imsglobal.org/spec/lti/claim/message_type'];

  return (
    <nav className="sidebar">
      <div className="brand">🛠️ LTI Tool</div>

      <div style={{ padding: '0 20px 16px', fontSize: 13, color: '#aaa' }}>
        <div><strong style={{ color: '#fff' }}>{claims.name}</strong></div>
        <div>{context?.title}</div>
        <div style={{ marginTop: 4, fontSize: 11, color: '#666' }}>{messageType}</div>
      </div>

      <h2>Navigation</h2>
      <NavLink to={`/launch${qs}`}>📋 Launch Claims</NavLink>
      <NavLink to={`/deeplink${qs}`}>🔗 Deep Linking</NavLink>
      <NavLink to={`/roster${qs}`}>👥 Course Roster</NavLink>
      <NavLink to={`/grades${qs}`}>📊 Grades (AGS)</NavLink>
      <NavLink to={`/grades-rest${qs}`}>🔌 Grades (REST)</NavLink>

      <div style={{ padding: '12px 20px' }}>
        <a
          href="http://localhost:3000/lms/course/123/launch?tool=demo"
          style={{ display: 'block', padding: '8px 12px', background: '#0066cc', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 13, textAlign: 'center', textDecoration: 'none' }}
        >
          ← Return to LMS
        </a>
      </div>

      <div style={{ padding: '20px', borderTop: '1px solid #333', fontSize: 12, color: '#666' }}>
        <div>Platform: localhost:3000</div>
        <div>Tool: localhost:3001</div>
        <div>Dev Portal: localhost:3002</div>
        <button
          onClick={() => fetch('http://localhost:3000/admin/clear-console', { method: 'POST' })}
          style={{ marginTop: 10, padding: '6px 12px', background: '#dc3545', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 11, width: '100%' }}
        >
          🧹 Clear Console
        </button>
      </div>
    </nav>
  );
}

export default Nav;
