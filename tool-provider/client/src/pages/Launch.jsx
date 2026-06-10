import { useState } from 'react';

function Launch({ session }) {
  const [showRaw, setShowRaw] = useState(true);
  const claims = session.claims;

  const context = claims['https://purl.imsglobal.org/spec/lti/claim/context'];
  const roles = claims['https://purl.imsglobal.org/spec/lti/claim/roles'] || [];
  const messageType = claims['https://purl.imsglobal.org/spec/lti/claim/message_type'];
  const deploymentId = claims['https://purl.imsglobal.org/spec/lti/claim/deployment_id'];
  const resourceLink = claims['https://purl.imsglobal.org/spec/lti/claim/resource_link'];
  const platform = claims['https://purl.imsglobal.org/spec/lti/claim/tool_platform'];
  const nrps = claims['https://purl.imsglobal.org/spec/lti-nrps/claim/namesroleservice'];
  const ags = claims['https://purl.imsglobal.org/spec/lti-ags/claim/endpoint'];

  const roleLabels = roles.map(r => r.split('#').pop());

  return (
    <div>
      <div className="page-header">
        <h1>LTI Launch Claims</h1>
        <p>Successfully authenticated via LTI 1.3 OIDC flow</p>
      </div>

      <div className="alert alert-success">
        ✅ <strong>Launch Successful</strong> — JWT verified, nonce validated, claims extracted.
      </div>

      <div className="card">
        <h3>👤 User</h3>
        <table style={{ width: '100%', fontSize: 14 }}>
          <tbody>
            <tr><td style={{ width: 140, color: '#666' }}>Name</td><td><strong>{claims.name}</strong></td></tr>
            <tr><td style={{ color: '#666' }}>Email</td><td>{claims.email}</td></tr>
            <tr><td style={{ color: '#666' }}>Subject ID</td><td><code>{claims.sub}</code></td></tr>
            <tr><td style={{ color: '#666' }}>Roles</td><td>{roleLabels.map(r => (
              <span key={r} className={`badge badge-${r.toLowerCase().includes('instructor') ? 'instructor' : r.toLowerCase().includes('admin') ? 'admin' : 'learner'}`} style={{ marginRight: 6 }}>{r}</span>
            ))}</td></tr>
          </tbody>
        </table>
      </div>

      <div className="card">
        <h3>📚 Context</h3>
        <table style={{ width: '100%', fontSize: 14 }}>
          <tbody>
            <tr><td style={{ width: 140, color: '#666' }}>Course Title</td><td><strong>{context?.title}</strong></td></tr>
            <tr><td style={{ color: '#666' }}>Label</td><td>{context?.label}</td></tr>
            <tr><td style={{ color: '#666' }}>Context ID</td><td><code>{context?.id}</code></td></tr>
            <tr><td style={{ color: '#666' }}>Message Type</td><td><code>{messageType}</code></td></tr>
            <tr><td style={{ color: '#666' }}>Deployment ID</td><td><code>{deploymentId}</code></td></tr>
          </tbody>
        </table>
      </div>

      {resourceLink && (
        <div className="card">
          <h3>🔗 Resource Link</h3>
          <table style={{ width: '100%', fontSize: 14 }}>
            <tbody>
              <tr><td style={{ width: 140, color: '#666' }}>ID</td><td><code>{resourceLink.id}</code></td></tr>
              <tr><td style={{ color: '#666' }}>Title</td><td><strong>{resourceLink.title}</strong></td></tr>
            </tbody>
          </table>
        </div>
      )}

      <div className="card">
        <h3>🔌 Platform</h3>
        <table style={{ width: '100%', fontSize: 14 }}>
          <tbody>
            <tr><td style={{ width: 140, color: '#666' }}>Name</td><td>{platform?.name}</td></tr>
            <tr><td style={{ color: '#666' }}>URL</td><td>{platform?.url}</td></tr>
            <tr><td style={{ color: '#666' }}>Version</td><td>{platform?.version}</td></tr>
            <tr><td style={{ color: '#666' }}>Issuer</td><td><code>{claims.iss}</code></td></tr>
            <tr><td style={{ color: '#666' }}>Audience</td><td><code>{claims.aud}</code></td></tr>
          </tbody>
        </table>
      </div>

      <div className="card">
        <h3>🔗 Available Services</h3>
        <table style={{ width: '100%', fontSize: 14 }}>
          <tbody>
            <tr>
              <td style={{ width: 140, color: '#666' }}>NRPS</td>
              <td>{nrps ? <><code>{nrps.context_memberships_url}</code></> : <span style={{ color: '#999' }}>Not available</span>}</td>
            </tr>
            <tr>
              <td style={{ color: '#666' }}>AGS</td>
              <td>{ags ? <><code>{ags.lineitems}</code></> : <span style={{ color: '#999' }}>Not available</span>}</td>
            </tr>
            {ags && <tr>
              <td style={{ color: '#666' }}>AGS Scopes</td>
              <td>{ags.scope.map(s => <div key={s} style={{ fontSize: 12 }}><code>{s}</code></div>)}</td>
            </tr>}
          </tbody>
        </table>
      </div>

      <div className="card">
        <h3 style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          Raw Signed JWT (id_token)
          <button className="btn btn-sm btn-info" onClick={() => setShowRaw(!showRaw)}>
            {showRaw ? 'Hide' : 'Show'}
          </button>
        </h3>
        {showRaw && (
          <>
            {session.rawToken && (
              <pre className="claims-json" style={{ wordBreak: 'break-all', whiteSpace: 'pre-wrap', fontSize: 11, background: '#1e1e1e', color: '#ce9178' }}>{session.rawToken}</pre>
            )}
            <h4 style={{ marginTop: 16 }}>Decoded Payload</h4>
            <pre className="claims-json">{JSON.stringify(claims, null, 2)}</pre>
          </>
        )}
      </div>

      <div style={{ marginTop: 20 }}>
        <a href="http://localhost:3000/lms/course/123/launch?tool=demo" className="btn btn-primary">
          ← Return to LMS
        </a>
      </div>
    </div>
  );
}

export default Launch;
