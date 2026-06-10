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
app.locals.deepLinkItems = new Map();

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


// Clear console endpoint
app.post('/admin/clear-console', (req, res) => {
  process.stdout.write('\n'.repeat(50));
  console.log('═'.repeat(60));
  console.log('  Console cleared');
  console.log('═'.repeat(60));
  res.json({ ok: true });
});

// Learn REST API - Gradebook Columns
app.get('/learn/api/public/v3/courses/:courseId/gradebook/columns', (req, res) => {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) {
    return res.status(401).json({ status: 401, message: 'Unauthorized' });
  }
  logger.info('📊 REST API: GET gradebook columns');
  
  const platformRoutes = require('./routes/platform-routes');
  const columns = platformRoutes.getLineItems();
  
  res.json({
    results: columns.map((item, i) => ({
      id: `_${1980 + i}_1`,
      name: item.label,
      score: { possible: item.scoreMaximum },
      grading: { type: 'Attempts', due: item.endDateTime || null },
      contentId: item.resourceId || null
    }))
  });
});

// Learn REST API - Submit Grade
app.patch('/learn/api/public/v3/courses/:courseId/gradebook/columns/:columnId/users/:userId', (req, res) => {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) {
    return res.status(401).json({ status: 401, message: 'Unauthorized' });
  }
  logger.info('📊 REST API: PATCH grade for user');
  logger.log('   Column:', req.params.columnId);
  logger.log('   User:', req.params.userId);
  logger.log('   Body:', JSON.stringify(req.body));
  
  res.json({
    userId: req.params.userId,
    columnId: req.params.columnId,
    score: req.body.score,
    notes: req.body.notes || '',
    status: 'Graded'
  });
});

// Learn REST API - Get Column Grades
app.get('/learn/api/public/v3/courses/:courseId/gradebook/columns/:columnId/users', (req, res) => {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) {
    return res.status(401).json({ status: 401, message: 'Unauthorized' });
  }
  logger.info('📊 REST API: GET column grades');
  logger.log('   Column:', req.params.columnId);
  
  res.json({
    results: [
      { userId: 'user-456', columnId: req.params.columnId, score: 85, status: 'Graded', notes: 'Good work' },
      { userId: 'user-789', columnId: req.params.columnId, score: 72, status: 'Graded', notes: '' }
    ]
  });
});

// Learn REST API - Get Course Users
app.get('/learn/api/public/v3/courses/:courseId/users', (req, res) => {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) {
    return res.status(401).json({ status: 401, message: 'Unauthorized' });
  }
  logger.info('📊 REST API: GET course users');
  
  res.json({
    results: [
      { userId: 'user-123', userName: 'jsmith', name: { given: 'John', family: 'Smith' }, courseRoleId: 'Instructor' },
      { userId: 'user-456', userName: 'ajohnson', name: { given: 'Alice', family: 'Johnson' }, courseRoleId: 'Student' },
      { userId: 'user-789', userName: 'bwilson', name: { given: 'Bob', family: 'Wilson' }, courseRoleId: 'Student' },
      { userId: 'user-101', userName: 'cdavis', name: { given: 'Carol', family: 'Davis' }, courseRoleId: 'TeachingAssistant' }
    ]
  });
});

// Use route modules
app.use('/', platformRoutes);

app.listen(3000, () => {
  logger.success('LMS Platform running on http://localhost:3000');
  logger.log('📋 Launch URL: http://localhost:3000/lms/course/123/launch?tool=demo');
  logger.log('🔑 JWKS: http://localhost:3000/.well-known/jwks.json\n');
});