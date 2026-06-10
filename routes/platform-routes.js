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
    <!DOCTYPE html>
    <html>
    <head>
      <title>Launch: ${item.title}</title>
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f5f5f5; padding: 40px; }
        .container { max-width: 500px; margin: 0 auto; }
        .item-info { background: #e8f5e8; padding: 15px; margin-bottom: 20px; border-radius: 5px; }
        .item-info h3 { margin-bottom: 6px; }
        .item-info p { font-size: 13px; color: #555; margin: 2px 0; }
        .user-info { background: #e8f4fd; padding: 12px 15px; border-radius: 5px; margin-bottom: 20px; font-size: 13px; }
        .btn { padding: 10px 20px; font-size: 14px; border: none; border-radius: 5px; cursor: pointer; }
        .btn-launch { background: #28a745; color: white; }
        .btn-back { background: #6c757d; color: white; text-decoration: none; display: inline-block; margin-left: 10px; }
      </style>
    </head>
    <body>
      <div class="container">
        <h2>🚀 Launch Content Item</h2>
        <div class="item-info">
          <h3>${item.title}</h3>
          <p><strong>Description:</strong> ${item.text || 'LTI Resource Link'}</p>
          <p><strong>Type:</strong> ${item.type}</p>
          ${item.lineItem ? '<p><strong>Linked Assignment:</strong> ' + item.lineItem + '</p>' : ''}
        </div>

        <div class="user-info" id="userDisplay">Loading user...</div>

        <form method="POST" action="/lti/login" id="launchForm">
          <input type="hidden" name="iss" value="${config.platform.issuer}">
          <input type="hidden" name="target_link_uri" value="${item.url}">
          <input type="hidden" name="lti_message_hint" value="deeplink-${itemId}">
          <input type="hidden" name="client_id" value="${config.platform.client_id}">
          <input type="hidden" name="login_hint" id="f_login_hint">
          <input type="hidden" name="given_name" id="f_given_name">
          <input type="hidden" name="family_name" id="f_family_name">
          <input type="hidden" name="email" id="f_email">
          <input type="hidden" name="role" id="f_role">
          <button type="submit" class="btn btn-launch">🚀 Launch "${item.title}"</button>
          <a href="/lms/course/${courseId}/launch?tool=demo" class="btn btn-back">← Back to Course</a>
        </form>
      </div>
      <script>
        var user = JSON.parse(localStorage.getItem('lms_user') || 'null');
        if (!user) { window.location.href = '/lms/course/${courseId}/launch?tool=demo'; }
        else {
          document.getElementById('userDisplay').innerHTML = '👤 Launching as: <strong>' + user.given_name + ' ' + user.family_name + '</strong> (' + user.login_hint + ') — ' + user.role;
          document.getElementById('f_login_hint').value = user.login_hint;
          document.getElementById('f_given_name').value = user.given_name;
          document.getElementById('f_family_name').value = user.family_name;
          document.getElementById('f_email').value = user.email;
          document.getElementById('f_role').value = user.role;
        }
      </script>
    </body>
    </html>
  `);
});

// Tools page
router.get('/lms/course/:courseId/tools', (req, res) => {
  const { courseId } = req.params;

  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Blackboard Learn - Tools</title>
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f5f5f5; }
        .header { background: #262626; color: white; padding: 12px 24px; display: flex; align-items: center; justify-content: space-between; }
        .header h1 { font-size: 18px; font-weight: 500; }
        .header .logo { font-weight: 700; font-size: 20px; }
        .breadcrumb { background: #fff; padding: 10px 24px; border-bottom: 1px solid #ddd; font-size: 13px; color: #666; }
        .breadcrumb a { color: #0066cc; text-decoration: none; }
        .layout { display: flex; min-height: calc(100vh - 90px); }
        .sidebar { width: 220px; background: #fff; border-right: 1px solid #ddd; padding: 16px 0; }
        .sidebar a { display: block; padding: 10px 20px; color: #333; text-decoration: none; font-size: 14px; }
        .sidebar a:hover { background: #f0f0f0; }
        .sidebar a.active { background: #e8f4fd; color: #0066cc; border-left: 3px solid #0066cc; }
        .content { flex: 1; padding: 24px; }
        .tool-card { background: white; border: 1px solid #ddd; border-radius: 4px; padding: 16px; margin-bottom: 12px; display: flex; align-items: center; gap: 12px; }
        .tool-card:hover { border-color: #0066cc; cursor: pointer; }
        .tool-card .icon { width: 40px; height: 40px; border-radius: 4px; display: flex; align-items: center; justify-content: center; color: white; font-size: 18px; }
        .tool-card .details h3 { font-size: 15px; color: #0066cc; margin-bottom: 2px; }
        .tool-card .details p { font-size: 13px; color: #666; }
        .user-info { background: #e8f4fd; padding: 10px 16px; border-radius: 4px; margin-bottom: 16px; font-size: 13px; }
      </style>
    </head>
    <body>
      <div class="header">
        <span class="logo">Bb</span>
        <h1>Demo Sandbox Course</h1>
        <span style="font-size: 13px;">sandbox-U0018885</span>
      </div>
      <div class="breadcrumb">
        <a href="/lms/course/${courseId}/launch?tool=demo">Course</a> &gt; Tools
      </div>
      <div class="layout">
        <div class="sidebar">
          <a href="/lms/course/${courseId}/launch?tool=demo">Content</a>
          <a href="#">Announcements</a>
          <a href="#">Discussions</a>
          <a href="/lms/course/${courseId}/gradebook">Gradebook</a>
          <a href="#">Groups</a>
          <a href="/lms/course/${courseId}/tools" class="active">Tools</a>
        </div>
        <div class="content">
          <h2 style="margin-bottom: 6px;">🛠️ Course Tools</h2>
          <p style="font-size: 13px; color: #666; margin-bottom: 20px;">LTI tools available in this course. These launch as a direct Resource Link (no Deep Linking).</p>

          <div id="userBanner" class="user-info" style="display:none;"></div>

          <form method="POST" action="/lti/login" id="toolLaunchForm">
            <input type="hidden" name="iss" value="${config.platform.issuer}">
            <input type="hidden" name="target_link_uri" value="${config.tool.redirect_uris[0]}">
            <input type="hidden" name="lti_message_hint" value="coursetool-${courseId}">
            <input type="hidden" name="client_id" value="${config.platform.client_id}">
            <input type="hidden" name="login_hint" id="f_login_hint">
            <input type="hidden" name="given_name" id="f_given_name">
            <input type="hidden" name="family_name" id="f_family_name">
            <input type="hidden" name="email" id="f_email">
            <input type="hidden" name="role" id="f_role">
          </form>

          <div class="tool-card" onclick="launchCourseTool()">
            <div class="icon" style="background: #0066cc;">🛠️</div>
            <div class="details">
              <h3>Demo Course Tool</h3>
              <p>LTI 1.3 Course Tool — Direct resource link launch (no deep linking)</p>
            </div>
          </div>

          <div class="tool-card" style="opacity: 0.5; cursor: default;">
            <div class="icon" style="background: #666;">📝</div>
            <div class="details">
              <h3>Attendance Tracker</h3>
              <p>Track student attendance — (placeholder)</p>
            </div>
          </div>

          <div class="tool-card" style="opacity: 0.5; cursor: default;">
            <div class="icon" style="background: #666;">📊</div>
            <div class="details">
              <h3>Analytics Dashboard</h3>
              <p>View course analytics — (placeholder)</p>
            </div>
          </div>
        </div>
      </div>
      <script>
        function launchCourseTool() {
          var user = JSON.parse(localStorage.getItem('lms_user') || 'null');
          if (!user) { window.location.href = '/lms/course/${courseId}/launch?tool=demo'; return; }
          document.getElementById('f_login_hint').value = user.login_hint;
          document.getElementById('f_given_name').value = user.given_name;
          document.getElementById('f_family_name').value = user.family_name;
          document.getElementById('f_email').value = user.email;
          document.getElementById('f_role').value = user.role;
          document.getElementById('toolLaunchForm').submit();
        }
        (function() {
          var user = JSON.parse(localStorage.getItem('lms_user') || 'null');
          if (user) {
            document.getElementById('userBanner').innerHTML = '👤 Logged in as: <strong>' + user.given_name + ' ' + user.family_name + '</strong> (' + user.login_hint + ') — ' + user.role;
            document.getElementById('userBanner').style.display = 'block';
          }
        })();
      </script>
    </body>
    </html>
  `);
});

// Gradebook page
router.get('/lms/course/:courseId/gradebook', (req, res) => {
  const { courseId } = req.params;

  const lineItemsHtml = mockLineItems.map(item => {
    const itemId = item.id.split('/').pop();
    // Gather scores for this line item
    const scores = [];
    for (const [key, score] of mockScores.entries()) {
      if (key.startsWith(itemId)) scores.push(score);
    }
    const scoresHtml = scores.length > 0
      ? scores.map(s => `<div style="font-size:12px; color:#333; padding:2px 0;">${s.userId}: <strong>${s.scoreGiven}</strong>/${s.scoreMaximum}</div>`).join('')
      : '<div style="font-size:12px; color:#999;">No scores yet</div>';

    return `
      <tr>
        <td style="padding:10px; border-bottom:1px solid #eee;"><strong>${item.label}</strong></td>
        <td style="padding:10px; border-bottom:1px solid #eee;">${item.scoreMaximum}</td>
        <td style="padding:10px; border-bottom:1px solid #eee;">${item.tag || '—'}</td>
        <td style="padding:10px; border-bottom:1px solid #eee;">${scoresHtml}</td>
      </tr>
    `;
  }).join('');

  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Blackboard Learn - Gradebook</title>
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f5f5f5; }
        .header { background: #262626; color: white; padding: 12px 24px; display: flex; align-items: center; justify-content: space-between; }
        .header h1 { font-size: 18px; font-weight: 500; }
        .header .logo { font-weight: 700; font-size: 20px; }
        .breadcrumb { background: #fff; padding: 10px 24px; border-bottom: 1px solid #ddd; font-size: 13px; color: #666; }
        .breadcrumb a { color: #0066cc; text-decoration: none; }
        .layout { display: flex; min-height: calc(100vh - 90px); }
        .sidebar { width: 220px; background: #fff; border-right: 1px solid #ddd; padding: 16px 0; }
        .sidebar a { display: block; padding: 10px 20px; color: #333; text-decoration: none; font-size: 14px; }
        .sidebar a:hover { background: #f0f0f0; }
        .sidebar a.active { background: #e8f4fd; color: #0066cc; border-left: 3px solid #0066cc; }
        .content { flex: 1; padding: 24px; }
        table { width: 100%; border-collapse: collapse; background: white; border: 1px solid #ddd; border-radius: 4px; }
        th { text-align: left; padding: 12px 10px; background: #f8f9fa; border-bottom: 2px solid #dee2e6; font-size: 13px; color: #555; }
      </style>
    </head>
    <body>
      <div class="header">
        <span class="logo">Bb</span>
        <h1>Demo Sandbox Course</h1>
        <span style="font-size: 13px;">sandbox-U0018885</span>
      </div>
      <div class="breadcrumb">
        <a href="/lms/course/${courseId}/launch?tool=demo">Course</a> &gt; Gradebook
      </div>
      <div class="layout">
        <div class="sidebar">
          <a href="/lms/course/${courseId}/launch?tool=demo">Content</a>
          <a href="#">Announcements</a>
          <a href="#">Discussions</a>
          <a href="/lms/course/${courseId}/gradebook" class="active">Gradebook</a>
          <a href="#">Groups</a>
          <a href="/lms/course/${courseId}/tools">Tools</a>
        </div>
        <div class="content">
          <h2 style="margin-bottom:16px;">📊 Gradebook</h2>
          ${mockLineItems.length === 0
            ? '<p style="color:#666;">No gradebook items yet. Create an assignment from the LTI tool to see it here.</p>'
            : `<table>
                <thead><tr><th>Assignment</th><th>Max Score</th><th>Tag</th><th>Scores</th></tr></thead>
                <tbody>${lineItemsHtml}</tbody>
              </table>`
          }
        </div>
      </div>
    </body>
    </html>
  `);
});

// Launch page
router.get('/lms/course/:courseId/launch', (req, res) => {
  const { tool = 'demo', dl_success } = req.query;
  
  // Get stored deep link items
  const deepLinkItems = req.app.locals.deepLinkItems || new Map();
  const dlItemsHtml = Array.from(deepLinkItems.entries()).map(([itemId, item]) => `
    <a href="/lms/course/${req.params.courseId}/launch/deeplink/${itemId}" style="text-decoration: none; color: inherit;">
      <div class="content-item">
        <div class="icon" style="background: #28a745;">🔗</div>
        <div class="details">
          <h3>${item.title}</h3>
          <p>${item.text || 'LTI Resource Link'} — Click to launch</p>
        </div>
      </div>
    </a>
  `).join('');

  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Blackboard Learn - Course</title>
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f5f5f5; }
        .header { background: #262626; color: white; padding: 12px 24px; display: flex; align-items: center; justify-content: space-between; }
        .header h1 { font-size: 18px; font-weight: 500; }
        .header .logo { font-weight: 700; font-size: 20px; }
        .breadcrumb { background: #fff; padding: 10px 24px; border-bottom: 1px solid #ddd; font-size: 13px; color: #666; }
        .breadcrumb a { color: #0066cc; text-decoration: none; }
        .layout { display: flex; min-height: calc(100vh - 90px); }
        .sidebar { width: 220px; background: #fff; border-right: 1px solid #ddd; padding: 16px 0; }
        .sidebar a { display: block; padding: 10px 20px; color: #333; text-decoration: none; font-size: 14px; }
        .sidebar a:hover { background: #f0f0f0; }
        .sidebar a.active { background: #e8f4fd; color: #0066cc; border-left: 3px solid #0066cc; }
        .content { flex: 1; padding: 24px; }
        .content-item { background: white; border: 1px solid #ddd; border-radius: 4px; padding: 16px; margin-bottom: 12px; display: flex; align-items: center; gap: 12px; }
        .content-item:hover { border-color: #0066cc; cursor: pointer; }
        .content-item .icon { width: 40px; height: 40px; background: #0066cc; border-radius: 4px; display: flex; align-items: center; justify-content: center; color: white; font-size: 18px; }
        .content-item .details h3 { font-size: 15px; color: #0066cc; margin-bottom: 2px; }
        .content-item .details p { font-size: 13px; color: #666; }
        .section-header { font-size: 13px; font-weight: 600; color: #666; text-transform: uppercase; letter-spacing: 0.5px; margin: 20px 0 10px; padding-bottom: 6px; border-bottom: 1px solid #eee; }
        
        .modal-overlay { display: none; position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); z-index: 1000; align-items: center; justify-content: center; }
        .modal-overlay.active { display: flex; }
        .modal { background: white; border-radius: 8px; padding: 24px; width: 450px; max-width: 90vw; box-shadow: 0 4px 20px rgba(0,0,0,0.3); }
        .modal h2 { margin-bottom: 16px; font-size: 18px; }
        .modal label { display: block; font-size: 13px; font-weight: 600; margin-bottom: 4px; color: #555; }
        .modal input, .modal select { width: 100%; padding: 8px 10px; border: 1px solid #ccc; border-radius: 4px; font-size: 14px; margin-bottom: 12px; }
        .modal .actions { display: flex; gap: 10px; justify-content: flex-end; margin-top: 16px; }
        .modal .btn { padding: 8px 20px; border: none; border-radius: 4px; font-size: 14px; cursor: pointer; }
        .modal .btn-launch { background: #0066cc; color: white; }
        .modal .btn-cancel { background: #eee; color: #333; }
      </style>
    </head>
    <body>
      <div class="header">
        <span class="logo">Bb</span>
        <h1>Demo Sandbox Course</h1>
        <span style="font-size: 13px;">sandbox-U0018885</span>
      </div>
      
      <div class="breadcrumb">
        <a href="#">Courses</a> &gt; <a href="#">Demo Sandbox Course</a> &gt; Content
      </div>
      
      <div class="layout">
        <div class="sidebar">
          <a href="#" class="active">Content</a>
          <a href="#">Announcements</a>
          <a href="#">Discussions</a>
          <a href="/lms/course/${req.params.courseId}/gradebook">Gradebook</a>
          <a href="#">Groups</a>
          <a href="/lms/course/${req.params.courseId}/tools">Tools</a>
        </div>
        
        <div class="content">
          ${dl_success ? '<div style="padding: 12px 16px; border-radius: 4px; margin-bottom: 16px; font-size: 14px; background: #d4edda; color: #155724; border: 1px solid #c3e6cb;">✅ <strong>Deep Link Received!</strong> Content item has been added to the course.</div>' : ''}
          
          <div id="userBanner" style="display:none; padding: 10px 16px; border-radius: 4px; margin-bottom: 16px; font-size: 13px; background: #e8f4fd; color: #333; border: 1px solid #b8daff;"></div>
          
          <div class="section-header">Course Content</div>
          
          <div class="content-item" onclick="openLaunchModal()">
            <div class="icon">🛠️</div>
            <div class="details">
              <h3>Launch ${tool} Tool</h3>
              <p>LTI 1.3 Tool — Click to launch</p>
            </div>
          </div>
          
          ${dlItemsHtml}
          
          <div class="content-item" onclick="fetch('/admin/clear-console', {method:'POST'}).then(()=>{var el=document.getElementById('clearMsg');el.style.display='block';setTimeout(()=>el.style.display='none',2000)})">
            <div class="icon" style="background: #dc3545;">🧹</div>
            <div class="details">
              <h3>Clear Console Logs</h3>
              <p>Clear all service console output</p>
              <span id="clearMsg" style="display:none; color: green; font-size: 12px;">✅ Console cleared</span>
            </div>
          </div>
          
          <div class="content-item" style="opacity: 0.5; cursor: default;" onclick="">
            <div class="icon" style="background: #666;">📄</div>
            <div class="details">
              <h3>Week 1: Introduction</h3>
              <p>Course overview and syllabus</p>
            </div>
          </div>
          
          <div class="content-item" style="opacity: 0.5; cursor: default;" onclick="">
            <div class="icon" style="background: #666;">📄</div>
            <div class="details">
              <h3>Week 2: Getting Started</h3>
              <p>Setup and configuration</p>
            </div>
          </div>
          
          <div class="section-header">LTI Configuration</div>
          <div style="background: white; border: 1px solid #ddd; border-radius: 4px; padding: 16px; font-size: 13px; color: #666;">
            <p><strong>Login Initiation URL:</strong> ${config.tool.login_url}</p>
            <p><strong>Tool Redirect URL:</strong> ${config.tool.redirect_uris[0]}</p>
            <p><strong>Client ID:</strong> ${config.platform.client_id}</p>
          </div>
        </div>
      </div>
      
      <div class="modal-overlay" id="launchModal">
        <div class="modal">
          <h2>🚀 Launch LTI Tool</h2>
          <p style="font-size: 13px; color: #666; margin-bottom: 16px;">Launching as the logged-in user:</p>
          <div id="launchUserInfo" style="background: #e8f4fd; padding: 10px; border-radius: 4px; margin-bottom: 16px; font-size: 13px;"></div>
          
          <form method="POST" action="/lti/login" id="launchForm">
            <input type="hidden" name="iss" value="${config.platform.issuer}">
            <input type="hidden" name="target_link_uri" value="${config.platform.target_link_uri}">
            <input type="hidden" name="lti_message_hint" value="course-${req.params.courseId}-tool-${tool}">
            <input type="hidden" name="client_id" value="${config.platform.client_id}">
            <input type="hidden" name="login_hint" id="f_login_hint">
            <input type="hidden" name="given_name" id="f_given_name">
            <input type="hidden" name="family_name" id="f_family_name">
            <input type="hidden" name="email" id="f_email">
            <input type="hidden" name="role" id="f_role">
            
            <div class="actions">
              <button type="button" class="btn btn-cancel" onclick="document.getElementById('launchModal').classList.remove('active')">Cancel</button>
              <button type="submit" class="btn btn-launch">Launch Tool</button>
            </div>
          </form>
        </div>
      </div>

      <div class="modal-overlay" id="loginModal">
        <div class="modal">
          <h2>🔐 Log In to LMS</h2>
          <p style="font-size: 13px; color: #666; margin-bottom: 16px;">Enter your user information. This will be used for all LTI launches in this session.</p>
          <button type="button" class="btn btn-cancel" onclick="generateUser()" style="margin-bottom: 12px; font-size: 12px;">🎲 Generate Random User</button>
          
          <form id="loginForm">
            <label>Username</label>
            <input type="text" id="login_hint" placeholder="e.g. jsmith" required>
            
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
              <div>
                <label>Given Name</label>
                <input type="text" id="given_name" placeholder="e.g. John" required>
              </div>
              <div>
                <label>Family Name</label>
                <input type="text" id="family_name" placeholder="e.g. Smith" required>
              </div>
            </div>
            
            <label>Email</label>
            <input type="email" id="email" placeholder="e.g. jsmith@university.edu" required>
            
            <label>Role</label>
            <select id="role">
              <option value="Learner">Learner</option>
              <option value="Instructor">Instructor</option>
              <option value="Administrator">Administrator</option>
              <option value="TeachingAssistant">Teaching Assistant</option>
            </select>
            
            <div class="actions">
              <button type="submit" class="btn btn-launch" id="loginBtn" disabled style="opacity: 0.5; cursor: not-allowed;">Log In</button>
            </div>
          </form>
        </div>
      </div>
      
      <script>
        var loginForm = document.getElementById('loginForm');
        var loginBtn = document.getElementById('loginBtn');
        var loginFields = loginForm.querySelectorAll('input[required]');
        
        function checkLoginFields() {
          var allFilled = true;
          for (var i = 0; i < loginFields.length; i++) {
            if (!loginFields[i].value.trim()) { allFilled = false; break; }
          }
          loginBtn.disabled = !allFilled;
          loginBtn.style.opacity = allFilled ? '1' : '0.5';
          loginBtn.style.cursor = allFilled ? 'pointer' : 'not-allowed';
        }
        
        for (var i = 0; i < loginFields.length; i++) {
          loginFields[i].addEventListener('input', checkLoginFields);
        }

        loginForm.addEventListener('submit', function(e) {
          e.preventDefault();
          var user = {
            login_hint: document.getElementById('login_hint').value,
            given_name: document.getElementById('given_name').value,
            family_name: document.getElementById('family_name').value,
            email: document.getElementById('email').value,
            role: document.getElementById('role').value
          };
          localStorage.setItem('lms_user', JSON.stringify(user));
          document.getElementById('loginModal').classList.remove('active');
          updateUserDisplay();
        });
        
        function generateUser() {
          var firstNames = ['Alex', 'Jordan', 'Taylor', 'Morgan', 'Casey', 'Riley', 'Quinn', 'Avery', 'Cameron', 'Dakota'];
          var lastNames = ['Anderson', 'Chen', 'Garcia', 'Kim', 'Patel', 'Williams', 'Brown', 'Martinez', 'Johnson', 'Lee'];
          var roles = ['Learner', 'Instructor', 'Administrator', 'TeachingAssistant'];
          var first = firstNames[Math.floor(Math.random() * firstNames.length)];
          var last = lastNames[Math.floor(Math.random() * lastNames.length)];
          var username = (first[0] + last).toLowerCase();
          document.getElementById('login_hint').value = username;
          document.getElementById('given_name').value = first;
          document.getElementById('family_name').value = last;
          document.getElementById('email').value = username + '@university.edu';
          document.getElementById('role').value = roles[Math.floor(Math.random() * roles.length)];
          checkLoginFields();
        }

        function updateUserDisplay() {
          var user = JSON.parse(localStorage.getItem('lms_user') || 'null');
          if (user) {
            document.getElementById('userBanner').innerHTML = '👤 Logged in as: <strong>' + user.given_name + ' ' + user.family_name + '</strong> (' + user.login_hint + ') — ' + user.role + ' <a href="#" onclick="logout(); return false;" style="margin-left: 10px; font-size: 12px;">Switch User</a>';
            document.getElementById('userBanner').style.display = 'block';
          }
        }

        function logout() {
          localStorage.removeItem('lms_user');
          document.getElementById('loginModal').classList.add('active');
          document.getElementById('userBanner').style.display = 'none';
        }

        function openLaunchModal() {
          var user = JSON.parse(localStorage.getItem('lms_user') || 'null');
          if (!user) {
            document.getElementById('loginModal').classList.add('active');
            return;
          }
          document.getElementById('f_login_hint').value = user.login_hint;
          document.getElementById('f_given_name').value = user.given_name;
          document.getElementById('f_family_name').value = user.family_name;
          document.getElementById('f_email').value = user.email;
          document.getElementById('f_role').value = user.role;
          document.getElementById('launchUserInfo').innerHTML = '👤 <strong>' + user.given_name + ' ' + user.family_name + '</strong> (' + user.login_hint + ') — ' + user.role;
          document.getElementById('launchModal').classList.add('active');
        }

        // On page load: show login modal if no user stored
        (function() {
          var user = JSON.parse(localStorage.getItem('lms_user') || 'null');
          if (!user) {
            document.getElementById('loginModal').classList.add('active');
          } else {
            updateUserDisplay();
          }
        })();
      </script>
    </body>
    </html>
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
    login_hint: req.body.login_hint || 'anonymous',
    lti_message_hint: req.body.lti_message_hint,
    client_id: req.body.client_id,
    target_link_uri: req.body.target_link_uri,
    given_name: req.body.given_name || '',
    family_name: req.body.family_name || '',
    email: req.body.email || '',
    role: req.body.role || 'Learner'
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
  
  // Validate redirect_uri against registered tool redirect URIs
  if (!config.tool.redirect_uris.includes(redirect_uri)) {
    logger.error('Invalid redirect_uri - not registered:', redirect_uri);
    return res.status(400).send('Invalid redirect_uri - not registered for this client');
  }

  // Validate client_id matches registered tool
  if (client_id !== config.platform.client_id) {
    logger.error('Invalid client_id:', client_id);
    return res.status(400).send('Invalid client_id');
  }

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
  
  // Look up deep link item if launching one
  let deepLinkItem = null;
  if (session.lti_message_hint?.startsWith('deeplink-')) {
    const dlItemId = session.lti_message_hint.replace('deeplink-', '');
    deepLinkItem = req.app.locals.deepLinkItems?.get(dlItemId) || null;
  }

  const isResourceLink = session.lti_message_hint?.startsWith('deeplink-') || session.lti_message_hint?.startsWith('coursetool-');

  const roleMap = {
    'Learner': 'http://purl.imsglobal.org/vocab/lis/v2/membership#Learner',
    'Instructor': 'http://purl.imsglobal.org/vocab/lis/v2/membership#Instructor',
    'Administrator': 'http://purl.imsglobal.org/vocab/lis/v2/system/person#Administrator',
    'TeachingAssistant': 'http://purl.imsglobal.org/vocab/lis/v2/membership#TeachingAssistant'
  };

  const payload = {
    iss: config.platform.issuer,
    aud: config.platform.client_id,
    sub: 'bd3b4befae4e45f28ba652395e43d354',
    exp: Math.floor(Date.now() / 1000) + 3600,
    iat: Math.floor(Date.now() / 1000),
    nonce,
    email: session.email,
    given_name: session.given_name,
    family_name: session.family_name,
    name: `${session.given_name} ${session.family_name}`,
    locale: 'en-US',
    'https://purl.imsglobal.org/spec/lti/claim/message_type': isResourceLink ? 'LtiResourceLinkRequest' : 'LtiDeepLinkingRequest',
    'https://purl.imsglobal.org/spec/lti/claim/version': '1.3.0',
    'https://purl.imsglobal.org/spec/lti/claim/deployment_id': config.platform.deployment_id,
    'https://purl.imsglobal.org/spec/lti/claim/target_link_uri': session.target_link_uri,
    'https://purl.imsglobal.org/spec/lti/claim/roles': [
      roleMap[session.role] || roleMap['Learner']
    ],
    'https://purl.imsglobal.org/spec/lti/claim/custom': isResourceLink ? {
      route: deepLinkItem?.lineItem ? 'grades' : 'launch',
      caliper_profile_url: `${config.platform.issuer}/learn/api/v1/telemetry/caliper/profile`,
      caliper_federated_session_id: 'https://caliper-mapping.cloudbb.blackboard.com/v1/sites/9970f70e-7ebb-4f87-b372-06d5c2d26cbd/sessions/02ABAC7AC7E7B601BFC8B5D09D99E9CA',
      demo: 'true',
      contentType: 'ltiResourceLink',
      ...(deepLinkItem?.lineItem ? { lineItemId: deepLinkItem.lineItem } : {})
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
      context_memberships_url: `${config.platform.issuer}/lti/nrps/3d536dd2cf504f31b94d3670706a98a4/memberships`,
      service_versions: ['2.0']
    },
    'https://purl.imsglobal.org/spec/lti-ags/claim/endpoint': {
      scope: isResourceLink ? 
        ['https://purl.imsglobal.org/spec/lti-ags/scope/lineitem', 'https://purl.imsglobal.org/spec/lti-ags/scope/result.readonly', 'https://purl.imsglobal.org/spec/lti-ags/scope/score', 'https://purl.imsglobal.org/spec/lti-ags/scope/lineitem.readonly'] :
        ['https://purl.imsglobal.org/spec/lti-ags/scope/lineitem', 'https://purl.imsglobal.org/spec/lti-ags/scope/result.readonly', 'https://purl.imsglobal.org/spec/lti-ags/scope/score'],
      lineitems: `${config.platform.issuer}/lti/ags/3d536dd2cf504f31b94d3670706a98a4/lineitems`,
      ...(deepLinkItem?.lineItem ? { lineitem: deepLinkItem.lineItem } : {})
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
    ...(isResourceLink ? {
      'https://purl.imsglobal.org/spec/lti/claim/resource_link': {
        id: session.lti_message_hint?.startsWith('coursetool-') ? '_3760_1' : (session.lti_message_hint?.replace('deeplink-', '') || '_3760_1'),
        title: session.lti_message_hint?.startsWith('coursetool-') ? 'Demo Course Tool' : (deepLinkItem?.title || 'LTI Resource')
      },
      'https://purl.imsglobal.org/spec/lti/claim/lis': {
        person_sourcedid: session.login_hint,
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

// OAuth 2.0 Client Credentials Token endpoint (for AGS/NRPS service calls)
const validServiceTokens = new Set();

router.post('/learn/api/public/v1/oauth2/token', (req, res) => {
  const { grant_type, client_id, client_secret, scope } = req.body;

  logger.info('🔑 OAuth Client Credentials Token Request');
  logger.log('   Grant Type:', grant_type);
  logger.log('   Client ID:', client_id);
  logger.log('   Scope:', scope);

  if (grant_type !== 'client_credentials') {
    return res.status(400).json({ error: 'unsupported_grant_type' });
  }

  if (client_id !== config.platform.client_id) {
    return res.status(401).json({ error: 'invalid_client' });
  }

  // Generate service access token
  const accessToken = 'lti_service_' + Math.random().toString(36).substr(2, 16);
  validServiceTokens.add(accessToken);

  // Expire token after 1 hour
  setTimeout(() => validServiceTokens.delete(accessToken), 3600000);

  logger.success('✅ Service token issued');
  res.json({
    access_token: accessToken,
    token_type: 'Bearer',
    expires_in: 3600,
    scope: scope || 'https://purl.imsglobal.org/spec/lti-ags/scope/lineitem https://purl.imsglobal.org/spec/lti-ags/scope/score https://purl.imsglobal.org/spec/lti-nrps/scope/contextmembership.readonly'
  });
});

// Middleware to validate service bearer tokens on LTI Advantage endpoints
function validateServiceToken(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) {
    logger.error('❌ Missing or invalid Authorization header');
    return res.status(401).json({ error: 'Missing Bearer token. Obtain one via POST /learn/api/public/v1/oauth2/token with client_credentials grant.' });
  }
  const token = auth.replace('Bearer ', '');
  if (!validServiceTokens.has(token)) {
    logger.error('❌ Invalid or expired service token');
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
  next();
}

// Mock NRPS endpoint
router.get('/lti/nrps/:contextId/memberships', validateServiceToken, (req, res) => {
  logger.info('👥 NRPS Membership Request');
  logger.log('   Context ID:', req.params.contextId);
  logger.log('   Returning 4 members');
  
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
let contentItemCounter = 3760;

// Get all line items
router.get('/lti/ags/:contextId/lineitems', validateServiceToken, (req, res) => {
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
router.post('/lti/ags/:contextId/lineitems', validateServiceToken, (req, res) => {
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

  // Also create a content item on the course page (mirrors real LMS behavior)
  if (!req.app.locals.deepLinkItems) {
    req.app.locals.deepLinkItems = new Map();
  }
  const itemId = `_${++contentItemCounter}_1`;
  req.app.locals.deepLinkItems.set(itemId, {
    type: 'ltiResourceLink',
    title: req.body.label,
    text: `Assignment (max score: ${req.body.scoreMaximum})`,
    url: config.tool.redirect_uris[0],
    lineItem: newItem.id
  });
  logger.success(`✅ Content item created on course page: ${req.body.label}`);

  res.status(201).json(newItem);
});

// Get specific line item
router.get('/lti/ags/:contextId/lineitems/:lineItemId', validateServiceToken, (req, res) => {
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
router.put('/lti/ags/:contextId/lineitems/:lineItemId', validateServiceToken, (req, res) => {
  logger.info('✏️ AGS Update Line Item');
  logger.log('   Context ID:', req.params.contextId);
  logger.log('   Line Item ID:', req.params.lineItemId);
  logger.log('   Updates:', JSON.stringify(req.body));
  
  const index = mockLineItems.findIndex(item => item.id.endsWith(req.params.lineItemId));
  if (index === -1) {
    logger.error('❌ Line item not found');
    return res.status(404).json({ error: 'Line item not found' });
  }
  
  mockLineItems[index] = { ...mockLineItems[index], ...req.body };
  logger.success(`✅ Line item updated: ${mockLineItems[index].label}`);
  res.json(mockLineItems[index]);
});

// Delete line item
router.delete('/lti/ags/:contextId/lineitems/:lineItemId', validateServiceToken, (req, res) => {
  logger.info('🗑️ AGS Delete Line Item');
  logger.log('   Context ID:', req.params.contextId);
  logger.log('   Line Item ID:', req.params.lineItemId);
  
  const index = mockLineItems.findIndex(item => item.id.endsWith(req.params.lineItemId));
  if (index === -1) {
    logger.error('❌ Line item not found');
    return res.status(404).json({ error: 'Line item not found' });
  }
  
  logger.success(`✅ Line item deleted: ${mockLineItems[index].label}`);
  mockLineItems.splice(index, 1);
  res.status(204).send();
});

// Submit score
router.post('/lti/ags/:contextId/lineitems/:lineItemId/scores', validateServiceToken, (req, res) => {
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
router.get('/lti/ags/:contextId/lineitems/:lineItemId/results', validateServiceToken, (req, res) => {
  const { limit = 10, userId } = req.query;
  
  logger.info('📋 AGS Results Request');
  logger.log('   Context ID:', req.params.contextId);
  logger.log('   Line Item ID:', req.params.lineItemId);
  logger.log('   User filter:', userId || 'all');
  
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
  
  logger.success(`✅ Returning ${results.length} results`);
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
      const itemId = `_${++contentItemCounter}_1`;
      req.app.locals.deepLinkItems.set(itemId, item);
      itemIds.push(itemId);
    });
    
    // Store items and redirect back to course page
    res.redirect('/lms/course/123/launch?tool=demo&dl_success=true');
    
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
module.exports.getLineItems = () => mockLineItems;