const express = require('express');
const { jwtVerify, SignJWT } = require('jose');
const config = require('../config.json');
const logger = require('../utils/logger').tool;

const router = express.Router();

// OIDC Login Initiation (from platform)
router.get('/oidc/login_initiations', (req, res) => {
  const { state, nonce, login_hint, lti_message_hint } = req.query;
  
  logger.info('📥 STEP 3: Tool received OIDC login initiation at /oidc/login_initiations');
  logger.log('   State:', state);
  logger.log('   Login hint:', login_hint);
  logger.log('   Message hint:', lti_message_hint);
  logger.log('   Client ID:', req.query.client_id);
  
  // Store state/nonce for validation
  req.app.locals.pendingStates.set(state, { nonce, timestamp: Date.now() });
  
  const authUrl = `${config.platform.issuer}/lti/auth?${new URLSearchParams(req.query)}`;
  
  logger.info('🔄 STEP 3b: Redirecting back to platform authorization');
  logger.log('   Auth URL:', authUrl);
  
  res.redirect(authUrl);
});

// LTI Launch endpoint (receives id_token)
router.post('/lti13', async (req, res) => {
  try {
    const { id_token, state } = req.body;
    
    logger.info('🎯 STEP 6: Tool received id_token POST at /lti13');
    logger.log('   State:', state);
    logger.log('   ID Token length:', id_token?.length || 0);
    
    if (!id_token || !state) {
      throw new Error('Missing id_token or state parameter');
    }
    
    // Validate state exists in our pending states
    const pendingState = req.app.locals.pendingStates.get(state);
    if (!pendingState) {
      throw new Error('Invalid or expired state parameter - session not found');
    }
    
    logger.success('State validated, verifying JWT signature...');
    
    // Verify JWT signature and claims using platform JWKS
    const { payload } = await jwtVerify(id_token, req.app.locals.platformJWKS, {
      algorithms: ['RS256'],
      audience: config.platform.client_id
    });
    
    logger.success('JWT signature verified');
    logger.log('   Issuer:', payload.iss);
    logger.log('   Audience:', payload.aud);
    logger.log('   Subject:', payload.sub);
    
    // Validate nonce matches what we stored
    if (payload.nonce !== pendingState.nonce) {
      throw new Error(`Nonce mismatch: expected ${pendingState.nonce}, got ${payload.nonce}`);
    }
    
    logger.success('Nonce validated');

    // Validate required LTI claims
    const messageType = payload['https://purl.imsglobal.org/spec/lti/claim/message_type'];
    const version = payload['https://purl.imsglobal.org/spec/lti/claim/version'];
    const deploymentId = payload['https://purl.imsglobal.org/spec/lti/claim/deployment_id'];
    const customClaims = payload['https://purl.imsglobal.org/spec/lti/claim/custom'];
    const toolPlatform = payload['https://purl.imsglobal.org/spec/lti/claim/tool_platform'];
    const sessionToken = payload['https://blackboard.com/lti/claim/one_time_session_token'];
    
    if (!['LtiResourceLinkRequest', 'LtiDeepLinkingRequest'].includes(messageType)) {
      throw new Error(`Invalid LTI message type: ${messageType}`);
    }
    
    if (version !== '1.3.0') {
      throw new Error(`Invalid LTI version: ${version}`);
    }
    
    if (!deploymentId) {
      throw new Error('Missing deployment_id claim');
    }
    
    logger.success('LTI claims validated');
    logger.log('   Message Type:', messageType);
    logger.log('   Version:', version);
    logger.log('   Deployment ID:', deploymentId);
    logger.log('   Custom Route:', customClaims?.route);
    
    // Store LTI payload for later use in tlocode and NRPS
    req.app.locals.ltiSessions.set(state, {
      claims: payload,
      timestamp: Date.now()
    });
    
    // Clean up pending state
    req.app.locals.pendingStates.delete(state);
    
    // Follow the real Blackboard flow - redirect to tlocode for OAuth
    if (messageType === 'LtiDeepLinkingRequest' && customClaims?.route === 'deeplink') {
      logger.info('🔄 STEP 7: Deep Linking detected, redirecting to OAuth flow');
      
      const callbackUrl = encodeURIComponent(`http://localhost:3001/tlocode?scope=*&response_type=code&client_id=mock-client&state=${state}`);
      const authApiUrl = 'learn/api/public/v1/oauth2/authorizationcode?redirect_uri=';
      const frontEndUrl = toolPlatform?.url || 'http://localhost:3000/';
      const redirectUrl = `${frontEndUrl}${authApiUrl}${callbackUrl}&one_time_session_token=${sessionToken}`;
      
      logger.log('   Redirect URL:', redirectUrl);
      
      return res.redirect(302, redirectUrl);
    }
    
    logger.success('🎉 STEP 7: LTI launch successful!');
    
    // Standard LTI Resource Link launch
    const context = payload['https://purl.imsglobal.org/spec/lti/claim/context'];
    const resourceLink = payload['https://purl.imsglobal.org/spec/lti/claim/resource_link'];
    
    res.send(`
      <h1>🎉 LTI Tool Launched Successfully!</h1>
      <div style="background: #e8f5e8; padding: 10px; margin: 10px 0; border-radius: 5px;">
        <strong>✅ OIDC Flow Complete:</strong> All security validations passed!
      </div>
      
      <h2>User: ${payload.name || payload.sub}</h2>
      <h3>Context: ${context?.title || 'Unknown'}</h3>
      <h3>Message Type: ${messageType}</h3>
      <p><strong>Deployment ID:</strong> ${deploymentId}</p>
      <p><strong>State:</strong> ${state}</p>
      
      <details>
        <summary><strong>Full LTI Claims (click to expand)</strong></summary>
        <pre style="background: #f5f5f5; padding: 10px; overflow: auto;">${JSON.stringify(payload, null, 2)}</pre>
      </details>
      
      <div style="margin: 20px 0;">
        <a href="/nrps?session=${state}" style="padding: 10px 20px; background: #6f42c1; color: white; text-decoration: none; border-radius: 5px; margin-right: 10px;">
          👥 View Course Members
        </a>
        <a href="/ags?session=${state}" style="padding: 10px 20px; background: #dc3545; color: white; text-decoration: none; border-radius: 5px; margin-right: 10px;">
          📊 Manage Grades (AGS)
        </a>
      </div>
      
      <form method="POST" action="/grade" style="margin-top: 20px; padding: 15px; background: #f0f8ff; border-radius: 5px;">
        <h4>Submit Grade (Mock AGS):</h4>
        <input type="number" name="score" placeholder="Score (0-100)" max="100" style="padding: 5px;">
        <input type="hidden" name="user_id" value="${payload.sub}">
        <input type="hidden" name="resource_id" value="${resourceLink?.id || 'mock-resource'}">
        <button type="submit" style="padding: 8px 15px; margin-left: 10px;">Submit Grade</button>
      </form>
    `);
    
  } catch (error) {
    logger.error('LTI Launch Error:', error.message);
    res.status(400).send(`
      <h1>❌ LTI Launch Error</h1>
      <p><strong>Error:</strong> ${error.message}</p>
      <p>Check the console logs for more details.</p>
    `);
  }
});

module.exports = router;