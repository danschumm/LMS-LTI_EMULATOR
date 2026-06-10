const express = require('express');
const config = require('../../config.json');
const logger = require('../../utils/logger').tool;

const router = express.Router();

// Cache for client credentials service token
let serviceToken = null;
let serviceTokenExpiry = 0;

async function getServiceToken() {
  if (serviceToken && Date.now() < serviceTokenExpiry) {
    return serviceToken;
  }

  logger.info('🔑 Requesting client_credentials token for LTI services');
  const response = await fetch(`${config.platform.issuer}/learn/api/public/v1/oauth2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: config.platform.client_id,
      client_secret: 'tool-secret',
      scope: 'https://purl.imsglobal.org/spec/lti-ags/scope/lineitem https://purl.imsglobal.org/spec/lti-ags/scope/score https://purl.imsglobal.org/spec/lti-ags/scope/result.readonly https://purl.imsglobal.org/spec/lti-nrps/scope/contextmembership.readonly'
    })
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(`Token request failed: ${data.error}`);
  }

  serviceToken = data.access_token;
  serviceTokenExpiry = Date.now() + (data.expires_in * 1000) - 60000; // refresh 1 min early
  logger.success('✅ Service token obtained: ' + serviceToken.substring(0, 20) + '...');
  return serviceToken;
}

// Get session data (LTI claims)
router.get('/session/:sessionId', (req, res) => {
  const session = req.app.locals.ltiSessions.get(req.params.sessionId);
  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }
  res.json({ claims: session.claims, rawToken: session.rawToken, accessToken: session.accessToken });
});

// NRPS - fetch membership from platform
router.get('/nrps/:sessionId', async (req, res) => {
  try {
    const session = req.app.locals.ltiSessions.get(req.params.sessionId);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    let nrpsUrl = session.claims['https://purl.imsglobal.org/spec/lti-nrps/claim/namesroleservice']?.context_memberships_url;
    if (!nrpsUrl) {
      return res.status(400).json({ error: 'NRPS not available' });
    }

    // Convert Blackboard-style URL to mock endpoint
    if (nrpsUrl.includes('/learn/api/v1/lti/external/namesandroles/')) {
      nrpsUrl = nrpsUrl.replace('/learn/api/v1/lti/external/namesandroles/_612_1', '/lti/nrps/3d536dd2cf504f31b94d3670706a98a4/memberships');
    }

    const token = await getServiceToken();

    logger.info('👥 Fetching NRPS data from platform');
    logger.log('   URL:', nrpsUrl);
    logger.log('   Bearer Token:', token.substring(0, 20) + '...');

    const response = await fetch(nrpsUrl, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.ims.lti-nrps.v2.membershipcontainer+json'
      }
    });
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || `NRPS request failed: ${response.status}`);
    }

    logger.success(`✅ Received ${data.members.length} members`);
    res.json(data);

  } catch (error) {
    logger.error('NRPS Error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// AGS - get line items
router.get('/ags/:sessionId/lineitems', async (req, res) => {
  try {
    const session = req.app.locals.ltiSessions.get(req.params.sessionId);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    let lineitemsUrl = session.claims['https://purl.imsglobal.org/spec/lti-ags/claim/endpoint']?.lineitems;
    if (!lineitemsUrl) {
      return res.status(400).json({ error: 'AGS not available' });
    }

    if (lineitemsUrl.includes('/learn/api/v1/lti/courses/')) {
      lineitemsUrl = lineitemsUrl.replace('/learn/api/v1/lti/courses/_612_1/lineItems', '/lti/ags/3d536dd2cf504f31b94d3670706a98a4/lineitems');
    }

    const token = await getServiceToken();

    logger.info('📋 Fetching AGS line items from platform');
    logger.log('   URL:', lineitemsUrl);
    logger.log('   Bearer Token:', token.substring(0, 20) + '...');

    const response = await fetch(lineitemsUrl, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.ims.lis.v2.lineitemcontainer+json'
      }
    });
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || `AGS request failed: ${response.status}`);
    }

    logger.success(`✅ Received ${data.length} line items`);
    res.json(data);

  } catch (error) {
    logger.error('AGS Error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// AGS - submit score
router.post('/ags/:sessionId/lineitems/:lineItemId/scores', async (req, res) => {
  try {
    const session = req.app.locals.ltiSessions.get(req.params.sessionId);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    let lineitemsUrl = session.claims['https://purl.imsglobal.org/spec/lti-ags/claim/endpoint']?.lineitems;
    if (lineitemsUrl.includes('/learn/api/v1/lti/courses/')) {
      lineitemsUrl = lineitemsUrl.replace('/learn/api/v1/lti/courses/_612_1/lineItems', '/lti/ags/3d536dd2cf504f31b94d3670706a98a4/lineitems');
    }

    const scoreUrl = `${lineitemsUrl}/${req.params.lineItemId}/scores`;
    const token = await getServiceToken();

    logger.info('📊 Submitting score to platform');
    logger.log('   URL:', scoreUrl);
    logger.log('   Score:', JSON.stringify(req.body));

    const response = await fetch(scoreUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/vnd.ims.lis.v1.score+json'
      },
      body: JSON.stringify(req.body)
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || `Score submission failed: ${response.status}`);
    }
    logger.success('✅ Score submitted');
    res.json(data);

  } catch (error) {
    logger.error('AGS Score Error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// AGS - get results
router.get('/ags/:sessionId/lineitems/:lineItemId/results', async (req, res) => {
  try {
    const session = req.app.locals.ltiSessions.get(req.params.sessionId);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    let lineitemsUrl = session.claims['https://purl.imsglobal.org/spec/lti-ags/claim/endpoint']?.lineitems;
    if (lineitemsUrl.includes('/learn/api/v1/lti/courses/')) {
      lineitemsUrl = lineitemsUrl.replace('/learn/api/v1/lti/courses/_612_1/lineItems', '/lti/ags/3d536dd2cf504f31b94d3670706a98a4/lineitems');
    }

    const resultsUrl = `${lineitemsUrl}/${req.params.lineItemId}/results`;
    const token = await getServiceToken();

    logger.info('📋 Fetching results from platform');
    logger.log('   URL:', resultsUrl);

    const response = await fetch(resultsUrl, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.ims.lis.v2.resultcontainer+json'
      }
    });
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || `Results request failed: ${response.status}`);
    }

    logger.success(`✅ Received ${data.length} results`);
    res.json(data);

  } catch (error) {
    logger.error('AGS Results Error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// AGS - create line item
router.post('/ags/:sessionId/lineitems', async (req, res) => {
  try {
    const session = req.app.locals.ltiSessions.get(req.params.sessionId);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    let lineitemsUrl = session.claims['https://purl.imsglobal.org/spec/lti-ags/claim/endpoint']?.lineitems;
    if (lineitemsUrl.includes('/learn/api/v1/lti/courses/')) {
      lineitemsUrl = lineitemsUrl.replace('/learn/api/v1/lti/courses/_612_1/lineItems', '/lti/ags/3d536dd2cf504f31b94d3670706a98a4/lineitems');
    }

    const token = await getServiceToken();

    logger.info('➕ Creating line item on platform');
    logger.log('   URL:', lineitemsUrl);
    logger.log('   Data:', JSON.stringify(req.body));

    const response = await fetch(lineitemsUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/vnd.ims.lis.v2.lineitem+json'
      },
      body: JSON.stringify(req.body)
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || `Create line item failed: ${response.status}`);
    }
    logger.success(`✅ Line item created: ${data.label}`);
    res.json(data);

  } catch (error) {
    logger.error('AGS Create Error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// REST API - Get gradebook columns
router.get('/rest/:sessionId/gradebook/columns', async (req, res) => {
  try {
    const session = req.app.locals.ltiSessions.get(req.params.sessionId);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }
    if (!session.accessToken) {
      return res.status(401).json({ error: 'No access token. 3LO required.' });
    }

    const courseId = session.claims['https://purl.imsglobal.org/spec/lti/claim/context']?.id || '_612_1';
    const url = `http://localhost:3000/learn/api/public/v3/courses/${courseId}/gradebook/columns`;

    logger.info('📊 REST API: Fetching gradebook columns');
    logger.log('   URL:', url);
    logger.log('   Bearer Token:', session.accessToken.substring(0, 20) + '...');

    const response = await fetch(url, {
      headers: { 'Authorization': `Bearer ${session.accessToken}` }
    });
    const data = await response.json();
    logger.success(`✅ Received ${data.results?.length || 0} columns`);
    res.json(data);
  } catch (error) {
    logger.error('REST Gradebook Error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// REST API - Submit grade
router.patch('/rest/:sessionId/gradebook/columns/:columnId/users/:userId', async (req, res) => {
  try {
    const session = req.app.locals.ltiSessions.get(req.params.sessionId);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }
    if (!session.accessToken) {
      return res.status(401).json({ error: 'No access token. 3LO required.' });
    }

    const courseId = session.claims['https://purl.imsglobal.org/spec/lti/claim/context']?.id || '_612_1';
    const url = `http://localhost:3000/learn/api/public/v3/courses/${courseId}/gradebook/columns/${req.params.columnId}/users/${req.params.userId}`;

    logger.info('📊 REST API: Submitting grade');
    logger.log('   URL:', url);
    logger.log('   Body:', JSON.stringify(req.body));

    const response = await fetch(url, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${session.accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(req.body)
    });
    const data = await response.json();
    logger.success('✅ Grade submitted via REST');
    res.json(data);
  } catch (error) {
    logger.error('REST Grade Submit Error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// REST API - Get column grades
router.get('/rest/:sessionId/gradebook/columns/:columnId/users', async (req, res) => {
  try {
    const session = req.app.locals.ltiSessions.get(req.params.sessionId);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }
    if (!session.accessToken) {
      return res.status(401).json({ error: 'No access token. 3LO required.' });
    }

    const courseId = session.claims['https://purl.imsglobal.org/spec/lti/claim/context']?.id || '_612_1';
    const url = `http://localhost:3000/learn/api/public/v3/courses/${courseId}/gradebook/columns/${req.params.columnId}/users`;

    logger.info('📊 REST API: Fetching column grades');
    logger.log('   URL:', url);

    const response = await fetch(url, {
      headers: { 'Authorization': `Bearer ${session.accessToken}` }
    });
    const data = await response.json();
    logger.success(`✅ Received ${data.results?.length || 0} grades`);
    res.json(data);
  } catch (error) {
    logger.error('REST Column Grades Error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// REST API - Get course users
router.get('/rest/:sessionId/users', async (req, res) => {
  try {
    const session = req.app.locals.ltiSessions.get(req.params.sessionId);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }
    if (!session.accessToken) {
      return res.status(401).json({ error: 'No access token. 3LO required.' });
    }

    const courseId = session.claims['https://purl.imsglobal.org/spec/lti/claim/context']?.id || '_612_1';
    const url = `http://localhost:3000/learn/api/public/v3/courses/${courseId}/users`;

    logger.info('📊 REST API: Fetching course users');
    logger.log('   URL:', url);

    const response = await fetch(url, {
      headers: { 'Authorization': `Bearer ${session.accessToken}` }
    });
    const data = await response.json();
    logger.success(`✅ Received ${data.results?.length || 0} users`);
    res.json(data);
  } catch (error) {
    logger.error('REST Users Error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
