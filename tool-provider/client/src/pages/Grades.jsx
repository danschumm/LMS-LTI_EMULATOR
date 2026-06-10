import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';

function Grades({ session, sessionId }) {
  const [searchParams] = useSearchParams();
  const [lineItems, setLineItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState(null);
  const [results, setResults] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [newItem, setNewItem] = useState({ label: '', scoreMaximum: 100, tag: 'assignment' });
  const [activeLineItem, setActiveLineItem] = useState(null);

  useEffect(() => {
    fetchLineItems();
  }, [sessionId]);

  useEffect(() => {
    const lineItemParam = searchParams.get('lineItem');
    if (lineItemParam && lineItems.length > 0) {
      const match = lineItems.find(item => item.id === lineItemParam);
      if (match) {
        setActiveLineItem(match);
      } else {
        // Try partial match on the ID suffix
        const suffix = lineItemParam.split('/').pop();
        const partialMatch = lineItems.find(item => item.id.split('/').pop() === suffix);
        if (partialMatch) setActiveLineItem(partialMatch);
      }
    }
  }, [searchParams, lineItems]);

  const fetchLineItems = () => {
    fetch(`/api/ags/${sessionId}/lineitems`)
      .then(res => res.json())
      .then(data => { setLineItems(data); setLoading(false); })
      .catch(err => { console.error(err); setLoading(false); });
  };

  const submitScore = async (lineItemId, label) => {
    const userId = prompt('Enter User ID (e.g., user-456):');
    const score = prompt('Enter Score:');
    const comment = prompt('Comment (optional):') || '';

    if (!userId || !score) return;

    const response = await fetch(`/api/ags/${sessionId}/lineitems/${lineItemId}/scores`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId,
        scoreGiven: parseFloat(score),
        scoreMaximum: 100,
        comment,
        activityProgress: 'Completed',
        gradingProgress: 'FullyGraded'
      })
    });

    if (response.ok) {
      setMessage({ type: 'success', text: `Score ${score} submitted for ${userId} on "${label}"` });
      setTimeout(() => setMessage(null), 4000);
    }
  };

  const viewResults = async (lineItemId) => {
    const response = await fetch(`/api/ags/${sessionId}/lineitems/${lineItemId}/results`);
    const data = await response.json();
    setResults({ lineItemId, data });
  };

  const createLineItem = async () => {
    const response = await fetch(`/api/ags/${sessionId}/lineitems`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...newItem, resourceId: 'custom-' + Date.now() })
    });

    if (response.ok) {
      setMessage({ type: 'success', text: `Assignment "${newItem.label}" created` });
      setShowCreate(false);
      setNewItem({ label: '', scoreMaximum: 100, tag: 'assignment' });
      fetchLineItems();
      setTimeout(() => setMessage(null), 4000);
    }
  };

  if (loading) return <div className="loading">Loading grades...</div>;

  const ags = session.claims['https://purl.imsglobal.org/spec/lti-ags/claim/endpoint'];

  return (
    <div>
      <div className="page-header">
        <h1>Assignment & Grade Services (AGS)</h1>
        <p>Manage assignments and submit grades back to the LMS</p>
      </div>

      <div className="alert alert-info">
        💡 AGS allows tools to create gradebook columns (line items), submit scores, and retrieve results.
        The tool uses the AGS endpoint URLs provided in the LTI launch claims.
      </div>

      {message && <div className={`alert alert-${message.type}`}>✅ {message.text}</div>}

      {activeLineItem && (
        <div className="card" style={{ border: '2px solid #0066cc', background: '#f0f7ff' }}>
          <h3>🎯 Submit Score for: {activeLineItem.label}</h3>
          <p style={{ fontSize: 13, color: '#666', marginBottom: 12 }}>This assignment was launched from the LMS course page.</p>
          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <div className="form-group" style={{ margin: 0 }}>
              <label>User ID</label>
              <input id="active-userId" placeholder="e.g. user-456" />
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label>Score (max {activeLineItem.scoreMaximum})</label>
              <input id="active-score" type="number" placeholder="0" max={activeLineItem.scoreMaximum} />
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label>Comment</label>
              <input id="active-comment" placeholder="Optional" />
            </div>
            <button className="btn btn-primary" onClick={async () => {
              const userId = document.getElementById('active-userId').value;
              const score = document.getElementById('active-score').value;
              const comment = document.getElementById('active-comment').value;
              if (!userId || !score) return;
              const itemId = activeLineItem.id.split('/').pop();
              const response = await fetch(`/api/ags/${sessionId}/lineitems/${itemId}/scores`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId, scoreGiven: parseFloat(score), scoreMaximum: activeLineItem.scoreMaximum, comment, activityProgress: 'Completed', gradingProgress: 'FullyGraded' })
              });
              if (response.ok) {
                setMessage({ type: 'success', text: `Score ${score} submitted for ${userId} on "${activeLineItem.label}"` });
                setTimeout(() => setMessage(null), 4000);
              }
            }}>Submit Score</button>
          </div>
        </div>
      )}

      {!activeLineItem && searchParams.get('lineItem') && (
        <div className="alert alert-info">
          ⚠️ Line item from launch not found in current gradebook. It may have been cleared on server restart.
          <div style={{ fontSize: 12, marginTop: 4, color: '#666' }}>Looking for: <code>{searchParams.get('lineItem')}</code></div>
        </div>
      )}

      <div className="card">
        <h3 style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          Line Items ({lineItems.length})
          <button className="btn btn-primary btn-sm" onClick={() => setShowCreate(!showCreate)}>
            ➕ Create Assignment
          </button>
        </h3>

        {showCreate && (
          <div style={{ background: '#f8f9fa', padding: 16, borderRadius: 6, margin: '12px 0' }}>
            <div className="form-group">
              <label>Assignment Name</label>
              <input value={newItem.label} onChange={e => setNewItem({ ...newItem, label: e.target.value })} />
            </div>
            <div className="form-group">
              <label>Maximum Score</label>
              <input type="number" value={newItem.scoreMaximum} onChange={e => setNewItem({ ...newItem, scoreMaximum: parseInt(e.target.value) })} />
            </div>
            <div className="form-group">
              <label>Tag</label>
              <input value={newItem.tag} onChange={e => setNewItem({ ...newItem, tag: e.target.value })} />
            </div>
            <button className="btn btn-success" onClick={createLineItem}>Create</button>
            <button className="btn btn-sm" style={{ marginLeft: 8 }} onClick={() => setShowCreate(false)}>Cancel</button>
          </div>
        )}

        {lineItems.map(item => {
          const itemId = item.id.split('/').pop();
          return (
            <div key={item.id} className="line-item">
              <div>
                <strong>{item.label}</strong>
                <div style={{ fontSize: 12, color: '#666' }}>
                  Max: {item.scoreMaximum} | Tag: {item.tag || 'none'} | ID: {itemId}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button className="btn btn-success btn-sm" onClick={() => submitScore(itemId, item.label)}>
                  Submit Score
                </button>
                <button className="btn btn-info btn-sm" onClick={() => viewResults(itemId)}>
                  View Results
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {results && (
        <div className="card">
          <h3>Results for Line Item {results.lineItemId}</h3>
          {results.data.length === 0 ? (
            <p style={{ color: '#666' }}>No scores submitted yet for this assignment.</p>
          ) : (
            <table style={{ width: '100%', fontSize: 14 }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #dee2e6' }}>
                  <th style={{ textAlign: 'left', padding: 8 }}>User</th>
                  <th style={{ textAlign: 'left', padding: 8 }}>Score</th>
                  <th style={{ textAlign: 'left', padding: 8 }}>Comment</th>
                  <th style={{ textAlign: 'left', padding: 8 }}>Time</th>
                </tr>
              </thead>
              <tbody>
                {results.data.map(r => (
                  <tr key={r.id} style={{ borderBottom: '1px solid #eee' }}>
                    <td style={{ padding: 8 }}>{r.userId}</td>
                    <td style={{ padding: 8 }}><strong>{r.resultScore}</strong> / {r.resultMaximum}</td>
                    <td style={{ padding: 8, color: '#666' }}>{r.comment || '—'}</td>
                    <td style={{ padding: 8, fontSize: 12 }}>{new Date(r.timestamp).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      <div className="card">
        <h3>Launch Payload (JWT Claims)</h3>
        <pre style={{ background: '#1e1e1e', color: '#d4d4d4', padding: 16, borderRadius: 6, fontSize: 12, overflow: 'auto', maxHeight: 400 }}>
          {JSON.stringify(session.claims, null, 2)}
        </pre>
      </div>

      <div className="card">
        <h3>AGS Service Details</h3>
        <table style={{ width: '100%', fontSize: 14 }}>
          <tbody>
            <tr><td style={{ width: 140, color: '#666' }}>Line Items URL</td><td><code>{ags?.lineitems}</code></td></tr>
            <tr><td style={{ color: '#666' }}>Line Item URL</td><td><code>{ags?.lineitem}</code></td></tr>
            <tr><td style={{ color: '#666' }}>Scopes</td><td>{ags?.scope.map(s => <div key={s} style={{ fontSize: 12 }}><code>{s}</code></div>)}</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default Grades;
