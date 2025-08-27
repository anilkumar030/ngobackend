const axios = require('axios');

async function testPublicAccess() {
  console.log('🧪 Testing Public Access to Campaign Updates\n');
  
  const API_URL = 'http://localhost:8090/api';
  const campaignId = '7f34e1d7-ba85-42fc-9278-24976f318432';
  
  try {
    console.log('1️⃣ Testing GET /campaigns/:id/updates (should be public)...');
    const response = await axios.get(`${API_URL}/campaigns/${campaignId}/updates`, {
      timeout: 5000
    });
    
    console.log('✅ SUCCESS! Public access works');
    console.log(`   Status: ${response.status}`);
    console.log(`   Updates found: ${response.data.data.updates.length}`);
    
  } catch (error) {
    console.log('❌ FAILED! Public access blocked');
    console.log(`   Status: ${error.response?.status}`);
    console.log(`   Error: ${error.response?.data?.message || error.message}`);
    
    // Let's test with authorization token
    console.log('\n2️⃣ Testing with authorization token...');
    try {
      const authResponse = await axios.get(`${API_URL}/campaigns/${campaignId}/updates`, {
        headers: {
          'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2ZWRhMWE2ZC02NzI4LTRkOWMtYWM5ZC0wZTVhMDcyNmE0OTAiLCJlbWFpbCI6ImFkbWluQHNoaXZkaGFhbS5vcmciLCJyb2xlIjoic3VwZXJfYWRtaW4iLCJ0eXBlIjoiYWNjZXNzIiwiaWF0IjoxNzU1MjY0NzI1LCJleHAiOjE3NTUzNTExMjV9.l6QxSeXx_kNc6BcLnIedZWLRKABt3bMSOCkASl3NpyE'
        }
      });
      
      console.log('✅ WITH TOKEN: Success!');
      console.log(`   Status: ${authResponse.status}`);
      console.log(`   Updates found: ${authResponse.data.data.updates.length}`);
      
      console.log('\n🔍 This confirms the endpoint works but requires authentication');
      console.log('🐛 The optionalAuth middleware is not working correctly');
      
    } catch (authError) {
      console.log('❌ WITH TOKEN: Also failed');
      console.log(`   Status: ${authError.response?.status}`);
      console.log(`   Error: ${authError.response?.data?.message || authError.message}`);
    }
  }
}

testPublicAccess();