const express = require('express');
const { SignJWT, jwtVerify, createRemoteJWKSet } = require('jose');
const { v4: uuid } = require('uuid');
const config = require('../config.json');
const logger = require('../utils/logger').platform;

const router = express.Router();

// Deep link item launch page
router.get('/lms/course/:courseId/launch/deeplink/:itemId', (req, res) => {
  const { courseId, itemId } = req.params;
  
  // Get the stored deep link item
  const item = req.app.locals.deepLinkItems?.get(itemId);
  if (!item) {
    return res.status(404).send(`
      <h1>❌ Deep Link Item Not Found</h1>
      <p>Item ID: ${itemId}</p>
      <a href="/lms/course/${courseId}/launch?tool=demo">← Back to Course</a>
    `);
  }
  
  res.send(`
    <h2>Launch Deep Link Item</h2>
    <div style="background: #e8f5e8; padding: 15px; margin: 10px 0; border-radius: 5px;">
      <h3>${item.title}</h3>
      <p><strong>Description:</strong> ${item.text}</p>
      <p><strong>Target URL:</strong> ${item.url}</p>
      <p><strong>Type:</strong> ${item.type}</p>
      ${item.custom ? `<p><strong>Custom Data:</strong> ${JSON.stringify(item.custom)}</p>` : ''}
    </div>
    
    <form method="POST" action="/lti/login">
      <input type="hidden" name="iss" value="${config.platform.issuer}">
      <input type="hidden" name="login_hint" value="user123">
      <input type="hidden" name="target_link_uri" value="${item.url}">
      <input type="hidden" name="lti_message_hint" value="deeplink-${itemId}">
      <input type="hidden" name="client_id" value="${config.platform.client_id}">
      <input type="hidden" name="resource_link_id" value="${itemId}">
      <button type="submit" style="padding: 10px 20px; font-size: 16px; background: #28a745; color: white; border: none; border-radius: 5px;">
        🚀 Launch "${item.title}"
      </button>
    </form>
    
    <div style="margin-top: 20px;">
      <a href="/lms/course/${courseId}/launch?tool=demo" style="padding: 8px 16px; background: #6c757d; color: white; text-decoration: none; border-radius: 4px;">
        ← Back to Course
      </a>
    </div>
  `);
});

// Launch page
router.get('/lms/course/:courseId/launch', (req, res) => {
  const { tool = 'demo' } = req.query;
  res.send(`
    <h2>LMS Course ${req.params.courseId}</h2>
    <div style="background: #f0f8ff; padding: 15px; margin: 10px 0; border-radius: 5px;">
      <h3>LTI 1.3 Tool Configuration:</h3>
      <p><strong>Login Initiation URL:</strong> ${config.tool.login_url}</p>
      <p><strong>Tool Redirect URL:</strong> ${config.tool.redirect_uris[0]}</p>
      <p><strong>Tool JWKS URL:</strong> ${config.tool.jwks_uri}</p>
      <p><strong>Client ID:</strong> ${config.platform.client_id}</p>
    </div>
    <form method="POST" action="/lti/login">
      <input type="hidden" name="iss" value="${config.platform.issuer}">
      <input type="hidden" name="login_hint" value="user123">
      <input type="hidden" name="target_link_uri" value="${config.platform.target_link_uri}">
      <input type="hidden" name="lti_message_hint" value="course-${req.params.courseId}-tool-${tool}">
      <input type="hidden" name="client_id" value="${config.platform.client_id}">
      <button type="submit" style="padding: 10px 20px; font-size: 16px;">Launch ${tool} Tool</button>
    </form>
  `);
});

// OIDC Login Initiation
router.post('/lti/login', (req, res) => {
  const state = uuid();
  const nonce = uuid();
  
  logger.info('🚀 STEP 1: Platform received launch request');
  logger.log('   Login hint:', req.body.login_hint);
  logger.log('   Message hint:', req.body.lti_message_hint);
  
  // Store session for later validation
  req.app.locals.authSessions.set(state, {
    nonce,
    login_hint: req.body.login_hint,
    lti_message_hint: req.body.lti_message_hint,
    client_id: req.body.client_id,
    target_link_uri: req.body.target_link_uri
  });
  
  const params = new URLSearchParams({
    response_type: 'id_token',
    scope: 'openid',
    client_id: config.platform.client_id,
    redirect_uri: config.tool.redirect_uris[0],
    login_hint: req.body.login_hint,
    lti_message_hint: req.body.lti_message_hint,
    state,
    nonce,
    response_mode: 'form_post',
    prompt: 'none'
  });
  
  logger.info('📤 STEP 2: Redirecting to tool login with OIDC params');
  logger.log('   State:', state);
  logger.log('   Nonce:', nonce);
  
  res.redirect(`${config.tool.login_url}?${params}`);
});

// OIDC Authorization endpoint
router.get('/lti/auth', async (req, res) => {
  const { state, nonce, redirect_uri, client_id } = req.query;
  
  logger.info('🔄 STEP 4: Platform authorization endpoint called');
  logger.log('   State:', state);
  logger.log('   Redirect URI:', redirect_uri);
  
  // Validate session exists
  const session = req.app.locals.authSessions.get(state);
  if (!session) {
    logger.error('Invalid state - session not found');
    return res.status(400).send('Invalid state parameter');
  }
  
  // Validate nonce matches
  if (session.nonce !== nonce) {
    logger.error('Nonce mismatch');
    return res.status(400).send('Invalid nonce parameter');
  }
  
  logger.success('Session validated, generating id_token');
  
  const payload = {
    iss: config.platform.issuer,
    aud: config.platform.client_id,
    sub: 'bd3b4befae4e45f28ba652395e43d354',
    exp: Math.floor(Date.now() / 1000) + 3600,
    iat: Math.floor(Date.now() / 1000),
    nonce,
    email: 'dan.schumm@anthology.com',
    given_name: 'Dan',
    family_name: 'Schumm',
    name: 'Dan Schumm',
    locale: 'en-US',
    'https://purl.imsglobal.org/spec/lti/claim/message_type': session.lti_message_hint?.startsWith('deeplink-') ? 'LtiResourceLinkRequest' : 'LtiDeepLinkingRequest',
    'https://purl.imsglobal.org/spec/lti/claim/version': '1.3.0',
    'https://purl.imsglobal.org/spec/lti/claim/deployment_id': config.platform.deployment_id,
    'https://purl.imsglobal.org/spec/lti/claim/target_link_uri': session.target_link_uri,
    'https://purl.imsglobal.org/spec/lti/claim/roles': [
      'http://purl.imsglobal.org/vocab/lis/v2/membership#Learner',
      'http://purl.imsglobal.org/vocab/lis/v2/system/person#Administrator'
    ],
    'https://purl.imsglobal.org/spec/lti/claim/custom': session.lti_message_hint?.startsWith('deeplink-') ? {
      route: 'deeplink',
      caliper_profile_url: `${config.platform.issuer}/learn/api/v1/telemetry/caliper/profile`,
      caliper_federated_session_id: 'https://caliper-mapping.cloudbb.blackboard.com/v1/sites/9970f70e-7ebb-4f87-b372-06d5c2d26cbd/sessions/02ABAC7AC7E7B601BFC8B5D09D99E9CA',
      demo: 'true',
      contentType: 'ltiResourceLink'
    } : {
      route: 'deeplink'
    },
    'https://purl.imsglobal.org/spec/lti/claim/context': {
      id: '3d536dd2cf504f31b94d3670706a98a4',
      title: 'Demo Sandbox Course',
      label: 'sandbox-U0018885',
      type: ['http://purl.imsglobal.org/vocab/lis/v2/course#CourseOffering']
    },
    'https://purl.imsglobal.org/spec/lti-nrps/claim/namesroleservice': {
      context_memberships_url: session.lti_message_hint?.startsWith('deeplink-') ? 
        `${config.platform.issuer}/learn/api/v1/lti/external/namesandroles/_612_1` :
        `${config.platform.issuer}/lti/nrps/3d536dd2cf504f31b94d3670706a98a4/memberships`,
      service_versions: ['2.0'],
      ...(session.lti_message_hint?.startsWith('deeplink-') ? {
        scope: ['https://purl.imsglobal.org/spec/lti-nrps/scope/contextmembership.readonly']
      } : {})
    },
    'https://purl.imsglobal.org/spec/lti-ags/claim/endpoint': {
      scope: session.lti_message_hint?.startsWith('deeplink-') ? 
        ['https://purl.imsglobal.org/spec/lti-ags/scope/lineitem', 'https://purl.imsglobal.org/spec/lti-ags/scope/result.readonly', 'https://purl.imsglobal.org/spec/lti-ags/scope/score', 'https://purl.imsglobal.org/spec/lti-ags/scope/lineitem.readonly'] :
        ['https://purl.imsglobal.org/spec/lti-ags/scope/lineitem', 'https://purl.imsglobal.org/spec/lti-ags/scope/result.readonly', 'https://purl.imsglobal.org/spec/lti-ags/scope/score'],
      lineitems: session.lti_message_hint?.startsWith('deeplink-') ?
        `${config.platform.issuer}/learn/api/v1/lti/courses/_612_1/lineItems` :
        `${config.platform.issuer}/lti/ags/3d536dd2cf504f31b94d3670706a98a4/lineitems`,
      lineitem: session.lti_message_hint?.startsWith('deeplink-') ?
        `${config.platform.issuer}/learn/api/v1/lti/courses/_612_1/lineItems/_1980_1` :
        `${config.platform.issuer}/lti/ags/3d536dd2cf504f31b94d3670706a98a4/lineitems/1`
    },
    'https://purl.imsglobal.org/spec/lti/claim/tool_platform': {
      contact_email: 'admin@localhost',
      description: 'Mock LMS Platform',
      guid: 'd944e265183b40e088e21a4df2eb3765',
      name: 'Mock LMS',
      url: 'http://localhost:3000/',
      product_family_code: 'MockLMS',
      version: '1.0.0'
    },
    ...(session.lti_message_hint?.startsWith('deeplink-') ? {
      'https://purl.imsglobal.org/spec/lti/claim/resource_link': {
        id: '_3760_1',
        title: 'LTI'
      },
      'https://purl.imsglobal.org/spec/lti/claim/lis': {
        person_sourcedid: 'dan.schumm',
        course_section_sourcedid: 'sandbox-U0018885'
      },
      'https://purl.imsglobal.org/spec/lti/claim/launch_presentation': {
        return_url: `${config.platform.issuer}/webapps/blackboard/execute/blti/launchReturn?course_id=_612_1&content_id=_3760_1&toGC=false&nonce=9b65f483a1e84253a583b495ffc55317&launch_id=5f6d7da9-bc00-47ca-a060-a3593aaa8b49&link_id=_3760_1&launch_time=${Date.now()}`,
        locale: 'en-US'
      },
      'https://purl.imsglobal.org/spec/lti-gs/claim/groupsservice': {
        context_groups_url: `${config.platform.issuer}/learn/api/v1/lti/courses/_612_1/groups`,
        context_group_sets_url: `${config.platform.issuer}/learn/api/v1/lti/courses/_612_1/groupsets`,
        service_versions: ['1.0'],
        scope: ['https://purl.imsglobal.org/spec/lti-gs/scope/contextgroup.readonly']
      },
      'https://blackboard.com/webapps/foundations-connector/foundations-ids': {
        'tenant-id': 'a53bf317-5ee5-4582-9892-899980467ff4',
        'user-id': '47dbdd14-89b4-11ec-9b19-b102fa07cb7e',
        'course-id': '4d04027f-cd62-11ed-af4a-41f4b888e126',
        'site-id': '9970f70e-7ebb-4f87-b372-06d5c2d26cbd',
        region: 'us-east-1'
      }
    } : {
      'https://purl.imsglobal.org/spec/lti-dl/claim/deep_linking_settings': {
        accept_media_types: '*/*',
        accept_presentation_document_targets: ['iframe', 'window'],
        accept_types: ['ltiResourceLink', 'link'],
        accept_multiple: true,
        auto_create: true,
        accept_copy_advice: false,
        deep_link_return_url: 'http://localhost:3000/webapps/blackboard/controller/lti/v2/deeplinking',
        data: '_612_1::_1827_1::0::false::true::_366_1::99bfaa1f39fd4dd299033c0c6125c7c8::false::false'
      }
    }),
    'https://blackboard.com/lti/claim/one_time_session_token': '8764e66e730f481fbb95011675041a6'
  };
  
  const id_token = await new SignJWT(payload)
    .setProtectedHeader({ alg: 'RS256', kid: 'platform-key' })
    .sign(req.app.locals.platformKeys.privateKey);
  
  logger.success('🎫 STEP 5: Signed JWT id_token created, posting to tool');
  
  // Clean up session
  req.app.locals.authSessions.delete(state);
  
  res.send(`
    <form method="POST" action="${redirect_uri}">
      <input type="hidden" name="id_token" value="${id_token}">
      <input type="hidden" name="state" value="${state}">
    </form>
    <script>document.forms[0].submit();</script>
  `);
});

// Mock OAuth authorization endpoint
router.get('/learn/api/public/v1/oauth2/authorizationcode', (req, res) => {
  const { redirect_uri, one_time_session_token, scope, response_type, client_id, state } = req.query;
  
  logger.info('🔐 STEP 7b: Platform OAuth authorization endpoint called');
  logger.log('   Redirect URI:', redirect_uri);
  logger.log('   Session Token:', one_time_session_token);
  
  // Generate mock authorization code
  const authCode = 'mock_auth_code_' + Math.random().toString(36).substr(2, 9);
  
  // Parse the redirect URI to extract the actual callback URL and preserve state
  const decodedRedirectUri = decodeURIComponent(redirect_uri);
  const [baseUrl, existingParams] = decodedRedirectUri.split('?');
  const urlParams = new URLSearchParams(existingParams || '');
  
  // Add OAuth response parameters
  urlParams.set('code', authCode);
  urlParams.set('scope', scope || '*');
  
  // Preserve the state from the original request
  if (state) {
    urlParams.set('state', state);
  }
  
  const finalRedirectUrl = `${baseUrl}?${urlParams.toString()}`;
  
  logger.info('🔄 STEP 8: Redirecting to tool OAuth callback with authorization code');
  logger.log('   Final Redirect:', finalRedirectUrl);
  
  res.redirect(finalRedirectUrl);
});

// Mock NRPS endpoint
router.get('/lti/nrps/:contextId/memberships', (req, res) => {
  res.json({
    id: `${config.platform.issuer}/lti/nrps/${req.params.contextId}/memberships`,
    context: {
      id: req.params.contextId,
      label: 'Introduction to Computer Science',
      title: 'CS 101 - Fall 2024'
    },
    members: [
      {
        status: 'Active',
        name: 'John Smith',
        picture: 'https://via.placeholder.com/40x40/007acc/ffffff?text=JS',
        given_name: 'John',
        family_name: 'Smith',
        email: 'john.smith@university.edu',
        user_id: 'user-123',
        roles: ['http://purl.imsglobal.org/vocab/lis/v2/membership#Instructor']
      },
      {
        status: 'Active',
        name: 'Alice Johnson',
        picture: 'https://via.placeholder.com/40x40/28a745/ffffff?text=AJ',
        given_name: 'Alice',
        family_name: 'Johnson',
        email: 'alice.johnson@university.edu',
        user_id: 'user-456',
        roles: ['http://purl.imsglobal.org/vocab/lis/v2/membership#Learner']
      },
      {
        status: 'Active',
        name: 'Bob Wilson',
        picture: 'https://via.placeholder.com/40x40/dc3545/ffffff?text=BW',
        given_name: 'Bob',
        family_name: 'Wilson',
        email: 'bob.wilson@university.edu',
        user_id: 'user-789',
        roles: ['http://purl.imsglobal.org/vocab/lis/v2/membership#Learner']
      },
      {
        status: 'Active',
        name: 'Carol Davis',
        picture: 'https://via.placeholder.com/40x40/6f42c1/ffffff?text=CD',
        given_name: 'Carol',
        family_name: 'Davis',
        email: 'carol.davis@university.edu',
        user_id: 'user-101',
        roles: ['http://purl.imsglobal.org/vocab/lis/v2/membership#TeachingAssistant']
      }
    ]
  });
});

// Mock AGS endpoints
let mockLineItems = [
  {
    id: `${config.platform.issuer}/lti/ags/3d536dd2cf504f31b94d3670706a98a4/lineitems/1`,
    scoreMaximum: 100,
    label: 'Midterm Exam',
    resourceId: 'midterm-exam',
    tag: 'exam',
    resourceLinkId: 'resource-link-1',
    startDateTime: '2024-03-01T09:00:00Z',
    endDateTime: '2024-03-01T11:00:00Z'
  },
  {
    id: `${config.platform.issuer}/lti/ags/3d536dd2cf504f31b94d3670706a98a4/lineitems/2`,
    scoreMaximum: 50,
    label: 'Quiz 1',
    resourceId: 'quiz-1',
    tag: 'quiz',
    resourceLinkId: 'resource-link-2'
  }
];

let mockScores = new Map();

// Get all line items
router.get('/lti/ags/:contextId/lineitems', (req, res) => {
  const { limit = 10, resourceId, resourceLinkId, tag } = req.query;
  
  logger.info('📋 AGS Line Items Request');
  logger.log('   Context ID:', req.params.contextId);
  logger.log('   Limit:', limit);
  logger.log('   Filters:', { resourceId, resourceLinkId, tag });
  
  let filteredItems = mockLineItems;
  
  if (resourceId) {
    filteredItems = filteredItems.filter(item => item.resourceId === resourceId);
  }
  if (resourceLinkId) {
    filteredItems = filteredItems.filter(item => item.resourceLinkId === resourceLinkId);
  }
  if (tag) {
    filteredItems = filteredItems.filter(item => item.tag === tag);
  }
  
  logger.success(`✅ Returning ${filteredItems.length} line items`);
  res.json(filteredItems.slice(0, parseInt(limit)));
});

// Create line item
router.post('/lti/ags/:contextId/lineitems', (req, res) => {
  logger.info('➕ AGS Create Line Item');
  logger.log('   Context ID:', req.params.contextId);
  logger.log('   Label:', req.body.label);
  logger.log('   Score Maximum:', req.body.scoreMaximum);
  logger.log('   Tag:', req.body.tag);
  
  const newItem = {
    id: `${config.platform.issuer}/lti/ags/${req.params.contextId}/lineitems/${mockLineItems.length + 1}`,
    ...req.body
  };
  
  mockLineItems.push(newItem);
  logger.success(`✅ Line item created with ID: ${newItem.id}`);
  res.status(201).json(newItem);
});

// Get specific line item
router.get('/lti/ags/:contextId/lineitems/:lineItemId', (req, res) => {
  logger.info('🔍 AGS Get Specific Line Item');
  logger.log('   Context ID:', req.params.contextId);
  logger.log('   Line Item ID:', req.params.lineItemId);
  
  const item = mockLineItems.find(item => item.id.endsWith(req.params.lineItemId));
  if (!item) {
    logger.error('❌ Line item not found');
    return res.status(404).json({ error: 'Line item not found' });
  }
  
  logger.success(`✅ Found line item: ${item.label}`);
  res.json(item);
});

// Update line item
router.put('/lti/ags/:contextId/lineitems/:lineItemId', (req, res) => {
  const index = mockLineItems.findIndex(item => item.id.endsWith(req.params.lineItemId));
  if (index === -1) {
    return res.status(404).json({ error: 'Line item not found' });
  }
  
  mockLineItems[index] = { ...mockLineItems[index], ...req.body };
  res.json(mockLineItems[index]);
});

// Delete line item
router.delete('/lti/ags/:contextId/lineitems/:lineItemId', (req, res) => {
  const index = mockLineItems.findIndex(item => item.id.endsWith(req.params.lineItemId));
  if (index === -1) {
    return res.status(404).json({ error: 'Line item not found' });
  }
  
  mockLineItems.splice(index, 1);
  res.status(204).send();
});

// Submit score
router.post('/lti/ags/:contextId/lineitems/:lineItemId/scores', (req, res) => {
  const { userId, scoreGiven, scoreMaximum, comment, timestamp, activityProgress, gradingProgress } = req.body;
  
  logger.info('📊 AGS Score Submission Received');
  logger.log('   Context ID:', req.params.contextId);
  logger.log('   Line Item ID:', req.params.lineItemId);
  logger.log('   User ID:', userId);
  logger.log('   Score:', `${scoreGiven}/${scoreMaximum}`);
  logger.log('   Comment:', comment || 'none');
  logger.log('   Activity Progress:', activityProgress || 'Completed');
  logger.log('   Grading Progress:', gradingProgress || 'FullyGraded');
  
  const scoreKey = `${req.params.lineItemId}-${userId}`;
  const score = {
    userId,
    scoreGiven,
    scoreMaximum,
    comment,
    timestamp: timestamp || new Date().toISOString(),
    activityProgress: activityProgress || 'Completed',
    gradingProgress: gradingProgress || 'FullyGraded'
  };
  
  mockScores.set(scoreKey, score);
  logger.success('✅ Score stored successfully');
  res.status(201).json({ message: 'Score submitted successfully' });
});

// Get results
router.get('/lti/ags/:contextId/lineitems/:lineItemId/results', (req, res) => {
  const { limit = 10, userId } = req.query;
  
  const results = [];
  for (const [key, score] of mockScores.entries()) {
    if (key.startsWith(req.params.lineItemId)) {
      if (!userId || score.userId === userId) {
        results.push({
          id: `result-${key}`,
          userId: score.userId,
          resultScore: score.scoreGiven,
          resultMaximum: score.scoreMaximum,
          comment: score.comment,
          scoreOf: `${config.platform.issuer}/lti/ags/${req.params.contextId}/lineitems/${req.params.lineItemId}`,
          timestamp: score.timestamp
        });
      }
    }
  }
  
  res.json(results.slice(0, parseInt(limit)));
});

// Deep Link return endpoint
router.post('/webapps/blackboard/controller/lti/v2/deeplinking', async (req, res) => {
  try {
    const { JWT } = req.body;
    
    logger.info('🔗 STEP 9: Platform received Deep Link response');
    logger.log('   JWT length:', JWT?.length || 0);
    
    if (!JWT) {
      throw new Error('Missing JWT parameter');
    }
    
    // Verify the Deep Link JWT using dev portal's public key (simulates Blackboard's verification)
    logger.info('Verifying JWT signature via Dev Portal JWKS...');
    
    const devPortalJWKS = createRemoteJWKSet(new URL('/.well-known/jwks.json', 'http://localhost:3002'));
    const { payload } = await jwtVerify(JWT, devPortalJWKS, {
      algorithms: ['RS256']
    });
    
    logger.success('JWT verified using Dev Portal keys');
    
    console.log('✅ Deep Link JWT verified');
    
    const messageType = payload['https://purl.imsglobal.org/spec/lti/claim/message_type'];
    const contentItems = payload['https://purl.imsglobal.org/spec/lti-dl/claim/content_items'];
    
    if (messageType !== 'LtiDeepLinkingResponse') {
      throw new Error('Invalid message type for deep linking response');
    }
    
    logger.success('Deep Link content items received:', contentItems?.length || 0);
    
    // Store deep link items for later launch
    if (!req.app.locals.deepLinkItems) {
      req.app.locals.deepLinkItems = new Map();
    }
    
    const itemIds = [];
    contentItems?.forEach((item, index) => {
      const itemId = `dl_${Date.now()}_${index}`;
      req.app.locals.deepLinkItems.set(itemId, item);
      itemIds.push(itemId);
    });
    
    res.send(`
      <h1>🎉 Deep Link Received!</h1>
      <div style="background: #e8f5e8; padding: 10px; margin: 10px 0; border-radius: 5px;">
        <strong>✅ Platform Successfully Received Deep Link:</strong> Content will be added to course!
      </div>
      
      <h2>Content Items Created:</h2>
      ${contentItems?.map(item => `
        <div style="border: 1px solid #ddd; padding: 15px; margin: 10px 0; border-radius: 5px;">
          <h3>${item.title}</h3>
          <p><strong>Type:</strong> ${item.type}</p>
          <p><strong>URL:</strong> <a href="${item.url}" target="_blank">${item.url}</a></p>
          <p><strong>Description:</strong> ${item.text}</p>
          ${item.custom ? `<p><strong>Custom Data:</strong> ${JSON.stringify(item.custom)}</p>` : ''}
        </div>
      `).join('') || '<p>No content items found</p>'}
      
      <details style="margin: 20px 0;">
        <summary><strong>Complete Deep Link Response (click to expand)</strong></summary>
        <pre style="background: #f5f5f5; padding: 10px; overflow: auto;">${JSON.stringify(payload, null, 2)}</pre>
      </details>
      
      <div style="background: #d1ecf1; padding: 10px; margin: 10px 0; border-radius: 5px;">
        <strong>Platform Action:</strong> In a real LMS, this content would now be:
        <ul>
          <li>Added to the course content area</li>
          <li>Made available to students</li>
          <li>Configured with the provided settings</li>
        </ul>
      </div>
      
      <div style="margin: 20px 0;">
        <h3>Launch Created Items:</h3>
        ${contentItems?.map((item, index) => {
          const itemId = itemIds[index];
          return `
            <a href="/lms/course/123/launch/deeplink/${itemId}" 
               style="padding: 10px 20px; background: #28a745; color: white; text-decoration: none; border-radius: 5px; margin-right: 10px; display: inline-block; margin-bottom: 10px;">
              🚀 Launch "${item.title}"
            </a>
          `;
        }).join('') || ''}
      </div>
      
      <a href="http://localhost:3000/lms/course/123/launch?tool=demo" style="padding: 10px 20px; background: #007bff; color: white; text-decoration: none; border-radius: 5px;">Start New Launch</a>
    `);
    
  } catch (error) {
    logger.error('Deep Link Error:', error.message);
    res.status(400).send(`
      <h1>❌ Deep Link Error</h1>
      <p><strong>Error:</strong> ${error.message}</p>
      <p>Check the console logs for more details.</p>
    `);
  }
});

module.exports = router;