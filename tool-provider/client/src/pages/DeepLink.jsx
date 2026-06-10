import { useState } from 'react';

function DeepLink({ session, sessionId }) {
  const [title, setTitle] = useState('My Custom Resource');
  const [description, setDescription] = useState('A resource created via Deep Linking');
  const [url, setUrl] = useState('http://localhost:3001/resource/custom-123');
  const [result, setResult] = useState(null);
  const [decoded, setDecoded] = useState(null);

  const handleCreate = async () => {
    const deepLinkData = {
      type: 'ltiResourceLink',
      title,
      text: description,
      url,
      custom: { resource_id: 'custom-' + Date.now(), created_by: 'deep_link_demo' }
    };

    const response = await fetch('/deep-link', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deepLinkData, sessionId })
    });

    const data = await response.json();
    setResult(data);

    // Decode JWT payload
    try {
      const payload = JSON.parse(atob(data.jwt.split('.')[1]));
      setDecoded(payload);
    } catch (e) {
      console.error('JWT decode error:', e);
    }
  };

  const handleReturn = () => {
    // Create a form and submit to platform
    const form = document.createElement('form');
    form.method = 'POST';
    form.action = result.returnUrl;

    const input = document.createElement('input');
    input.type = 'hidden';
    input.name = 'JWT';
    input.value = result.jwt;
    form.appendChild(input);

    document.body.appendChild(form);
    form.submit();
  };

  return (
    <div>
      <div className="page-header">
        <h1>Deep Linking</h1>
        <p>Create content items and return them to the LMS platform</p>
      </div>

      <div className="alert alert-info">
        💡 Deep Linking allows tools to create content items (links, assignments, etc.) that get stored in the LMS course.
        The tool signs a JWT containing the content items and POSTs it back to the platform.
      </div>

      <div className="card">
        <h3>Create Content Item</h3>
        <div className="form-group">
          <label>Title</label>
          <input value={title} onChange={e => setTitle(e.target.value)} />
        </div>
        <div className="form-group">
          <label>Description</label>
          <input value={description} onChange={e => setDescription(e.target.value)} />
        </div>
        <div className="form-group">
          <label>Launch URL</label>
          <input value={url} onChange={e => setUrl(e.target.value)} />
        </div>
        <button className="btn btn-success" onClick={handleCreate}>
          🔗 Create Deep Link
        </button>
      </div>

      {result && (
        <>
          <div className="card">
            <h3>Decoded JWT Payload</h3>
            <pre className="claims-json">{JSON.stringify(decoded, null, 2)}</pre>
          </div>

          <div className="card">
            <h3>Signed JWT (Raw)</h3>
            <textarea
              readOnly
              value={result.jwt}
              style={{ width: '100%', height: 100, fontFamily: 'monospace', fontSize: 12, padding: 8, borderRadius: 4, border: '1px solid #ddd' }}
            />
          </div>

          <div className="card">
            <h3>Return to Platform</h3>
            <p style={{ marginBottom: 12, color: '#666' }}>
              This will POST the signed JWT to: <code>{result.returnUrl}</code>
            </p>
            <button className="btn btn-primary" onClick={handleReturn}>
              🚀 Return Deep Link to Platform
            </button>
          </div>
        </>
      )}
    </div>
  );
}

export default DeepLink;
