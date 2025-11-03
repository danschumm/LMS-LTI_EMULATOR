const express = require('express');
const { SignJWT } = require('jose');
const config = require('../config.json');
const logger = require('../utils/logger').tool;

const router = express.Router();

// Deep Link creation endpoint
router.post('/deep-link', async (req, res) => {
  try {
    const { deepLinkData, state, deploymentId } = req.body;
    
    logger.info('🔗 Creating Deep Link via Dev Portal');
    logger.log('   Resource:', deepLinkData.title);
    
    // Call dev portal signing service (simulates Blackboard's dev portal)
    const devPortalRequest = {
      contentItems: [{
        type: deepLinkData.type,
        title: deepLinkData.title,
        text: deepLinkData.text,
        url: deepLinkData.url,
        custom: deepLinkData.custom
      }],
      clientId: config.tool.client_id,
      deploymentId: deploymentId,
      platformIssuer: config.platform.issuer,
      returnUrl: 'http://localhost:3000/webapps/blackboard/controller/lti/v2/deeplinking',
      data: '_612_1::_1827_1::0::false::true::_366_1::99bfaa1f39fd4dd299033c0c6125c7c8::false::false'
    };
    
    logger.info('🏭 Calling Dev Portal signing service...');
    
    const devPortalResponse = await fetch('http://localhost:3002/api/v1/deeplink/sign', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(devPortalRequest)
    });
    
    if (!devPortalResponse.ok) {
      throw new Error(`Dev Portal error: ${devPortalResponse.status}`);
    }
    
    const { jwt: deepLinkJWT, payload: deepLinkPayload, returnUrl } = await devPortalResponse.json();
    
    logger.success('Deep Link JWT signed by Dev Portal');
    
    // Return JSON response like production system
    res.json({
      jwt: deepLinkJWT,
      returnUrl: returnUrl
    });
    
  } catch (error) {
    logger.error('Deep Link Error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;