// Simple test to verify the LTI flow works
const http = require('http');

async function testLaunch() {
  console.log('Testing LTI 1.3 Mock Environment...\n');
  
  // Test platform JWKS
  try {
    const response = await fetch('http://localhost:3000/.well-known/jwks.json');
    const jwks = await response.json();
    console.log('✓ Platform JWKS endpoint working');
  } catch (error) {
    console.log('✗ Platform not running. Start with: npm run lms');
    return;
  }
  
  // Test tool JWKS  
  try {
    const response = await fetch('http://localhost:3001/.well-known/jwks.json');
    const jwks = await response.json();
    console.log('✓ Tool JWKS endpoint working');
  } catch (error) {
    console.log('✗ Tool not running. Start with: npm run tool');
    return;
  }
  
  console.log('\n🚀 Environment ready!');
  console.log('Visit: http://localhost:3000/lms/course/123/launch?tool=demo');
}

testLaunch();