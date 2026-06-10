const express = require('express');
const { jwtVerify } = require('jose');
const config = require('../../config.json');
const logger = require('../../utils/logger').tool;

const router = express.Router();

// OIDC Login Initiation (from platform)
router.get('/oidc/login_initiations', (req, res) => {
  const { state, nonce, login_hint, lti_message_hint } = req.query;

  logger.info('📥 STEP 3: Tool received OIDC login initiation');
  logger.log('   State:', state);
  logger.log('   Login hint:', login_hint);
  logger.log('   Message hint:', lti_message_hint);

  // Store state/nonce for validation
  req.app.locals.pendingStates.set(state, { nonce, timestamp: Date.now() });

  const authUrl = `${config.platform.issuer}/lti/auth?${new URLSearchParams(req.query)}`;

  logger.info('🔄 STEP 3b: Redirecting back to platform authorization');
  res.redirect(authUrl);
});

// LTI Launch endpoint (receives id_token)
router.post('/lti13', async (req, res) => {
  try {
    const { id_token, state } = req.body;

    logger.info('🎯 STEP 6: Tool received id_token POST at /lti13');
    logger.log('   State:', state);

    if (!id_token || !state) {
      throw new Error('Missing id_token or state parameter');
    }

    const pendingState = req.app.locals.pendingStates.get(state);
    if (!pendingState) {
      throw new Error('Invalid or expired state parameter');
    }

    logger.success('State validated, verifying JWT signature...');

    const { payload } = await jwtVerify(id_token, req.app.locals.platformJWKS, {
      algorithms: ['RS256'],
      audience: config.platform.client_id
    });

    logger.success('JWT signature verified');

    // Validate nonce
    if (payload.nonce !== pendingState.nonce) {
      throw new Error('Nonce mismatch');
    }
    logger.success('Nonce validated');

    // Validate LTI claims
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
    logger.log('   Deployment ID:', deploymentId);

    // Store session
    req.app.locals.ltiSessions.set(state, {
      claims: payload,
      rawToken: id_token,
      timestamp: Date.now()
    });

    // Clean up pending state
    req.app.locals.pendingStates.delete(state);

    // Always do 3LO to get a bearer token for REST API access
    if (sessionToken) {
      logger.info('🔄 STEP 7: Redirecting to OAuth flow for bearer token');

      const finalRoute = customClaims?.route === 'grades' ? 'grades' : (messageType === 'LtiDeepLinkingRequest' ? 'launch' : 'launch');
      const lineItemParam = customClaims?.lineItemId ? `&lineItem=${encodeURIComponent(customClaims.lineItemId)}` : '';
      const callbackUrl = encodeURIComponent(
        `http://localhost:3001/tlocode?scope=*&response_type=code&client_id=mock-client&state=${state}&route=${finalRoute}${lineItemParam}`
      );
      const authApiUrl = 'learn/api/public/v1/oauth2/authorizationcode?redirect_uri=';
      const frontEndUrl = toolPlatform?.url || 'http://localhost:3000/';
      const redirectUrl = `${frontEndUrl}${authApiUrl}${callbackUrl}&one_time_session_token=${sessionToken}`;

      return res.redirect(302, redirectUrl);
    }

    // Fallback: no session token, redirect directly
    logger.success('🎉 STEP 7: LTI launch successful (no OAuth)');
    const route = customClaims?.route === 'grades' ? 'grades' : 'launch';
    const lineItemParam = customClaims?.lineItemId ? `&lineItem=${encodeURIComponent(customClaims.lineItemId)}` : '';
    res.redirect(`http://localhost:5173/${route}?session=${state}${lineItemParam}`);

  } catch (error) {
    logger.error('LTI Launch Error:', error.message);
    res.status(400).send(`<h1>LTI Launch Error</h1><p>${error.message}</p>`);
  }
});

// OAuth callback
router.get('/tlocode', async (req, res) => {
  const { code, state, route, lineItem } = req.query;

  logger.info('🔑 STEP 8: OAuth callback received at /tlocode');
  logger.log('   Authorization Code:', code);
  logger.log('   State:', state);
  logger.log('   Route:', route);

  const ltiSession = req.app.locals.ltiSessions.get(state);
  if (!ltiSession) {
    return res.status(400).send('Invalid state');
  }

  // Exchange code for token
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

    // Store token in session
    ltiSession.accessToken = tokenData.access_token;

    // Redirect to React app with appropriate route
    const finalRoute = route || 'launch';
    const lineItemParam = lineItem ? `&lineItem=${encodeURIComponent(lineItem)}` : '';
    res.redirect(`http://localhost:5173/${finalRoute}?session=${state}${lineItemParam}`);

  } catch (error) {
    logger.error('Token exchange error:', error.message);
    res.status(500).send(`<h1>OAuth Error</h1><p>${error.message}</p>`);
  }
});

module.exports = router;
