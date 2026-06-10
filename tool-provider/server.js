const express = require('express');
const path = require('path');
const { generateKeyPair, exportJWK } = require('jose');
const { createRemoteJWKSet } = require('jose');
const config = require('../config.json');
const logger = require('../utils/logger').tool;

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// CORS for Vite dev server
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', 'http://localhost:5173');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  res.header('Access-Control-Allow-Credentials', 'true');
  next();
});

// Shared state
app.locals.pendingStates = new Map();
app.locals.ltiSessions = new Map();
app.locals.toolKeys = null;
app.locals.platformJWKS = null;

// Generate RSA keys and setup JWKS
async function setup() {
  const { publicKey, privateKey } = await generateKeyPair('RS256');
  const publicJWK = await exportJWK(publicKey);
  publicJWK.kid = 'tool-key';
  publicJWK.use = 'sig';
  publicJWK.alg = 'RS256';

  app.locals.toolKeys = { publicKey, privateKey, publicJWK };
  app.locals.platformJWKS = createRemoteJWKSet(
    new URL('/.well-known/jwks.json', config.platform.issuer)
  );

  logger.success('RSA key pair generated');
}

// JWKS endpoint
app.get('/.well-known/jwks.json', (req, res) => {
  res.json({ keys: [app.locals.toolKeys.publicJWK] });
});

// Routes
const ltiRoutes = require('./routes/lti-routes');
const apiRoutes = require('./routes/api-routes');
const deeplinkRoutes = require('./routes/deeplink-routes');

app.use('/', ltiRoutes);
app.use('/api', apiRoutes);
app.use('/', deeplinkRoutes);

// Serve React app in production
app.use(express.static(path.join(__dirname, 'client/dist')));
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api') || req.path.startsWith('/oidc') || req.path.startsWith('/lti') || req.path.startsWith('/tlocode') || req.path.startsWith('/.well-known') || req.path.startsWith('/deep-link')) {
    return next();
  }
  res.sendFile(path.join(__dirname, 'client/dist/index.html'));
});

setup().then(() => {
  app.listen(3001, () => {
    logger.success('Tool Provider running on http://localhost:3001');
  });
});
