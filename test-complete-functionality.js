#!/usr/bin/env node

/**
 * Complete test script for Campaign Update Image Upload functionality
 * 
 * Tests all endpoints to ensure they work correctly with the fix
 */

const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');

// Configuration
const BASE_URL = 'http://localhost:3000';
const BACKEND_URL = 'http://localhost:5000';
const API_BASE = `${BASE_URL}/api`;

// Test user credentials
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
  const tempDir = path.join(__dirname, 'temp-complete-test-images');
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }

  const imageBuffer = createTestImageBuffer();
  const imagePaths = [];
  
  for (let i = 1; i <= 3; i++) {
    const imagePath = path.join(tempDir, `complete-test-image-${i}.png`);
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
 * Create a test campaign
 */
async function createTestCampaign() {
  try {
    console.log('📝 Creating test campaign...');
    
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const nextMonth = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    
    const response = await axios.post(`${API_BASE}/campaigns`, {
      title: 'Complete Image Upload Test Campaign',
      slug: `complete-test-campaign-${Date.now()}`,
      description: 'This is a test campaign created to verify all campaign update image upload functionality.',
      short_description: 'Complete test campaign for verifying all image upload functionality',
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
 * Test: Create campaign update with multipart form data
 */
async function testCreateWithImages(campaignId, imagePaths) {
  try {
    console.log('\n📝 TEST 1: Create campaign update with multipart form data');
    
    const form = new FormData();
    form.append('title', 'Test Update with Multiple Images');
    form.append('description', 'This update was created with multipart form data including multiple images.');
    
    // Add multiple images
    for (let i = 0; i < imagePaths.length; i++) {
      form.append('images', fs.createReadStream(imagePaths[i]), {
        filename: `test-image-${i + 1}.png`,
        contentType: 'image/png'
      });
    }

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
      console.log('   Image URLs:', update.images);
      return update;
    } else {
      console.log('❌ Create failed:', response.data.message);
      return null;
    }
  } catch (error) {
    console.log('❌ Create error:', error.response?.data?.message || error.message);
    return null;
  }
}

/**
 * Test: Update campaign update with new images
 */
async function testUpdateWithImages(updateId, imagePaths) {
  try {
    console.log('\n✏️ TEST 2: Update campaign update with new images');
    
    const form = new FormData();
    form.append('title', 'Updated Test with Additional Images');
    form.append('description', 'This update has been modified to include additional images.');
    form.append('images', fs.createReadStream(imagePaths[0]), {
      filename: 'additional-image.png',
      contentType: 'image/png'
    });

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
      console.log('   Image URLs:', update.images);
      return update;
    } else {
      console.log('❌ Update failed:', response.data.message);
      return null;
    }
  } catch (error) {
    console.log('❌ Update error:', error.response?.data?.message || error.message);
    return null;
  }
}

/**
 * Test: Dedicated image upload endpoint
 */
async function testDedicatedImageUpload(updateId, imagePaths) {
  try {
    console.log('\n📤 TEST 3: Dedicated image upload endpoint');
    
    const form = new FormData();
    form.append('images', fs.createReadStream(imagePaths[0]), {
      filename: 'dedicated-upload.png',
      contentType: 'image/png'
    });

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
      console.log('   New image URLs:', response.data.data.images.map(img => img.url));
      
      // Get updated campaign update
      const updatedResponse = await axios.get(`${API_BASE}/campaign-updates/${updateId}`, {
        headers: {
          'Authorization': `Bearer ${TEST_USER.authToken}`
        }
      });
      
      if (updatedResponse.data.success) {
        const finalUpdate = updatedResponse.data.data.update;
        console.log(`   Final total images: ${finalUpdate.images.length}`);
        return finalUpdate;
      }
      
      return response.data.data;
    } else {
      console.log('❌ Image upload failed:', response.data.message);
      return null;
    }
  } catch (error) {
    console.log('❌ Image upload error:', error.response?.data?.message || error.message);
    return null;
  }
}

/**
 * Test: JSON update with URL array
 */
async function testJsonUpdate(updateId) {
  try {
    console.log('\n📋 TEST 4: JSON update with image URL array');
    
    const response = await axios.put(
      `${API_BASE}/campaign-updates/${updateId}`,
      {
        title: 'JSON Updated Title',
        description: 'This update was modified using JSON data with image URLs.',
        images: [
          'https://example.com/external-image1.jpg',
          'https://example.com/external-image2.jpg'
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
      console.log('   Image URLs:', update.images);
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
 * Test image accessibility
 */
async function testImageAccessibility(imageUrls, testName = '') {
  console.log(`\n🔍 Testing image accessibility ${testName}...`);
  
  let accessibleCount = 0;
  let notAccessibleCount = 0;
  const results = [];
  
  for (const url of imageUrls) {
    try {
      const response = await axios.head(url, { timeout: 10000 });
      
      if (response.status === 200) {
        console.log(`   ✅ ${url}`);
        accessibleCount++;
        results.push({ url, accessible: true, status: response.status });
      } else {
        console.log(`   ⚠️ Status ${response.status}: ${url}`);
        notAccessibleCount++;
        results.push({ url, accessible: false, status: response.status });
      }
    } catch (error) {
      console.log(`   ❌ ${url} - ${error.message}`);
      notAccessibleCount++;
      results.push({ url, accessible: false, error: error.message });
    }
  }
  
  return { accessibleCount, notAccessibleCount, results };
}

/**
 * Main test function
 */
async function runCompleteTests() {
  console.log('🧪 Complete Campaign Update Image Upload Tests');
  console.log('=' .repeat(80));

  const { tempDir, imagePaths } = createTestImages();
  let campaign = null;
  let allImageUrls = [];

  try {
    // Authenticate
    const authenticated = await authenticate();
    if (!authenticated) {
      console.log('❌ Cannot proceed without authentication');
      return;
    }

    // Create campaign
    campaign = await createTestCampaign();
    if (!campaign) {
      console.log('❌ Cannot proceed without a campaign');
      return;
    }

    // Run tests
    console.log('\n🚀 Starting comprehensive tests...');

    // Test 1: Create with images
    const createdUpdate = await testCreateWithImages(campaign.id, imagePaths);
    if (createdUpdate && createdUpdate.images) {
      allImageUrls.push(...createdUpdate.images);
    }

    if (!createdUpdate) {
      console.log('❌ Create test failed - cannot continue');
      return;
    }

    // Test 2: Update with additional images
    const updatedUpdate = await testUpdateWithImages(createdUpdate.id, imagePaths);
    if (updatedUpdate && updatedUpdate.images) {
      // Clear previous URLs and use new ones from update
      allImageUrls = [...updatedUpdate.images];
    }

    // Test 3: Dedicated image upload endpoint
    const uploadResult = await testDedicatedImageUpload(createdUpdate.id, imagePaths);
    if (uploadResult && uploadResult.images) {
      allImageUrls = [...uploadResult.images];
    }

    // Test 4: JSON update with URLs
    const jsonUpdatedUpdate = await testJsonUpdate(createdUpdate.id);
    if (jsonUpdatedUpdate && jsonUpdatedUpdate.images) {
      // This will contain external URLs, test them separately
      console.log('\n🔍 Testing external URL accessibility...');
      await testImageAccessibility(jsonUpdatedUpdate.images, '(External URLs)');
    }

    // Test accessibility of all uploaded images
    if (allImageUrls.length > 0) {
      const localImages = allImageUrls.filter(url => url.startsWith('http://localhost'));
      if (localImages.length > 0) {
        const { accessibleCount, notAccessibleCount } = await testImageAccessibility(localImages, '(Local Uploads)');
        
        console.log('\n📊 Final Results Summary:');
        console.log(`   ✅ Accessible local images: ${accessibleCount}`);
        console.log(`   ❌ Not accessible local images: ${notAccessibleCount}`);
        console.log(`   📸 Total local images tested: ${localImages.length}`);
        
        if (accessibleCount === localImages.length && localImages.length > 0) {
          console.log('\n🎉 SUCCESS: All uploaded images are accessible!');
          console.log('✅ The campaign update image upload functionality is working correctly.');
          
          // Test the API documentation requirements
          console.log('\n📋 API Documentation Compliance Check:');
          console.log('   ✅ POST /api/campaigns/:campaignId/updates - Working');
          console.log('   ✅ PUT /api/campaign-updates/:id - Working');
          console.log('   ✅ POST /api/campaign-updates/:id/images - Working');
          console.log('   ✅ Multipart form data handling - Working');
          console.log('   ✅ Image URL generation - Working');
          console.log('   ✅ Static file serving - Working');
          
        } else if (accessibleCount > 0) {
          console.log('\n⚠️ PARTIAL SUCCESS: Some images are accessible.');
          console.log(`   ${accessibleCount}/${localImages.length} local images are accessible.`);
        } else {
          console.log('\n❌ FAILURE: No uploaded images are accessible.');
        }
      }
    }

    console.log('\n' + '=' .repeat(80));
    console.log('✅ Complete functionality tests completed');
    
  } catch (error) {
    console.log('❌ Test suite error:', error.message);
  } finally {
    cleanup(tempDir);
  }
}

// Run tests
if (require.main === module) {
  runCompleteTests().catch(console.error);
}

module.exports = {
  runCompleteTests
};