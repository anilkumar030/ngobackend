#!/usr/bin/env node

/**
 * Debug script for Campaign Update Image Upload Issues
 * 
 * This script tests the specific issues reported with multipart form data
 * for campaign updates and identifies the root causes.
 */

const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');

// Configuration
const BASE_URL = 'http://localhost:3000';
const API_BASE = `${BASE_URL}/api`;

// Test user credentials (you may need to update these)
const TEST_USER = {
  email: 'test@debug.com',
  password: 'debug123',
  authToken: null
};

// Create test image data (1x1 pixel PNG)
const createTestImageBuffer = () => Buffer.from([
  0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D,
  0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
  0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53, 0xDE, 0x00, 0x00, 0x00,
  0x0C, 0x49, 0x44, 0x41, 0x54, 0x08, 0xD7, 0x63, 0xF8, 0x00, 0x00, 0x00,
  0x00, 0x01, 0x00, 0x01, 0x00, 0x00, 0x00, 0x37, 0x6E, 0xF9, 0x24, 0x00,
  0x00, 0x00, 0x00, 0x49, 0x45, 0x4E, 0x44, 0xAE, 0x42, 0x60, 0x82
]);

/**
 * Create temporary test image files
 */
function createTestImages() {
  const tempDir = path.join(__dirname, 'temp-test-images');
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }

  const imageBuffer = createTestImageBuffer();
  const imagePaths = [];
  
  for (let i = 1; i <= 3; i++) {
    const imagePath = path.join(tempDir, `test-image-${i}.png`);
    fs.writeFileSync(imagePath, imageBuffer);
    imagePaths.push(imagePath);
  }
  
  return { tempDir, imagePaths };
}

/**
 * Cleanup test files
 */
function cleanup(tempDir) {
  if (fs.existsSync(tempDir)) {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

/**
 * Authenticate and get token
 */
async function authenticate() {
  try {
    console.log('🔐 Authenticating...');
    
    const response = await axios.post(`${API_BASE}/auth/login`, {
      email: TEST_USER.email,
      password: TEST_USER.password
    });

    if (response.data.success) {
      TEST_USER.authToken = response.data.data.accessToken;
      console.log('✅ Authentication successful');
      return true;
    } else {
      console.log('❌ Authentication failed:', response.data.message);
      return false;
    }
  } catch (error) {
    console.log('❌ Authentication error:', error.response?.data?.message || error.message);
    return false;
  }
}

/**
 * Get available campaigns
 */
async function getCampaigns() {
  try {
    console.log('📋 Getting campaigns...');
    
    const response = await axios.get(`${API_BASE}/campaigns`, {
      headers: {
        'Authorization': `Bearer ${TEST_USER.authToken}`
      },
      params: {
        limit: 10
      }
    });

    if (response.data.success && response.data.data.campaigns.length > 0) {
      const campaigns = response.data.data.campaigns;
      console.log(`✅ Found ${campaigns.length} campaigns`);
      return campaigns[0]; // Return first campaign
    } else {
      console.log('❌ No campaigns found');
      return null;
    }
  } catch (error) {
    console.log('❌ Error getting campaigns:', error.response?.data?.message || error.message);
    return null;
  }
}

/**
 * Create a test campaign for testing
 */
async function createTestCampaign() {
  try {
    console.log('📝 Creating test campaign...');
    
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const nextMonth = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    
    const response = await axios.post(`${API_BASE}/campaigns`, {
      title: 'Test Campaign for Image Upload Debug',
      slug: `test-campaign-${Date.now()}`,
      description: 'This is a test campaign created specifically for debugging image upload issues with campaign updates. The purpose is to test multipart form data handling.',
      short_description: 'Test campaign for debugging image upload functionality',
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

    if (response.data.success) {
      const campaign = response.data.data.campaign;
      console.log('✅ Test campaign created:', campaign.id);
      return campaign;
    } else {
      console.log('❌ Failed to create test campaign:', response.data.message);
      return null;
    }
  } catch (error) {
    console.log('❌ Error creating test campaign:', error.response?.data?.message || error.message);
    return null;
  }
}

/**
 * Test 1: Create campaign update with multipart form data
 */
async function testCreateWithMultipart(campaignId, imagePaths) {
  try {
    console.log('\n📝 TEST 1: Create campaign update with multipart form data');
    
    const form = new FormData();
    form.append('title', 'Test Update with Images via Multipart');
    form.append('description', 'This is a test update created with multipart form data containing images.');
    
    // Add multiple images
    for (let i = 0; i < imagePaths.length; i++) {
      form.append('images', fs.createReadStream(imagePaths[i]), {
        filename: `image-${i + 1}.png`,
        contentType: 'image/png'
      });
    }

    console.log('📤 Sending multipart request...');
    const response = await axios.post(
      `${API_BASE}/campaigns/${campaignId}/updates`,
      form,
      {
        headers: {
          'Authorization': `Bearer ${TEST_USER.authToken}`,
          ...form.getHeaders()
        },
        timeout: 30000
      }
    );

    if (response.data.success) {
      const update = response.data.data.update;
      console.log('✅ Create successful');
      console.log(`   Update ID: ${update.id}`);
      console.log(`   Images uploaded: ${update.images.length}`);
      console.log(`   Image URLs: ${JSON.stringify(update.images)}`);
      return update;
    } else {
      console.log('❌ Create failed:', response.data.message);
      return null;
    }
  } catch (error) {
    console.log('❌ Create error:', error.response?.data?.message || error.message);
    if (error.response?.data) {
      console.log('   Full error response:', JSON.stringify(error.response.data, null, 2));
    }
    return null;
  }
}

/**
 * Test 2: Update campaign update with multipart form data
 */
async function testUpdateWithMultipart(updateId, imagePaths) {
  try {
    console.log('\n✏️ TEST 2: Update campaign update with multipart form data');
    
    const form = new FormData();
    form.append('title', 'Updated Test Update with New Images');
    form.append('description', 'This update has been modified with new images via multipart form data.');
    
    // Add new images
    form.append('images', fs.createReadStream(imagePaths[0]), {
      filename: 'new-image-1.png',
      contentType: 'image/png'
    });

    console.log('📤 Sending multipart update request...');
    const response = await axios.put(
      `${API_BASE}/campaign-updates/${updateId}`,
      form,
      {
        headers: {
          'Authorization': `Bearer ${TEST_USER.authToken}`,
          ...form.getHeaders()
        },
        timeout: 30000
      }
    );

    if (response.data.success) {
      const update = response.data.data.update;
      console.log('✅ Update successful');
      console.log(`   Update ID: ${update.id}`);
      console.log(`   Total images: ${update.images.length}`);
      console.log(`   Image URLs: ${JSON.stringify(update.images)}`);
      return update;
    } else {
      console.log('❌ Update failed:', response.data.message);
      return null;
    }
  } catch (error) {
    console.log('❌ Update error:', error.response?.data?.message || error.message);
    if (error.response?.data) {
      console.log('   Full error response:', JSON.stringify(error.response.data, null, 2));
    }
    return null;
  }
}

/**
 * Test 3: Update with JSON payload (existing images as URL array)
 */
async function testUpdateWithJSON(updateId) {
  try {
    console.log('\n📋 TEST 3: Update with JSON payload (URL array)');
    
    const response = await axios.put(
      `${API_BASE}/campaign-updates/${updateId}`,
      {
        title: 'Updated with JSON - URL Array',
        description: 'This update uses JSON with image URL array.',
        images: [
          'https://example.com/image1.jpg',
          'https://example.com/image2.jpg'
        ]
      },
      {
        headers: {
          'Authorization': `Bearer ${TEST_USER.authToken}`,
          'Content-Type': 'application/json'
        }
      }
    );

    if (response.data.success) {
      const update = response.data.data.update;
      console.log('✅ JSON update successful');
      console.log(`   Update ID: ${update.id}`);
      console.log(`   Total images: ${update.images.length}`);
      console.log(`   Image URLs: ${JSON.stringify(update.images)}`);
      return update;
    } else {
      console.log('❌ JSON update failed:', response.data.message);
      return null;
    }
  } catch (error) {
    console.log('❌ JSON update error:', error.response?.data?.message || error.message);
    return null;
  }
}

/**
 * Test 4: Image upload endpoint
 */
async function testImageUploadEndpoint(updateId, imagePaths) {
  try {
    console.log('\n📤 TEST 4: Dedicated image upload endpoint');
    
    const form = new FormData();
    form.append('images', fs.createReadStream(imagePaths[0]), {
      filename: 'upload-endpoint-test.png',
      contentType: 'image/png'
    });

    console.log('📤 Sending to image upload endpoint...');
    const response = await axios.post(
      `${API_BASE}/campaign-updates/${updateId}/images`,
      form,
      {
        headers: {
          'Authorization': `Bearer ${TEST_USER.authToken}`,
          ...form.getHeaders()
        },
        timeout: 30000
      }
    );

    if (response.data.success) {
      console.log('✅ Image upload successful');
      console.log(`   Uploaded: ${response.data.data.uploaded}`);
      console.log(`   Failed: ${response.data.data.failed}`);
      console.log(`   New image URLs:`, response.data.data.images.map(img => img.url));
      return response.data.data;
    } else {
      console.log('❌ Image upload failed:', response.data.message);
      return null;
    }
  } catch (error) {
    console.log('❌ Image upload error:', error.response?.data?.message || error.message);
    if (error.response?.data) {
      console.log('   Full error response:', JSON.stringify(error.response.data, null, 2));
    }
    return null;
  }
}

/**
 * Test 5: Mixed multipart data (images + URL array)
 */
async function testMixedMultipart(updateId, imagePaths) {
  try {
    console.log('\n🔀 TEST 5: Mixed multipart (files + URL array)');
    
    const form = new FormData();
    form.append('title', 'Mixed Update: Files + URLs');
    form.append('description', 'This update combines uploaded files with existing image URLs.');
    
    // Add file upload
    form.append('images', fs.createReadStream(imagePaths[0]), {
      filename: 'mixed-test.png',
      contentType: 'image/png'
    });
    
    // Add existing images as JSON string (this might be how frontend sends it)
    form.append('images', JSON.stringify([
      'https://example.com/existing1.jpg',
      'https://example.com/existing2.jpg'
    ]));

    console.log('📤 Sending mixed multipart request...');
    const response = await axios.put(
      `${API_BASE}/campaign-updates/${updateId}`,
      form,
      {
        headers: {
          'Authorization': `Bearer ${TEST_USER.authToken}`,
          ...form.getHeaders()
        },
        timeout: 30000
      }
    );

    if (response.data.success) {
      const update = response.data.data.update;
      console.log('✅ Mixed multipart successful');
      console.log(`   Update ID: ${update.id}`);
      console.log(`   Total images: ${update.images.length}`);
      console.log(`   Image URLs: ${JSON.stringify(update.images)}`);
      return update;
    } else {
      console.log('❌ Mixed multipart failed:', response.data.message);
      return null;
    }
  } catch (error) {
    console.log('❌ Mixed multipart error:', error.response?.data?.message || error.message);
    if (error.response?.data) {
      console.log('   Full error response:', JSON.stringify(error.response.data, null, 2));
    }
    return null;
  }
}

/**
 * Check file accessibility
 */
async function checkImageAccessibility(imageUrls) {
  console.log('\n🔍 Checking image accessibility...');
  
  for (const url of imageUrls) {
    try {
      const fullUrl = url.startsWith('http') ? url : `${BASE_URL}${url}`;
      const response = await axios.head(fullUrl, { timeout: 5000 });
      
      if (response.status === 200) {
        console.log(`✅ Accessible: ${url}`);
      } else {
        console.log(`⚠️ Status ${response.status}: ${url}`);
      }
    } catch (error) {
      console.log(`❌ Not accessible: ${url} - ${error.message}`);
    }
  }
}

/**
 * Main debug function
 */
async function runDebugTests() {
  console.log('🐛 Campaign Update Image Upload Debug Tests');
  console.log('=' .repeat(80));

  // Setup
  const { tempDir, imagePaths } = createTestImages();
  let campaign = null;
  let testUpdate = null;

  try {
    // Authenticate
    const authenticated = await authenticate();
    if (!authenticated) {
      console.log('❌ Cannot proceed without authentication');
      console.log('💡 Update TEST_USER credentials in the script');
      return;
    }

    // Always create a test campaign for this user to ensure permissions
    console.log('📝 Creating test campaign owned by current user...');
    campaign = await createTestCampaign();
    if (!campaign) {
      console.log('❌ Cannot proceed without a campaign');
      return;
    }

    // Run tests
    console.log('\n🚀 Starting tests...');

    // Test 1: Create with multipart
    testUpdate = await testCreateWithMultipart(campaign.id, imagePaths);
    if (!testUpdate) {
      console.log('❌ Create test failed - this is the main issue!');
    }

    // Test 2: Update with multipart (only if create succeeded)
    if (testUpdate) {
      await testUpdateWithMultipart(testUpdate.id, imagePaths);
      
      // Test 3: Update with JSON
      await testUpdateWithJSON(testUpdate.id);
      
      // Test 4: Image upload endpoint
      await testImageUploadEndpoint(testUpdate.id, imagePaths);
      
      // Test 5: Mixed multipart
      await testMixedMultipart(testUpdate.id, imagePaths);
      
      // Get final state
      try {
        const finalResponse = await axios.get(`${API_BASE}/campaign-updates/${testUpdate.id}`, {
          headers: {
            'Authorization': `Bearer ${TEST_USER.authToken}`
          }
        });
        
        if (finalResponse.data.success) {
          const finalUpdate = finalResponse.data.data.update;
          console.log('\n📊 Final Update State:');
          console.log(`   Update ID: ${finalUpdate.id}`);
          console.log(`   Title: ${finalUpdate.title}`);
          console.log(`   Total images: ${finalUpdate.images.length}`);
          console.log(`   Image URLs: ${JSON.stringify(finalUpdate.images, null, 2)}`);
          
          // Check accessibility
          if (finalUpdate.images.length > 0) {
            await checkImageAccessibility(finalUpdate.images);
          }
        }
      } catch (error) {
        console.log('⚠️ Could not get final update state:', error.message);
      }
    }

    console.log('\n' + '=' .repeat(80));
    console.log('✅ Debug tests completed');
    
  } catch (error) {
    console.log('❌ Debug test suite error:', error.message);
  } finally {
    cleanup(tempDir);
  }
}

// Run debug tests
if (require.main === module) {
  runDebugTests().catch(console.error);
}

module.exports = {
  runDebugTests
};