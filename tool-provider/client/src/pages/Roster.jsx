import { useState, useEffect } from 'react';

function Roster({ session, sessionId }) {
  const [membership, setMembership] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/nrps/${sessionId}`)
      .then(res => res.json())
      .then(data => { setMembership(data); setLoading(false); })
      .catch(err => { console.error(err); setLoading(false); });
  }, [sessionId]);

  if (loading) return <div className="loading">Loading roster...</div>;
  if (!membership) return <div className="alert alert-warning">NRPS data not available</div>;

  const roleColor = (role) => {
    if (role.includes('Instructor')) return '#007bff';
    if (role.includes('TeachingAssistant')) return '#6f42c1';
    return '#28a745';
  };

  const roleLabel = (role) => {
    if (role.includes('Instructor')) return 'Instructor';
    if (role.includes('TeachingAssistant')) return 'TA';
    return 'Student';
  };

  const initials = (name) => name.split(' ').map(n => n[0]).join('');

  const instructors = membership.members.filter(m => m.roles.some(r => r.includes('Instructor')));
  const students = membership.members.filter(m => m.roles.some(r => r.includes('Learner')));
  const tas = membership.members.filter(m => m.roles.some(r => r.includes('TeachingAssistant')));

  return (
    <div>
      <div className="page-header">
        <h1>Course Roster (NRPS)</h1>
        <p>Names and Role Provisioning Service — membership data from the LMS</p>
      </div>

      <div className="alert alert-info">
        💡 The tool fetches this data from the platform NRPS endpoint provided in the LTI launch claims.
        This is a server-side API call — the tool backend requests it, not the browser.
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 20 }}>
        <div className="card" style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 28, fontWeight: 700, color: '#007bff' }}>{instructors.length}</div>
          <div style={{ fontSize: 13, color: '#666' }}>Instructors</div>
        </div>
        <div className="card" style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 28, fontWeight: 700, color: '#6f42c1' }}>{tas.length}</div>
          <div style={{ fontSize: 13, color: '#666' }}>Teaching Assistants</div>
        </div>
        <div className="card" style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 28, fontWeight: 700, color: '#28a745' }}>{students.length}</div>
          <div style={{ fontSize: 13, color: '#666' }}>Students</div>
        </div>
      </div>

      <div className="card">
        <h3>Course: {membership.context.title}</h3>
        <p style={{ color: '#666', marginBottom: 16 }}>
          Context ID: <code>{membership.context.id}</code>
        </p>

        {membership.members.map(member => (
          <div key={member.user_id} className="member-row">
            <div className="member-avatar" style={{ background: roleColor(member.roles[0]) }}>
              {initials(member.name)}
            </div>
            <div className="member-info">
              <div className="name">{member.name}</div>
              <div className="email">{member.email}</div>
            </div>
            <div>
              {member.roles.map(role => (
                <span key={role} className="badge" style={{ background: roleColor(role), marginLeft: 4 }}>
                  {roleLabel(role)}
                </span>
              ))}
            </div>
            <div style={{ fontSize: 12, color: '#999' }}>{member.user_id}</div>
          </div>
        ))}
      </div>

      <div className="card">
        <h3>NRPS Service Details</h3>
        <table style={{ width: '100%', fontSize: 14 }}>
          <tbody>
            <tr><td style={{ width: 140, color: '#666' }}>Endpoint</td><td><code>{session.claims['https://purl.imsglobal.org/spec/lti-nrps/claim/namesroleservice']?.context_memberships_url}</code></td></tr>
            <tr><td style={{ color: '#666' }}>Version</td><td>2.0</td></tr>
            <tr><td style={{ color: '#666' }}>Members</td><td>{membership.members.length}</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default Roster;
