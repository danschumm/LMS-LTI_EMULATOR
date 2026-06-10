import { useState, useEffect } from 'react';

function GradesRest({ session, sessionId }) {
  const [columns, setColumns] = useState([]);
  const [users, setUsers] = useState([]);
  const [grades, setGrades] = useState(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState(null);

  useEffect(() => {
    Promise.all([
      fetch(`/api/rest/${sessionId}/gradebook/columns`).then(r => r.json()),
      fetch(`/api/rest/${sessionId}/users`).then(r => r.json())
    ]).then(([colData, userData]) => {
      setColumns(colData.results || []);
      setUsers(userData.results || []);
      setLoading(false);
    }).catch(err => { console.error(err); setLoading(false); });
  }, [sessionId]);

  const viewGrades = async (columnId) => {
    const response = await fetch(`/api/rest/${sessionId}/gradebook/columns/${columnId}/users`);
    const data = await response.json();
    setGrades({ columnId, data: data.results || [] });
  };

  const submitGrade = async (columnId) => {
    const userId = prompt('Enter User ID (e.g., user-456):');
    const score = prompt('Enter Score:');
    const notes = prompt('Notes (optional):') || '';
    if (!userId || !score) return;

    const response = await fetch(`/api/rest/${sessionId}/gradebook/columns/${columnId}/users/${userId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ score: parseFloat(score), notes })
    });

    if (response.ok) {
      setMessage({ type: 'success', text: `Grade ${score} submitted for ${userId} via REST API` });
      setTimeout(() => setMessage(null), 4000);
    }
  };

  if (loading) return <div className="loading">Loading REST API data...</div>;

  return (
    <div>
      <div className="page-header">
        <h1>Grades (REST API)</h1>
        <p>Manage grades using the Learn REST API with a 3LO bearer token</p>
      </div>

      <div className="alert alert-info">
        💡 This page demonstrates calling the <strong>Learn REST API</strong> directly using a bearer token
        obtained via 3-Legged OAuth (3LO). Unlike AGS (which uses LTI service endpoints), REST API calls
        go to <code>/learn/api/public/v3/...</code> with an <code>Authorization: Bearer</code> header.
      </div>

      {!session.accessToken && (
        <div className="alert alert-error">
          ⚠️ No access token available. The 3LO flow may not have completed. Try re-launching from the LMS.
        </div>
      )}

      {session.accessToken && (
        <div className="card">
          <h3>🔑 Bearer Token</h3>
          <div style={{ background: '#1e1e1e', color: '#d4d4d4', padding: 12, borderRadius: 6, fontSize: 12, wordBreak: 'break-all' }}>
            <span style={{ color: '#569cd6' }}>Authorization:</span> Bearer {session.accessToken}
          </div>
          <p style={{ fontSize: 12, color: '#666', marginTop: 8 }}>
            This token was obtained via 3LO during the LTI launch. It authorizes REST API calls to the platform.
          </p>
        </div>
      )}

      {message && <div className={`alert alert-${message.type}`}>✅ {message.text}</div>}

      <div className="card">
        <h3>📊 Gradebook Columns</h3>
        <p style={{ fontSize: 12, color: '#666', marginBottom: 12 }}>
          <code>GET /learn/api/public/v3/courses/:courseId/gradebook/columns</code>
        </p>
        {columns.length === 0 ? (
          <p style={{ color: '#666' }}>No gradebook columns found.</p>
        ) : (
          columns.map(col => (
            <div key={col.id} className="line-item">
              <div>
                <strong>{col.name}</strong>
                <div style={{ fontSize: 12, color: '#666' }}>
                  Max: {col.score?.possible} | ID: {col.id}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button className="btn btn-success btn-sm" onClick={() => submitGrade(col.id)}>
                  Submit Grade
                </button>
                <button className="btn btn-info btn-sm" onClick={() => viewGrades(col.id)}>
                  View Grades
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {grades && (
        <div className="card">
          <h3>Grades for Column {grades.columnId}</h3>
          <p style={{ fontSize: 12, color: '#666', marginBottom: 12 }}>
            <code>GET /learn/api/public/v3/courses/:courseId/gradebook/columns/{grades.columnId}/users</code>
          </p>
          {grades.data.length === 0 ? (
            <p style={{ color: '#666' }}>No grades submitted yet.</p>
          ) : (
            <table style={{ width: '100%', fontSize: 14 }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #dee2e6' }}>
                  <th style={{ textAlign: 'left', padding: 8 }}>User</th>
                  <th style={{ textAlign: 'left', padding: 8 }}>Score</th>
                  <th style={{ textAlign: 'left', padding: 8 }}>Status</th>
                  <th style={{ textAlign: 'left', padding: 8 }}>Notes</th>
                </tr>
              </thead>
              <tbody>
                {grades.data.map(g => (
                  <tr key={g.userId} style={{ borderBottom: '1px solid #eee' }}>
                    <td style={{ padding: 8 }}>{g.userId}</td>
                    <td style={{ padding: 8 }}><strong>{g.score}</strong></td>
                    <td style={{ padding: 8 }}><span className="badge badge-learner">{g.status}</span></td>
                    <td style={{ padding: 8, color: '#666' }}>{g.notes || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      <div className="card">
        <h3>👥 Course Users</h3>
        <p style={{ fontSize: 12, color: '#666', marginBottom: 12 }}>
          <code>GET /learn/api/public/v3/courses/:courseId/users</code>
        </p>
        <table style={{ width: '100%', fontSize: 14 }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #dee2e6' }}>
              <th style={{ textAlign: 'left', padding: 8 }}>User ID</th>
              <th style={{ textAlign: 'left', padding: 8 }}>Username</th>
              <th style={{ textAlign: 'left', padding: 8 }}>Name</th>
              <th style={{ textAlign: 'left', padding: 8 }}>Role</th>
            </tr>
          </thead>
          <tbody>
            {users.map(u => (
              <tr key={u.userId} style={{ borderBottom: '1px solid #eee' }}>
                <td style={{ padding: 8 }}><code>{u.userId}</code></td>
                <td style={{ padding: 8 }}>{u.userName}</td>
                <td style={{ padding: 8 }}>{u.name?.given} {u.name?.family}</td>
                <td style={{ padding: 8 }}><span className={`badge badge-${u.courseRoleId === 'Instructor' ? 'instructor' : 'learner'}`}>{u.courseRoleId}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card">
        <h3>REST API vs AGS Comparison</h3>
        <table style={{ width: '100%', fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #dee2e6' }}>
              <th style={{ textAlign: 'left', padding: 8 }}></th>
              <th style={{ textAlign: 'left', padding: 8 }}>REST API</th>
              <th style={{ textAlign: 'left', padding: 8 }}>AGS (LTI)</th>
            </tr>
          </thead>
          <tbody>
            <tr style={{ borderBottom: '1px solid #eee' }}>
              <td style={{ padding: 8, color: '#666' }}>Auth</td>
              <td style={{ padding: 8 }}>Bearer token (3LO)</td>
              <td style={{ padding: 8 }}>OAuth 2.0 client credentials</td>
            </tr>
            <tr style={{ borderBottom: '1px solid #eee' }}>
              <td style={{ padding: 8, color: '#666' }}>Endpoint</td>
              <td style={{ padding: 8 }}><code>/learn/api/public/v3/...</code></td>
              <td style={{ padding: 8 }}>URLs from LTI claims</td>
            </tr>
            <tr style={{ borderBottom: '1px solid #eee' }}>
              <td style={{ padding: 8, color: '#666' }}>Scope</td>
              <td style={{ padding: 8 }}>Full platform API access</td>
              <td style={{ padding: 8 }}>Limited to LTI scopes</td>
            </tr>
            <tr>
              <td style={{ padding: 8, color: '#666' }}>Use case</td>
              <td style={{ padding: 8 }}>Rich integrations, user context</td>
              <td style={{ padding: 8 }}>Standard LTI grade passback</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default GradesRest;
