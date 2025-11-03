const express = require('express');
const { generateKeyPair } = require('jose');
const config = require('./config.json');
const logger = require('./utils/logger').platform;

// Import route modules
const platformRoutes = require('./routes/platform-routes');

const app = express();
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Initialize shared state
app.locals.authSessions = new Map();

// Generate platform keys on startup
(async () => {
  app.locals.platformKeys = await generateKeyPair('RS256');
  logger.success('Platform keys generated');
})();

// Platform JWKS endpoint
app.get('/.well-known/jwks.json', async (req, res) => {
  const jwk = await app.locals.platformKeys.publicKey.export({ format: 'jwk' });
  res.json({ keys: [{ ...jwk, kid: 'platform-key', use: 'sig', alg: 'RS256' }] });
});

// Mock AGS endpoint
app.get('/lti/ags/:contextId/lineitems', (req, res) => {
  res.json([{
    id: 'lineitem-123',
    scoreMaximum: 100,
    label: 'Demo Assignment',
    resourceId: 'resource-123'
  }]);
});

// Use route modules
app.use('/', platformRoutes);

app.listen(3000, () => {
  logger.success('LMS Platform running on http://localhost:3000');
  logger.log('📋 Launch URL: http://localhost:3000/lms/course/123/launch?tool=demo');
  logger.log('🔑 JWKS: http://localhost:3000/.well-known/jwks.json\n');
});