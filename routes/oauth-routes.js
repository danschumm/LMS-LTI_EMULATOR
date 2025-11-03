const express = require('express');
const logger = require('../utils/logger').tool;
const router = express.Router();

// OAuth callback endpoint (tlocode)
router.get('/tlocode', async (req, res) => {
  const { code, state, scope } = req.query;
  
  logger.info('🔑 STEP 8: OAuth callback received at /tlocode');
  logger.log('   Authorization Code:', code);
  logger.log('   State:', state);
  logger.log('   Scope:', scope);
  
  // Validate state and retrieve LTI payload
  const ltiSession = req.app.locals.ltiSessions.get(state);
  if (!ltiSession) {
    return res.status(400).send(`
      <h1>❌ Invalid State</h1>
      <p>State parameter not found or expired. Please restart the LTI launch.</p>
    `);
  }
  
  logger.success('State validated, LTI session found');
  
  const payload = ltiSession.claims || ltiSession.payload;
  const context = payload['https://purl.imsglobal.org/spec/lti/claim/context'];
  const customClaims = payload['https://purl.imsglobal.org/spec/lti/claim/custom'];
  
  // Exchange authorization code for access token via dev portal
  logger.info('Exchanging authorization code for access token...');
  
  try {
    const tokenResponse = await fetch('http://localhost:3002/api/v1/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code: code,
        client_id: 'demo-tool-123',
        redirect_uri: 'http://localhost:3001/tlocode'
      })
    });
    
    const tokenData = await tokenResponse.json();
    
    if (!tokenResponse.ok) {
      throw new Error(`Token exchange failed: ${tokenData.error}`);
    }
    
    logger.success('Access token received from Dev Portal');
    
    // Don't clean up session yet - keep it for NRPS and other services
    // req.app.locals.ltiSessions.delete(state);
    
    res.send(`
      <h1>🎉 OAuth Flow Complete!</h1>
      <div style="background: #e8f5e8; padding: 10px; margin: 10px 0; border-radius: 5px;">
        <strong>✅ Authorization Code Received:</strong> OAuth flow successful!
      </div>
      
      <h2>OAuth Parameters:</h2>
      <p><strong>Authorization Code:</strong> ${code}</p>
      <p><strong>State:</strong> ${state}</p>
      <p><strong>Scope:</strong> ${scope}</p>
      
      <h2>Access Token (from Dev Portal):</h2>
      <div style="background: #f8f9fa; padding: 10px; border-radius: 5px; margin: 10px 0;">
        <p><strong>Token:</strong> <code>${tokenData.access_token}</code></p>
        <p><strong>Type:</strong> ${tokenData.token_type}</p>
        <p><strong>Expires In:</strong> ${tokenData.expires_in} seconds</p>
        <p><strong>Scope:</strong> ${tokenData.scope}</p>
      </div>
      
      <h2>LTI Context:</h2>
      <p><strong>User:</strong> ${payload.name || payload.sub}</p>
      <p><strong>Course:</strong> ${context?.title || 'Unknown'}</p>
      <p><strong>Route:</strong> ${customClaims?.route || 'Unknown'}</p>
      <p><strong>Message Type:</strong> ${payload['https://purl.imsglobal.org/spec/lti/claim/message_type']}</p>
      
      <details style="margin-top: 20px;">
        <summary><strong>Complete LTI Payload (click to expand)</strong></summary>
        <pre style="background: #f5f5f5; padding: 10px; overflow: auto; max-height: 400px;">${JSON.stringify(payload, null, 2)}</pre>
      </details>
      
      <div style="background: #fff3cd; padding: 10px; margin: 10px 0; border-radius: 5px;">
        <strong>Next Steps:</strong> With the access token, you can now:
        <ul>
          <li>Make authenticated API calls to the LMS</li>
          <li>Access AGS (Assignment and Grade Services)</li>
          <li>Access NRPS (Names and Role Provisioning Services)</li>
          <li>Store tokens securely for future use</li>
        </ul>
      </div>
      
      <div style="margin-top: 20px;">
        <a href="/nrps?session=${state}" style="padding: 10px 20px; background: #6f42c1; color: white; text-decoration: none; border-radius: 5px; margin-right: 10px;">
          👥 View Course Members
        </a>
        <a href="/ags?session=${state}" style="padding: 10px 20px; background: #dc3545; color: white; text-decoration: none; border-radius: 5px; margin-right: 10px;">
          📊 Manage Grades (AGS)
        </a>
        <a href="http://localhost:3000/lms/course/123/launch?tool=demo" style="padding: 10px 20px; background: #007bff; color: white; text-decoration: none; border-radius: 5px; margin-right: 10px;">Start New Launch</a>
        <button onclick="createDeepLink()" style="padding: 10px 20px; background: #28a745; color: white; border: none; border-radius: 5px;">Create Deep Link</button>
      </div>
      
      <script>
      function createDeepLink() {
        const deepLinkData = {
          type: 'ltiResourceLink',
          title: 'My Custom Resource',
          text: 'A resource created via Deep Linking',
          url: 'http://localhost:3001/resource/custom-123',
          custom: {
            resource_id: 'custom-123',
            created_by: 'deep_link_demo'
          }
        };
        
        const requestData = {
          deepLinkData: deepLinkData,
          state: '` + state + `',
          deploymentId: '` + payload['https://purl.imsglobal.org/spec/lti/claim/deployment_id'] + `'
        };
        
        fetch('/deep-link', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestData)
        })
        .then(response => response.json())
        .then(data => {
          // Show the JWT response like production
          document.body.innerHTML = 
            '<h1>🔗 Deep Link Created!</h1>' +
            '<div style="background: #e8f5e8; padding: 10px; margin: 10px 0; border-radius: 5px;">' +
              '<strong>✅ Deep Link JWT Generated:</strong> Ready to return to platform!' +
            '</div>' +
            '<h2>Production-Style Response:</h2>' +
            '<pre style="background: #f5f5f5; padding: 10px; overflow: auto; border-radius: 5px;">' + JSON.stringify(data, null, 2) + '</pre>' +
            '<h2>JWT Details:</h2>' +
            '<div style="background: #fff3cd; padding: 10px; margin: 10px 0; border-radius: 5px;">' +
              '<p><strong>Decoded JWT Payload:</strong></p>' +
              '<pre style="background: white; padding: 10px; border: 1px solid #ccc; border-radius: 4px; overflow: auto; max-height: 300px;">' + JSON.stringify(JSON.parse(atob(data.jwt.split('.')[1])), null, 2) + '</pre>' +
            '</div>' +
            '<details style="margin: 10px 0;">' +
              '<summary><strong>Raw Signed JWT (click to expand)</strong></summary>' +
              '<textarea readonly style="width: 100%; height: 120px; font-family: monospace; font-size: 12px; padding: 8px; border: 1px solid #ccc; border-radius: 4px; margin-top: 10px;">' + data.jwt + '</textarea>' +
            '</details>' +
            '<div style="background: #d1ecf1; padding: 15px; margin: 15px 0; border-radius: 5px;">' +
              '<h3>Deep Link Return Process:</h3>' +
              '<p>The signed JWT above will be POSTed to the platform deep linking return URL. ' +
              'In a real application, this form submission would happen automatically after the tool creates the deep link response.</p>' +
              '<p><strong>Return URL:</strong> <code>' + data.returnUrl + '</code></p>' +
            '</div>' +
            '<form id="deepLinkForm" method="POST" action="' + data.returnUrl + '">' +
              '<input type="hidden" name="JWT" value="' + data.jwt + '">' +
              '<button type="submit" style="padding: 12px 24px; background: #28a745; color: white; border: none; border-radius: 5px; font-size: 16px;">Return Deep Link to Platform</button>' +
            '</form>';
        })
        .catch(error => {
          alert('Error creating deep link: ' + error.message);
        });
      }
      </script>
    `);
    
  } catch (error) {
    logger.error('Token exchange error:', error.message);
    res.status(500).send(`
      <h1>❌ OAuth Error</h1>
      <p><strong>Error:</strong> ${error.message}</p>
    `);
  }
});

module.exports = router;