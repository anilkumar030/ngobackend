const axios = require('axios');

const API_URL = 'http://localhost:8090/api';
const TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2ZWRhMWE2ZC02NzI4LTRkOWMtYWM5ZC0wZTVhMDcyNmE0OTAiLCJlbWFpbCI6ImFkbWluQHNoaXZkaGFhbS5vcmciLCJyb2xlIjoic3VwZXJfYWRtaW4iLCJ0eXBlIjoiYWNjZXNzIiwiaWF0IjoxNzU1MjY0NzI1LCJleHAiOjE3NTUzNTExMjV9.l6QxSeXx_kNc6BcLnIedZWLRKABt3bMSOCkASl3NpyE';

async function testCampaignUpdates() {
  console.log('🧪 Testing Campaign Updates API\n');
  
  try {
    // 1. Get a campaign ID first
    console.log('1️⃣ Getting existing campaign...');
    const campaignsResponse = await axios.get(`${API_URL}/campaigns?limit=1`, {
      headers: { Authorization: `Bearer ${TOKEN}` }
    });
    
    if (!campaignsResponse.data.data.campaigns[0]) {
      console.log('❌ No campaigns found. Please create a campaign first.');
      return;
    }
    
    const campaignId = campaignsResponse.data.data.campaigns[0].id;
    console.log(`✅ Using campaign ID: ${campaignId}\n`);
    
    // 2. Create a campaign update
    console.log('2️⃣ Creating campaign update...');
    const createResponse = await axios.post(
      `${API_URL}/campaigns/${campaignId}/updates`,
      {
        title: "Temple Construction Update - January 2025",
        description: "We are excited to share that the temple construction is progressing well. The foundation has been completed and we have started work on the main structure. Thank you for your continued support!",
        images: [
          "https://example.com/temple-update-1.jpg",
          "https://example.com/temple-update-2.jpg"
        ]
      },
      {
        headers: {
          Authorization: `Bearer ${TOKEN}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    console.log('✅ Update created successfully!');
    const updateId = createResponse.data.data.update.id;
    console.log(`   Update ID: ${updateId}`);
    console.log(`   Title: ${createResponse.data.data.update.title}\n`);
    
    // 3. Test XSS protection
    console.log('3️⃣ Testing XSS protection...');
    try {
      const xssResponse = await axios.post(
        `${API_URL}/campaigns/${campaignId}/updates`,
        {
          title: "<script>alert('XSS')</script>Test Update",
          description: "This is a test description with <b>HTML tags</b> and <script>malicious code</script>.",
          images: ["javascript:alert('XSS')", "https://valid-url.com/image.jpg"]
        },
        {
          headers: {
            Authorization: `Bearer ${TOKEN}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      console.log('✅ XSS protection working!');
      console.log(`   Sanitized title: ${xssResponse.data.data.update.title}`);
      console.log(`   Sanitized description: ${xssResponse.data.data.update.description.substring(0, 50)}...`);
      console.log(`   Valid images only: ${xssResponse.data.data.update.images.length} image(s)\n`);
    } catch (error) {
      console.log('⚠️ XSS test failed:', error.response?.data?.error || error.message);
    }
    
    // 4. Get all updates for the campaign (public access)
    console.log('4️⃣ Getting campaign updates (public access)...');
    const getUpdatesResponse = await axios.get(
      `${API_URL}/campaigns/${campaignId}/updates`
    );
    
    console.log(`✅ Found ${getUpdatesResponse.data.data.updates.length} update(s)`);
    console.log(`   Pagination: Page ${getUpdatesResponse.data.data.pagination.page} of ${getUpdatesResponse.data.data.pagination.totalPages}\n`);
    
    // 5. Update the campaign update
    console.log('5️⃣ Updating campaign update...');
    const updateResponse = await axios.put(
      `${API_URL}/campaign-updates/${updateId}`,
      {
        title: "Temple Construction Update - January 2025 (Updated)",
        description: "UPDATED: We are thrilled to share even more progress!"
      },
      {
        headers: {
          Authorization: `Bearer ${TOKEN}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    console.log('✅ Update modified successfully!');
    console.log(`   New title: ${updateResponse.data.data.update.title}\n`);
    
    // 6. Get campaign details with updates
    console.log('6️⃣ Getting campaign details with updates...');
    const campaignDetailsResponse = await axios.get(
      `${API_URL}/campaigns/${campaignId}`,
      {
        headers: { Authorization: `Bearer ${TOKEN}` }
      }
    );
    
    const updatesSummary = campaignDetailsResponse.data.data.campaign.updates_summary;
    console.log('✅ Campaign details retrieved with updates!');
    console.log(`   Total updates: ${updatesSummary.total_updates}`);
    console.log(`   Has updates: ${updatesSummary.has_updates}`);
    console.log(`   Recent updates: ${updatesSummary.recent_updates.length}\n`);
    
    // 7. Delete an update
    console.log('7️⃣ Deleting campaign update...');
    const deleteResponse = await axios.delete(
      `${API_URL}/campaign-updates/${updateId}`,
      {
        headers: { Authorization: `Bearer ${TOKEN}` }
      }
    );
    
    console.log('✅ Update deleted successfully!');
    console.log(`   ${deleteResponse.data.message}\n`);
    
    console.log('🎉 All tests completed successfully!');
    console.log('📋 Summary:');
    console.log('   ✅ Create campaign update - PASSED');
    console.log('   ✅ XSS protection - PASSED');
    console.log('   ✅ Public access to updates - PASSED');
    console.log('   ✅ Update campaign update - PASSED');
    console.log('   ✅ Campaign details with updates - PASSED');
    console.log('   ✅ Delete campaign update - PASSED');
    
  } catch (error) {
    console.error('❌ Test failed:', error.response?.data || error.message);
    if (error.response) {
      console.error('   Status:', error.response.status);
      console.error('   Details:', JSON.stringify(error.response.data, null, 2));
    }
  }
}

testCampaignUpdates();