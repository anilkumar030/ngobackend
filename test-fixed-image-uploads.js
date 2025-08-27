#!/usr/bin/env node

/**
 * Test script for Fixed Campaign Update Image Upload Functionality
 * 
 * This script tests the image upload fix to ensure URLs are accessible
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
  const tempDir = path.join(__dirname, 'temp-fixed-test-images');
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }

  const imageBuffer = createTestImageBuffer();
  const imagePath = path.join(tempDir, 'fixed-test-image.png');
  fs.writeFileSync(imagePath, imageBuffer);
  
  return { tempDir, imagePath };
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
      title: 'Fixed Image Upload Test Campaign',
      slug: `fixed-test-campaign-${Date.now()}`,
      description: 'This is a test campaign created to verify that the image upload fix works correctly.',
      short_description: 'Test campaign for verifying fixed image upload functionality',
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
 * Test creating campaign update with image
 */
async function testCreateCampaignUpdateWithImage(campaignId, imagePath) {
  try {
    console.log('📝 Creating campaign update with image...');
    
    const form = new FormData();
    form.append('title', 'Fixed Image Upload Test');
    form.append('description', 'This update tests the fixed image upload functionality.');
    form.append('images', fs.createReadStream(imagePath), {
      filename: 'fixed-test.png',
      contentType: 'image/png'
    });

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
      console.log('✅ Campaign update created successfully');
      console.log(`   Update ID: ${update.id}`);
      console.log(`   Images uploaded: ${update.images.length}`);
      console.log('   Image URLs:', update.images);
      return update;
    } else {
      console.log('❌ Failed to create campaign update:', response.data.message);
      return null;
    }
  } catch (error) {
    console.log('❌ Error creating campaign update:', error.response?.data?.message || error.message);
    return null;
  }
}

/**
 * Test image accessibility
 */
async function testImageAccessibility(imageUrls) {
  console.log('\n🔍 Testing image accessibility...');
  
  let accessibleCount = 0;
  let notAccessibleCount = 0;
  
  for (const url of imageUrls) {
    try {
      const response = await axios.head(url, { timeout: 10000 });
      
      if (response.status === 200) {
        console.log(`✅ Image accessible: ${url}`);
        accessibleCount++;
      } else {
        console.log(`⚠️ Status ${response.status}: ${url}`);
        notAccessibleCount++;
      }
    } catch (error) {
      console.log(`❌ Image not accessible: ${url} - ${error.message}`);
      notAccessibleCount++;
    }
  }
  
  return { accessibleCount, notAccessibleCount };
}

/**
 * Main test function
 */
async function runFixedTests() {
  console.log('🔧 Fixed Campaign Update Image Upload Tests');
  console.log('=' .repeat(80));

  const { tempDir, imagePath } = createTestImages();
  let campaign = null;

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

    // Test create with image
    const update = await testCreateCampaignUpdateWithImage(campaign.id, imagePath);
    if (!update) {
      console.log('❌ Campaign update creation failed');
      return;
    }

    // Test image accessibility
    if (update.images && update.images.length > 0) {
      const { accessibleCount, notAccessibleCount } = await testImageAccessibility(update.images);
      
      console.log('\n📊 Results Summary:');
      console.log(`   ✅ Accessible images: ${accessibleCount}`);
      console.log(`   ❌ Not accessible images: ${notAccessibleCount}`);
      console.log(`   📸 Total images tested: ${update.images.length}`);
      
      if (accessibleCount === update.images.length) {
        console.log('\n🎉 SUCCESS: All images are accessible!');
        console.log('✅ The image upload fix is working correctly.');
      } else {
        console.log('\n⚠️ PARTIAL SUCCESS: Some images are not accessible.');
        console.log(`   ${accessibleCount}/${update.images.length} images are accessible.`);
      }
    } else {
      console.log('⚠️ No images were uploaded to test');
    }

    console.log('\n' + '=' .repeat(80));
    console.log('✅ Fixed image upload tests completed');
    
  } catch (error) {
    console.log('❌ Test suite error:', error.message);
  } finally {
    cleanup(tempDir);
  }
}

// Run tests
if (require.main === module) {
  runFixedTests().catch(console.error);
}

module.exports = {
  runFixedTests
};