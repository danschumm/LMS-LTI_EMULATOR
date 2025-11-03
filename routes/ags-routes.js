const express = require('express');
const router = express.Router();

// AGS Grade Management UI
router.get('/ags', async (req, res) => {
  try {
    const sessionId = req.query.session;
    if (!sessionId) {
      return res.status(400).send('Missing session parameter');
    }

    console.log('AGS Debug - Session ID:', sessionId);
    console.log('AGS Debug - Available sessions:', Array.from(req.app.locals.ltiSessions.keys()));
    
    const session = req.app.locals.ltiSessions.get(sessionId);
    if (!session) {
      return res.status(400).send(`Invalid session. Available sessions: ${Array.from(req.app.locals.ltiSessions.keys()).join(', ')}`);
    }

    const agsEndpoint = session.claims['https://purl.imsglobal.org/spec/lti-ags/claim/endpoint'];
    if (!agsEndpoint) {
      return res.status(400).send('AGS not available for this launch');
    }

    // Fetch line items from platform - handle both URL formats
    let lineItemsUrl = agsEndpoint.lineitems;
    if (lineItemsUrl.includes('/learn/api/v1/lti/courses/')) {
      // Convert Blackboard-style URL to our mock endpoint
      lineItemsUrl = lineItemsUrl.replace('/learn/api/v1/lti/courses/_612_1/lineItems', '/lti/ags/3d536dd2cf504f31b94d3670706a98a4/lineitems');
    }
    
    const response = await fetch(lineItemsUrl);
    const lineItems = await response.json();

    res.send(`
      <h1>Assignment and Grade Services (AGS)</h1>
      <div style="background: #f8f9fa; padding: 15px; margin: 10px 0; border-radius: 5px;">
        <h2>Grade Management</h2>
        <p><strong>Context:</strong> ${session.claims['https://purl.imsglobal.org/spec/lti/claim/context']?.title}</p>
        <p><strong>AGS Endpoint:</strong> <code>${agsEndpoint.lineitems}</code></p>
        <p><strong>Available Scopes:</strong> ${agsEndpoint.scope.join(', ')}</p>
      </div>

      <div style="margin: 20px 0;">
        <div style="background: white; padding: 15px; border: 1px solid #dee2e6; border-radius: 8px;">
          <h3>📝 Line Items (${lineItems.length})</h3>
          ${lineItems.map(item => `
            <div style="border: 1px solid #e9ecef; padding: 10px; margin: 8px 0; border-radius: 4px;">
              <strong>${item.label}</strong><br>
              <small>Max Score: ${item.scoreMaximum} | Tag: ${item.tag || 'none'}</small><br>
              <button onclick="viewResults('${item.id.split('/').pop()}')" style="padding: 4px 8px; background: #17a2b8; color: white; border: none; border-radius: 3px; margin: 2px;">View Results</button>
              <button onclick="submitScore('${item.id.split('/').pop()}', '${item.label}')" style="padding: 4px 8px; background: #28a745; color: white; border: none; border-radius: 3px; margin: 2px;">Submit Score</button>
            </div>
          `).join('')}
          
          <button onclick="createLineItem()" style="padding: 8px 16px; background: #007bff; color: white; border: none; border-radius: 4px; margin-top: 10px;">
            ➕ Create New Assignment
          </button>
        </div>


      </div>

      <div id="agsResults" style="margin: 20px 0;"></div>

      <script>
      let agsEndpoint = '${agsEndpoint.lineitems}';
      if (agsEndpoint.includes('/learn/api/v1/lti/courses/')) {
        agsEndpoint = agsEndpoint.replace('/learn/api/v1/lti/courses/_612_1/lineItems', '/lti/ags/3d536dd2cf504f31b94d3670706a98a4/lineitems');
      }
      const lineItems = ${JSON.stringify(lineItems)};
      
      function viewResults(lineItemId) {
        fetch(agsEndpoint + '/' + lineItemId + '/results')
          .then(response => response.json())
          .then(results => {
            document.getElementById('agsResults').innerHTML = 
              '<h3>📋 Results for Line Item ' + lineItemId + '</h3>' +
              '<div style="background: #f8f9fa; padding: 10px; border-radius: 5px;">' +
              (results.length > 0 ? 
                results.map(result => 
                  '<div style="padding: 8px; border-bottom: 1px solid #dee2e6;">' +
                  '<strong>User:</strong> ' + result.userId + ' | ' +
                  '<strong>Score:</strong> ' + result.resultScore + '/' + result.resultMaximum + ' | ' +
                  '<strong>Time:</strong> ' + new Date(result.timestamp).toLocaleString() +
                  (result.comment ? '<br><em>' + result.comment + '</em>' : '') +
                  '</div>'
                ).join('') :
                '<p>No results found for this assignment.</p>'
              ) +
              '</div>';
          });
      }
      
      function submitScore(lineItemId, label) {
        const userId = prompt('Enter User ID (e.g., user-456):');
        const score = prompt('Enter Score (0-100):');
        const comment = prompt('Enter Comment (optional):') || '';
        
        if (userId && score) {
          fetch(agsEndpoint + '/' + lineItemId + '/scores', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              userId: userId,
              scoreGiven: parseFloat(score),
              scoreMaximum: 100,
              comment: comment,
              activityProgress: 'Completed',
              gradingProgress: 'FullyGraded'
            })
          })
          .then(response => response.json())
          .then(data => {
            document.getElementById('agsResults').innerHTML = 
              '<div style="background: #d4edda; padding: 10px; border-radius: 5px; color: #155724;">' +
              '<strong>✅ Score Submitted!</strong><br>' +
              'Assignment: ' + label + '<br>' +
              'User: ' + userId + '<br>' +
              'Score: ' + score + '/100' +
              (comment ? '<br>Comment: ' + comment : '') +
              '</div>';
          });
        }
      }
      
      function createLineItem() {
        const label = prompt('Assignment Name:');
        const maxScore = prompt('Maximum Score:', '100');
        const tag = prompt('Tag (optional):', 'assignment');
        
        if (label && maxScore) {
          fetch(agsEndpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              label: label,
              scoreMaximum: parseFloat(maxScore),
              tag: tag,
              resourceId: 'custom-' + Date.now()
            })
          })
          .then(response => response.json())
          .then(data => {
            document.getElementById('agsResults').innerHTML = 
              '<div style="background: #d4edda; padding: 10px; border-radius: 5px; color: #155724;">' +
              '<strong>✅ Assignment Created!</strong><br>' +
              'Name: ' + label + '<br>' +
              'Max Score: ' + maxScore + '<br>' +
              'ID: ' + data.id +
              '</div>';
            setTimeout(() => location.reload(), 2000);
          });
        }
      }
      

      </script>

      <a href="javascript:history.back()" style="padding: 10px 20px; background: #007bff; color: white; text-decoration: none; border-radius: 5px;">
        ← Back to Tool
      </a>
    `);

  } catch (error) {
    res.status(500).send(`
      <h1>AGS Error</h1>
      <p>Error: ${error.message}</p>
      <a href="javascript:history.back()">← Back</a>
    `);
  }
});

module.exports = router;