const express = require('express');
const { SignJWT, generateKeyPair, jwtVerify, createRemoteJWKSet } = require('jose');
const config = require('./config.json');
const logger = require('./utils/logger').devportal;

const app = express();
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

let devPortalKeys;
const registeredTools = new Map(); // Store tool registrations

// Generate dev-portal keys on startup
(async () => {
  devPortalKeys = await generateKeyPair('RS256');
  logger.success('Dev Portal keys generated');
  
  // Register our demo tool
  registeredTools.set(config.platform.client_id, {
    client_id: config.platform.client_id,
    jwks_uri: 'http://localhost:3001/.well-known/jwks.json',
    platform_issuer: config.platform.issuer,
    deployment_id: config.platform.deployment_id
  });
})();

// Dev Portal JWKS endpoint
app.get('/.well-known/jwks.json', async (req, res) => {
  const jwk = await devPortalKeys.publicKey.export({ format: 'jwk' });
  res.json({ keys: [{ ...jwk, kid: 'dev-portal-key', use: 'sig', alg: 'RS256' }] });
});

// Tool registration endpoint (simulates dev portal tool management)
app.get('/api/v1/management/applications/:clientId/jwks.json', async (req, res) => {
  const { clientId } = req.params;
  
  logger.info('JWKS request for client:', clientId);
  
  const toolRegistration = registeredTools.get(clientId);
  if (!toolRegistration) {
    return res.status(404).json({ error: 'Tool not registered' });
  }
  
  try {
    // Fetch tool's JWKS from its registered endpoint
    const response = await fetch(toolRegistration.jwks_uri);
    const jwks = await response.json();
    
    logger.success('Retrieved tool JWKS');
    res.json(jwks);
  } catch (error) {
    logger.error('Error fetching tool JWKS:', error.message);
    res.status(500).json({ error: 'Failed to fetch tool JWKS' });
  }
});

// Deep Link signing service (simulates dev portal JWT signing)
app.post('/api/v1/deeplink/sign', async (req, res) => {
  try {
    const { contentItems, clientId, deploymentId, platformIssuer, returnUrl, data } = req.body;
    
    logger.info('Signing deep link request');
    logger.log('   Client ID:', clientId);
    logger.log('   Content Items:', contentItems?.length || 0);
    
    // Validate tool registration
    const toolRegistration = registeredTools.get(clientId);
    if (!toolRegistration) {
      throw new Error('Tool not registered in dev portal');
    }
    
    // Create Deep Linking response JWT signed by dev portal
    const deepLinkPayload = {
      iss: clientId, // Tool is the issuer
      aud: platformIssuer,
      exp: Math.floor(Date.now() / 1000) + 600, // 10 minutes
      iat: Math.floor(Date.now() / 1000),
      nonce: 'deep-link-' + Math.random().toString(36).substr(2, 9),
      'https://purl.imsglobal.org/spec/lti/claim/message_type': 'LtiDeepLinkingResponse',
      'https://purl.imsglobal.org/spec/lti/claim/version': '1.3.0',
      'https://purl.imsglobal.org/spec/lti/claim/deployment_id': deploymentId,
      'https://purl.imsglobal.org/spec/lti-dl/claim/content_items': contentItems,
      'https://purl.imsglobal.org/spec/lti-dl/claim/data': data
    };
    
    // Sign with dev portal keys (acting as the tool's signing service)
    const deepLinkJWT = await new SignJWT(deepLinkPayload)
      .setProtectedHeader({ alg: 'RS256', kid: 'dev-portal-key' })
      .sign(devPortalKeys.privateKey);
    
    logger.success('Deep link JWT signed');
    
    res.json({
      jwt: deepLinkJWT,
      payload: deepLinkPayload,
      returnUrl: returnUrl
    });
    
  } catch (error) {
    logger.error('Signing error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// OAuth token exchange (simulates dev portal OAuth service)
app.post('/api/v1/oauth/token', async (req, res) => {
  const { grant_type, code, client_id, redirect_uri } = req.body;
  
  logger.info('OAuth token exchange');
  logger.log('   Grant Type:', grant_type);
  logger.log('   Client ID:', client_id);
  
  if (grant_type !== 'authorization_code') {
    return res.status(400).json({ error: 'unsupported_grant_type' });
  }
  
  // Validate tool registration
  const toolRegistration = registeredTools.get(client_id);
  if (!toolRegistration) {
    return res.status(401).json({ error: 'invalid_client' });
  }
  
  // Generate mock access token
  const accessToken = 'dev_portal_access_' + Math.random().toString(36).substr(2, 16);
  
  logger.success('Access token generated');
  
  res.json({
    access_token: accessToken,
    token_type: 'Bearer',
    expires_in: 3600,
    scope: 'https://purl.imsglobal.org/spec/lti-ags/scope/lineitem https://purl.imsglobal.org/spec/lti-nrps/scope/contextmembership.readonly'
  });
});

app.listen(3002, () => {
  logger.success('Dev Portal running on http://localhost:3002');
  logger.log('🔑 JWKS: http://localhost:3002/.well-known/jwks.json');
  logger.log('📋 Tool Management: http://localhost:3002/api/v1/management/applications/:clientId/jwks.json\n');
});