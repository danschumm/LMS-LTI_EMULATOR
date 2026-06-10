const express = require('express');
const logger = require('../../utils/logger').tool;

const router = express.Router();

// Deep link creation - called from React frontend
router.post('/deep-link', async (req, res) => {
  const { deepLinkData, sessionId } = req.body;

  logger.info('🔗 Creating Deep Link JWT');
  logger.log('   Title:', deepLinkData?.title);

  try {
    const session = req.app.locals.ltiSessions.get(sessionId);
    const claims = session?.claims || {};
    const dlSettings = claims['https://purl.imsglobal.org/spec/lti-dl/claim/deep_linking_settings'] || {};

    // Sign via dev portal
    const response = await fetch('http://localhost:3002/api/v1/deeplink/sign', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contentItems: [deepLinkData],
        clientId: claims.aud || 'demo-client-123',
        deploymentId: claims['https://purl.imsglobal.org/spec/lti/claim/deployment_id'] || 'deployment-456',
        platformIssuer: claims.iss || 'http://localhost:3000',
        returnUrl: dlSettings.deep_link_return_url || 'http://localhost:3000/webapps/blackboard/controller/lti/v2/deeplinking',
        data: dlSettings.data
      })
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Dev portal signing failed: ${err}`);
    }

    const data = await response.json();
    logger.success('✅ Deep Link JWT signed by Dev Portal');

    res.json({
      jwt: data.jwt,
      returnUrl: data.returnUrl || 'http://localhost:3000/webapps/blackboard/controller/lti/v2/deeplinking'
    });

  } catch (error) {
    logger.error('Deep Link Error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
