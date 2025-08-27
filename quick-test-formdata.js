const axios = require('axios');
const FormData = require('form-data');

async function quickTest() {
  console.log('🔍 Quick FormData Test');
  
  try {
    // First, get auth token
    const loginResponse = await axios.post('http://localhost:5000/api/auth/login', {
      email: 'admin@shivdhaam.org',
      password: 'Admin@123'
    });
    
    const token = loginResponse.data.data.accessToken;
    console.log('✅ Got auth token');
    
    // Test FormData submission
    const formData = new FormData();
    formData.append('title', 'FormData Test Campaign');
    formData.append('slug', 'formdata-test-campaign-' + Date.now());
    formData.append('description', 'This is a test campaign to verify FormData functionality is working correctly.');
    formData.append('short_description', 'Quick FormData test campaign');
    formData.append('category', 'education');
    formData.append('target_amount', '5000');
    formData.append('start_date', new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString());
    formData.append('end_date', new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString());
    
    const response = await axios.post('http://localhost:5000/api/campaigns', formData, {
      headers: {
        'Authorization': `Bearer ${token}`,
        ...formData.getHeaders()
      }
    });
    
    console.log('✅ FormData campaign created successfully!');
    console.log('📊 Campaign ID:', response.data.data.campaign.id);
    console.log('📊 Campaign Title:', response.data.data.campaign.title);
    console.log('📊 Campaign Slug:', response.data.data.campaign.slug);
    
  } catch (error) {
    console.error('❌ Test failed:', {
      status: error.response?.status,
      message: error.response?.data?.message || error.message,
      errors: error.response?.data?.errors
    });
  }
}

quickTest();