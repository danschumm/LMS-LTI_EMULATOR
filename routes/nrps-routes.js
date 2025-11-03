const express = require('express');
const router = express.Router();

// NRPS Users and Roles display
router.get('/nrps', async (req, res) => {
  try {
    // Get LTI session to extract NRPS URL
    const sessionId = req.query.session;
    if (!sessionId) {
      return res.status(400).send('Missing session parameter');
    }

    console.log('NRPS Debug - Session ID:', sessionId);
    console.log('NRPS Debug - Available sessions:', Array.from(req.app.locals.ltiSessions.keys()));
    
    const session = req.app.locals.ltiSessions.get(sessionId);
    if (!session) {
      return res.status(400).send(`Invalid session. Available sessions: ${Array.from(req.app.locals.ltiSessions.keys()).join(', ')}`);
    }

    const nrpsUrl = session.claims['https://purl.imsglobal.org/spec/lti-nrps/claim/namesroleservice']?.context_memberships_url;
    if (!nrpsUrl) {
      return res.status(400).send('NRPS not available for this launch');
    }

    // Handle both URL formats - convert Blackboard-style URL to our mock endpoint
    let membershipUrl = nrpsUrl;
    if (membershipUrl.includes('/learn/api/v1/lti/external/namesandroles/')) {
      membershipUrl = membershipUrl.replace('/learn/api/v1/lti/external/namesandroles/_612_1', '/lti/nrps/3d536dd2cf504f31b94d3670706a98a4/memberships');
    }

    // Fetch membership data from platform
    const response = await fetch(membershipUrl);
    const membershipData = await response.json();

    const roleLabels = {
      'http://purl.imsglobal.org/vocab/lis/v2/membership#Instructor': 'Instructor',
      'http://purl.imsglobal.org/vocab/lis/v2/membership#Learner': 'Student',
      'http://purl.imsglobal.org/vocab/lis/v2/membership#TeachingAssistant': 'Teaching Assistant'
    };

    res.send(`
      <h1>Course Membership</h1>
      <div style="background: #f8f9fa; padding: 15px; margin: 10px 0; border-radius: 5px;">
        <h2>${membershipData.context.title}</h2>
        <p><strong>Course:</strong> ${membershipData.context.label}</p>
        <p><strong>Context ID:</strong> ${membershipData.context.id}</p>
      </div>

      <h2>Members (${membershipData.members.length})</h2>
      <div style="display: grid; gap: 15px;">
        ${membershipData.members.map(member => `
          <div style="border: 1px solid #dee2e6; padding: 15px; border-radius: 8px; background: white;">
            <div style="display: flex; align-items: center; gap: 15px;">
              <img src="${member.picture}" alt="${member.name}" style="width: 40px; height: 40px; border-radius: 50%;">
              <div style="flex: 1;">
                <h3 style="margin: 0; color: #495057;">${member.name}</h3>
                <p style="margin: 5px 0; color: #6c757d;">${member.email}</p>
                <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                  ${member.roles.map(role => `
                    <span style="background: ${role.includes('Instructor') ? '#007bff' : role.includes('TeachingAssistant') ? '#6f42c1' : '#28a745'}; 
                                 color: white; padding: 4px 8px; border-radius: 12px; font-size: 12px;">
                      ${roleLabels[role] || role.split('#').pop()}
                    </span>
                  `).join('')}
                </div>
              </div>
              <div style="text-align: right; color: #6c757d;">
                <small>Status: ${member.status}</small><br>
                <small>ID: ${member.user_id}</small>
              </div>
            </div>
          </div>
        `).join('')}
      </div>

      <div style="margin: 20px 0; padding: 15px; background: #e9ecef; border-radius: 5px;">
        <h3>NRPS Service Details</h3>
        <p><strong>Service URL:</strong> <code>${nrpsUrl}</code></p>
        <p><strong>Service Version:</strong> 2.0</p>
        <p><strong>Total Members:</strong> ${membershipData.members.length}</p>
      </div>

      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 15px; margin: 20px 0;">
        <div style="background: white; padding: 15px; border-radius: 8px; border: 1px solid #dee2e6;">
          <h3>📊 Quick Analytics</h3>
          <p><strong>Instructors:</strong> ${membershipData.members.filter(m => m.roles.some(r => r.includes('Instructor'))).length}</p>
          <p><strong>Students:</strong> ${membershipData.members.filter(m => m.roles.some(r => r.includes('Learner'))).length}</p>
          <p><strong>TAs:</strong> ${membershipData.members.filter(m => m.roles.some(r => r.includes('TeachingAssistant'))).length}</p>
        </div>
        
        <div style="background: white; padding: 15px; border-radius: 8px; border: 1px solid #dee2e6;">
          <h3>👥 Group Formation</h3>
          <button onclick="createRandomGroups()" style="padding: 8px 16px; background: #28a745; color: white; border: none; border-radius: 4px; margin: 5px;">Random Groups</button>
          <button onclick="createRoleGroups()" style="padding: 8px 16px; background: #17a2b8; color: white; border: none; border-radius: 4px; margin: 5px;">By Role</button>
        </div>
        
        <div style="background: white; padding: 15px; border-radius: 8px; border: 1px solid #dee2e6;">
          <h3>✅ Attendance</h3>
          <button onclick="takeAttendance()" style="padding: 8px 16px; background: #6f42c1; color: white; border: none; border-radius: 4px; margin: 5px;">Take Attendance</button>
          <button onclick="viewAttendance()" style="padding: 8px 16px; background: #fd7e14; color: white; border: none; border-radius: 4px; margin: 5px;">View Records</button>
        </div>
      </div>

      <div id="demoResults" style="margin: 20px 0;"></div>

      <script>
      const members = ${JSON.stringify(membershipData.members)};
      
      function createRandomGroups() {
        const students = members.filter(m => m.roles.some(r => r.includes('Learner')));
        const groups = [];
        const groupSize = 2;
        
        for (let i = 0; i < students.length; i += groupSize) {
          groups.push(students.slice(i, i + groupSize));
        }
        
        document.getElementById('demoResults').innerHTML = 
          '<h3>🎲 Random Study Groups</h3>' +
          groups.map((group, i) => 
            '<div style="background: #f8f9fa; padding: 10px; margin: 5px 0; border-radius: 5px;">' +
            '<strong>Group ' + (i + 1) + ':</strong> ' +
            group.map(m => m.name).join(', ') +
            '</div>'
          ).join('');
      }
      
      function createRoleGroups() {
        const instructors = members.filter(m => m.roles.some(r => r.includes('Instructor')));
        const tas = members.filter(m => m.roles.some(r => r.includes('TeachingAssistant')));
        const students = members.filter(m => m.roles.some(r => r.includes('Learner')));
        
        document.getElementById('demoResults').innerHTML = 
          '<h3>👨‍🏫 Role-Based Groups</h3>' +
          '<div style="background: #e3f2fd; padding: 10px; margin: 5px 0; border-radius: 5px;">' +
          '<strong>Teaching Staff:</strong> ' + [...instructors, ...tas].map(m => m.name).join(', ') +
          '</div>' +
          '<div style="background: #e8f5e8; padding: 10px; margin: 5px 0; border-radius: 5px;">' +
          '<strong>Students:</strong> ' + students.map(m => m.name).join(', ') +
          '</div>';
      }
      
      function takeAttendance() {
        const present = members.filter(() => Math.random() > 0.2); // 80% attendance rate
        const absent = members.filter(m => !present.includes(m));
        
        document.getElementById('demoResults').innerHTML = 
          '<h3>📋 Attendance - ' + new Date().toLocaleDateString() + '</h3>' +
          '<div style="background: #d4edda; padding: 10px; margin: 5px 0; border-radius: 5px;">' +
          '<strong>Present (' + present.length + '):</strong> ' + present.map(m => m.name).join(', ') +
          '</div>' +
          (absent.length > 0 ? 
            '<div style="background: #f8d7da; padding: 10px; margin: 5px 0; border-radius: 5px;">' +
            '<strong>Absent (' + absent.length + '):</strong> ' + absent.map(m => m.name).join(', ') +
            '</div>' : '');
      }
      
      function viewAttendance() {
        const mockData = members.map(m => ({
          name: m.name,
          present: Math.floor(Math.random() * 15) + 10, // 10-24 classes
          total: 25
        }));
        
        document.getElementById('demoResults').innerHTML = 
          '<h3>📈 Attendance Summary</h3>' +
          '<div style="display: grid; gap: 8px;">' +
          mockData.map(m => 
            '<div style="background: white; padding: 8px; border: 1px solid #dee2e6; border-radius: 4px; display: flex; justify-content: space-between;">' +
            '<span>' + m.name + '</span>' +
            '<span style="color: ' + (m.present/m.total > 0.8 ? '#28a745' : m.present/m.total > 0.6 ? '#ffc107' : '#dc3545') + ';">' +
            m.present + '/' + m.total + ' (' + Math.round(m.present/m.total*100) + '%)</span>' +
            '</div>'
          ).join('') +
          '</div>';
      }
      </script>

      <a href="javascript:history.back()" style="padding: 10px 20px; background: #007bff; color: white; text-decoration: none; border-radius: 5px;">
        ← Back to Tool
      </a>
    `);

  } catch (error) {
    res.status(500).send(`
      <h1>NRPS Error</h1>
      <p>Error fetching membership data: ${error.message}</p>
      <a href="javascript:history.back()">← Back</a>
    `);
  }
});

module.exports = router;