const express = require('express');
const { generateKeyPair } = require('jose');
const { createRemoteJWKSet } = require('jose');
const config = require('./config.json');
const logger = require('./utils/logger').tool;

// Import route modules
const toolRoutes = require('./routes/tool-routes');
const oauthRoutes = require('./routes/oauth-routes');
const deeplinkRoutes = require('./routes/deeplink-routes');
const nrpsRoutes = require('./routes/nrps-routes');
const agsRoutes = require('./routes/ags-routes');

const app = express();
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Initialize shared state
app.locals.pendingStates = new Map();
app.locals.ltiSessions = new Map();

// Generate tool keys and get platform JWKS on startup
(async () => {
  app.locals.toolKeys = await generateKeyPair('RS256');
  app.locals.platformJWKS = createRemoteJWKSet(new URL('/.well-known/jwks.json', config.platform.issuer));
  logger.success('Tool keys generated and platform JWKS loaded');
})();

// Tool JWKS endpoint
app.get('/.well-known/jwks.json', async (req, res) => {
  const jwk = await app.locals.toolKeys.publicKey.export({ format: 'jwk' });
  res.json({ keys: [{ ...jwk, kid: 'tool-key', use: 'sig', alg: 'RS256' }] });
});

// Mock grade submission
app.post('/grade', (req, res) => {
  const { score, user_id, resource_id } = req.body;
  res.send(`
    <h2>Grade Submitted (Mock)</h2>
    <p>User: ${user_id}</p>
    <p>Resource: ${resource_id}</p>
    <p>Score: ${score}/100</p>
    <a href="javascript:history.back()">Back to Tool</a>
  `);
});

// Use route modules
app.use('/', toolRoutes);
app.use('/', oauthRoutes);
app.use('/', deeplinkRoutes);
app.use('/', nrpsRoutes);
app.use('/', agsRoutes);

app.listen(3001, () => {
  logger.success('Tool Provider running on http://localhost:3001');
  logger.log('🔑 JWKS: http://localhost:3001/.well-known/jwks.json\n');
});