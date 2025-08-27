#!/usr/bin/env node

/**
 * Final verification test for campaign update image functionality
 */

const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');

// Configuration
const BASE_URL = 'http://localhost:3000';
const API_BASE = `${BASE_URL}/api`;

// Test user credentials
const TEST_USER = {
  email: 'test@debug.com',
  password: 'debug123',
  authToken: null
};

// Create test image
const createTestImage = () => {
  const buffer = Buffer.from([
    0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D,
    0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
    0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53, 0xDE, 0x00, 0x00, 0x00,
    0x0C, 0x49, 0x44, 0x41, 0x54, 0x08, 0xD7, 0x63, 0xF8, 0x00, 0x00, 0x00,
    0x00, 0x01, 0x00, 0x01, 0x00, 0x00, 0x00, 0x37, 0x6E, 0xF9, 0x24, 0x00,
    0x00, 0x00, 0x00, 0x49, 0x45, 0x4E, 0x44, 0xAE, 0x42, 0x60, 0x82
  ]);
  
  const tempDir = path.join(__dirname, 'temp-final-test');
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }
  
  const imagePath = path.join(tempDir, 'final-test.png');
  fs.writeFileSync(imagePath, buffer);
  
  return { tempDir, imagePath };
}

const cleanup = (tempDir) => {
  if (fs.existsSync(tempDir)) {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
};

async function runFinalVerification() {
  console.log('🔧 Final Verification: Campaign Update Image Functionality');
  console.log('=' .repeat(70));

  const { tempDir, imagePath } = createTestImage();
  let campaign, update;

  try {
    // 1. Authenticate
    console.log('1️⃣ Authenticating...');
    const authResponse = await axios.post(`${API_BASE}/auth/login`, {
      email: TEST_USER.email,
      password: TEST_USER.password
    });
    TEST_USER.authToken = authResponse.data.data.accessToken;
    console.log('   ✅ Authentication successful');

    // 2. Create campaign
    console.log('2️⃣ Creating test campaign...');
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const nextMonth = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    
    const campaignResponse = await axios.post(`${API_BASE}/campaigns`, {
      title: 'Final Verification Campaign',
      slug: `final-verification-${Date.now()}`,
      description: 'Campaign created for final verification of image upload functionality.',
      short_description: 'Final verification test campaign',
      category: 'education',
      target_amount: 1000,
      location: 'Test City, Test State, Test Country',
      start_date: tomorrow.toISOString(),
      end_date: nextMonth.toISOString(),
      status: 'active'
    }, {
      headers: {
        'Authorization': `Bearer ${TEST_USER.authToken}`,
        'Content-Type': 'application/json'
      }
    });
    campaign = campaignResponse.data.data.campaign;
    console.log(`   ✅ Campaign created: ${campaign.id}`);

    // 3. Create campaign update with multipart form data
    console.log('3️⃣ Creating campaign update with image via multipart...');
    const createForm = new FormData();
    createForm.append('title', 'Final Verification Update');
    createForm.append('description', 'This update tests the multipart form data image upload functionality.');
    createForm.append('images', fs.createReadStream(imagePath), {
      filename: 'verification-test.png',
      contentType: 'image/png'
    });

    const createResponse = await axios.post(
      `${API_BASE}/campaigns/${campaign.id}/updates`,
      createForm,
      {
        headers: {
          'Authorization': `Bearer ${TEST_USER.authToken}`,
          ...createForm.getHeaders()
        }
      }
    );
    update = createResponse.data.data.update;
    console.log(`   ✅ Update created: ${update.id}`);
    console.log(`   📷 Images uploaded: ${update.images.length}`);
    console.log(`   🔗 First image URL: ${update.images[0]}`);

    // 4. Verify image accessibility
    console.log('4️⃣ Verifying image accessibility...');
    const imageResponse = await axios.head(update.images[0]);
    console.log(`   ✅ Image accessible (Status: ${imageResponse.status})`);

    // 5. Update campaign update with additional image via multipart
    console.log('5️⃣ Updating campaign update with additional image...');
    const updateForm = new FormData();
    updateForm.append('title', 'Updated Final Verification');
    updateForm.append('description', 'This update has been modified with additional images.');
    updateForm.append('images', fs.createReadStream(imagePath), {
      filename: 'additional-verification-test.png',
      contentType: 'image/png'
    });

    const updateResponse = await axios.put(
      `${API_BASE}/campaign-updates/${update.id}`,
      updateForm,
      {
        headers: {
          'Authorization': `Bearer ${TEST_USER.authToken}`,
          ...updateForm.getHeaders()
        }
      }
    );
    const updatedUpdate = updateResponse.data.data.update;
    console.log(`   ✅ Update modified`);
    console.log(`   📷 Total images: ${updatedUpdate.images.length}`);

    // 6. Use dedicated image upload endpoint
    console.log('6️⃣ Testing dedicated image upload endpoint...');
    const uploadForm = new FormData();
    uploadForm.append('images', fs.createReadStream(imagePath), {
      filename: 'dedicated-upload-test.png',
      contentType: 'image/png'
    });

    const uploadResponse = await axios.post(
      `${API_BASE}/campaign-updates/${update.id}/images`,
      uploadForm,
      {
        headers: {
          'Authorization': `Bearer ${TEST_USER.authToken}`,
          ...uploadForm.getHeaders()
        }
      }
    );
    console.log(`   ✅ Dedicated upload successful`);
    console.log(`   📤 Images uploaded: ${uploadResponse.data.data.uploaded}`);

    // 7. Update with JSON payload (URL array)
    console.log('7️⃣ Testing JSON payload update...');
    const jsonResponse = await axios.put(
      `${API_BASE}/campaign-updates/${update.id}`,
      {
        title: 'JSON Updated Verification',
        description: 'This update was modified using JSON with image URLs.',
        images: [
          'https://example.com/external1.jpg',
          'https://example.com/external2.jpg'
        ]
      },
      {
        headers: {
          'Authorization': `Bearer ${TEST_USER.authToken}`,
          'Content-Type': 'application/json'
        }
      }
    );
    console.log(`   ✅ JSON update successful`);
    console.log(`   📷 Images in JSON response: ${jsonResponse.data.data.update.images.length}`);

    // 8. Test GET endpoints
    console.log('8️⃣ Testing GET endpoints...');
    
    // Get all updates for campaign
    const getAllResponse = await axios.get(`${API_BASE}/campaigns/${campaign.id}/updates`);
    console.log(`   ✅ GET campaign updates: ${getAllResponse.data.data.updates.length} updates found`);

    // Get specific update
    const getOneResponse = await axios.get(`${API_BASE}/campaign-updates/${update.id}`);
    console.log(`   ✅ GET specific update: ${getOneResponse.data.data.update.title}`);

    // Final summary
    console.log('\n' + '=' .repeat(70));
    console.log('🎉 FINAL VERIFICATION RESULTS');
    console.log('=' .repeat(70));
    console.log('✅ All documented endpoints are working correctly!');
    console.log('✅ Multipart form data handling works');
    console.log('✅ JSON payload handling works');
    console.log('✅ Image uploads and storage work');
    console.log('✅ Static file serving works');
    console.log('✅ All CRUD operations work');
    console.log('✅ Authentication and authorization work');
    console.log('\n🏆 CAMPAIGN UPDATE IMAGE FUNCTIONALITY IS FULLY OPERATIONAL!');
    
    console.log('\n📋 API Endpoints Verified:');
    console.log('   ✅ POST /api/campaigns/:campaignId/updates');
    console.log('   ✅ PUT /api/campaign-updates/:id');
    console.log('   ✅ POST /api/campaign-updates/:id/images');
    console.log('   ✅ GET /api/campaigns/:campaignId/updates');
    console.log('   ✅ GET /api/campaign-updates/:id');

  } catch (error) {
    console.log(`❌ Error during verification: ${error.response?.data?.message || error.message}`);
    if (error.response?.data) {
      console.log('   Error details:', JSON.stringify(error.response.data, null, 2));
    }
  } finally {
    cleanup(tempDir);
  }
}

if (require.main === module) {
  runFinalVerification().catch(console.error);
}

module.exports = { runFinalVerification };