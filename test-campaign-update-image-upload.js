#!/usr/bin/env node

/**
 * Test script for Campaign Update Image Upload Functionality
 * 
 * This script tests:
 * 1. Creating campaign updates with image uploads
 * 2. Updating campaign updates with additional images
 * 3. Directory creation and file storage
 * 4. URL generation and access
 */

const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');

// Configuration
const BASE_URL = 'http://localhost:5000';
const API_BASE = `${BASE_URL}/api`;

// Test configuration
const TEST_CONFIG = {
  // You'll need to update these with valid credentials
  email: 'test@example.com',
  password: 'testpassword',
  campaignId: null, // Will be set during test
  authToken: null
};

// Test images (create small test images for testing)
const TEST_IMAGES_DIR = path.join(__dirname, 'test-images');

/**
 * Create test images directory and sample images
 */
async function createTestImages() {
  try {
    if (!fs.existsSync(TEST_IMAGES_DIR)) {
      fs.mkdirSync(TEST_IMAGES_DIR, { recursive: true });
    }

    // Create sample test images (1x1 pixel images)
    const pngData = Buffer.from([
      0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D,
      0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
      0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53, 0xDE, 0x00, 0x00, 0x00,
      0x0C, 0x49, 0x44, 0x41, 0x54, 0x08, 0xD7, 0x63, 0xF8, 0x00, 0x00, 0x00,
      0x00, 0x01, 0x00, 0x01, 0x00, 0x00, 0x00, 0x37, 0x6E, 0xF9, 0x24, 0x00,
      0x00, 0x00, 0x00, 0x49, 0x45, 0x4E, 0x44, 0xAE, 0x42, 0x60, 0x82
    ]);

    const jpegData = Buffer.from([
      0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01,
      0x01, 0x01, 0x00, 0x48, 0x00, 0x48, 0x00, 0x00, 0xFF, 0xDB, 0x00, 0x43,
      0x00, 0x08, 0x06, 0x06, 0x07, 0x06, 0x05, 0x08, 0x07, 0x07, 0x07, 0x09,
      0x09, 0x08, 0x0A, 0x0C, 0x14, 0x0D, 0x0C, 0x0B, 0x0B, 0x0C, 0x19, 0x12,
      0x13, 0x0F, 0x14, 0x1D, 0x1A, 0x1F, 0x1E, 0x1D, 0x1A, 0x1C, 0x1C, 0x20,
      0x24, 0x2E, 0x27, 0x20, 0x22, 0x2C, 0x23, 0x1C, 0x1C, 0x28, 0x37, 0x29,
      0x2C, 0x30, 0x31, 0x34, 0x34, 0x34, 0x1F, 0x27, 0x39, 0x3D, 0x38, 0x32,
      0x3C, 0x2E, 0x33, 0x34, 0x32, 0xFF, 0xC0, 0x00, 0x11, 0x08, 0x00, 0x01,
      0x00, 0x01, 0x01, 0x01, 0x11, 0x00, 0x02, 0x11, 0x01, 0x03, 0x11, 0x01,
      0xFF, 0xC4, 0x00, 0x14, 0x00, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
      0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0xFF, 0xC4,
      0x00, 0x14, 0x10, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
      0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0xFF, 0xDA, 0x00, 0x0C,
      0x03, 0x01, 0x00, 0x02, 0x11, 0x03, 0x11, 0x00, 0x3F, 0x00, 0xBF, 0xFF, 0xD9
    ]);

    fs.writeFileSync(path.join(TEST_IMAGES_DIR, 'test1.png'), pngData);
    fs.writeFileSync(path.join(TEST_IMAGES_DIR, 'test2.jpg'), jpegData);
    fs.writeFileSync(path.join(TEST_IMAGES_DIR, 'test3.png'), pngData);

    console.log('✅ Test images created successfully');
  } catch (error) {
    console.error('❌ Failed to create test images:', error.message);
    throw error;
  }
}

/**
 * Login and get authentication token
 */
async function authenticate() {
  try {
    console.log('🔐 Authenticating...');
    
    const response = await axios.post(`${API_BASE}/auth/login`, {
      email: TEST_CONFIG.email,
      password: TEST_CONFIG.password
    });

    if (response.data.success) {
      TEST_CONFIG.authToken = response.data.data.token;
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
 * Get or create a test campaign
 */
async function getTestCampaign() {
  try {
    console.log('🔍 Looking for test campaigns...');
    
    const response = await axios.get(`${API_BASE}/campaigns`, {
      headers: {
        'Authorization': `Bearer ${TEST_CONFIG.authToken}`
      },
      params: {
        limit: 1,
        status: 'active'
      }
    });

    if (response.data.success && response.data.data.campaigns.length > 0) {
      TEST_CONFIG.campaignId = response.data.data.campaigns[0].id;
      console.log('✅ Using existing campaign:', TEST_CONFIG.campaignId);
      return true;
    } else {
      console.log('ℹ️ No campaigns found, you may need to create one manually');
      return false;
    }
  } catch (error) {
    console.log('❌ Failed to get campaigns:', error.response?.data?.message || error.message);
    return false;
  }
}

/**
 * Test creating campaign update with images
 */
async function testCreateCampaignUpdate() {
  try {
    console.log('📝 Testing campaign update creation with images...');
    
    const form = new FormData();
    form.append('title', 'Test Campaign Update with Images');
    form.append('description', 'This is a test campaign update created with image upload functionality.');
    
    // Append test images
    form.append('images', fs.createReadStream(path.join(TEST_IMAGES_DIR, 'test1.png')));
    form.append('images', fs.createReadStream(path.join(TEST_IMAGES_DIR, 'test2.jpg')));

    const response = await axios.post(
      `${API_BASE}/campaigns/${TEST_CONFIG.campaignId}/updates`,
      form,
      {
        headers: {
          'Authorization': `Bearer ${TEST_CONFIG.authToken}`,
          ...form.getHeaders()
        }
      }
    );

    if (response.data.success) {
      const update = response.data.data.update;
      console.log('✅ Campaign update created successfully');
      console.log('📊 Update ID:', update.id);
      console.log('🖼️ Images uploaded:', update.images.length);
      console.log('🔗 Image URLs:', update.images);
      
      return update;
    } else {
      console.log('❌ Failed to create campaign update:', response.data.message);
      return null;
    }
  } catch (error) {
    console.log('❌ Create campaign update error:', error.response?.data?.message || error.message);
    if (error.response?.data?.details) {
      console.log('📋 Error details:', error.response.data.details);
    }
    return null;
  }
}

/**
 * Test updating campaign update with additional images
 */
async function testUpdateCampaignUpdate(updateId) {
  try {
    console.log('📝 Testing campaign update modification with additional images...');
    
    const form = new FormData();
    form.append('title', 'Updated Test Campaign Update with More Images');
    form.append('description', 'This campaign update has been updated with additional images.');
    
    // Append additional test image
    form.append('images', fs.createReadStream(path.join(TEST_IMAGES_DIR, 'test3.png')));

    const response = await axios.put(
      `${API_BASE}/campaign-updates/${updateId}`,
      form,
      {
        headers: {
          'Authorization': `Bearer ${TEST_CONFIG.authToken}`,
          ...form.getHeaders()
        }
      }
    );

    if (response.data.success) {
      const update = response.data.data.update;
      console.log('✅ Campaign update modified successfully');
      console.log('📊 Update ID:', update.id);
      console.log('🖼️ Total images:', update.images.length);
      console.log('🔗 Image URLs:', update.images);
      
      return update;
    } else {
      console.log('❌ Failed to update campaign update:', response.data.message);
      return null;
    }
  } catch (error) {
    console.log('❌ Update campaign update error:', error.response?.data?.message || error.message);
    if (error.response?.data?.details) {
      console.log('📋 Error details:', error.response.data.details);
    }
    return null;
  }
}

/**
 * Test image upload endpoint
 */
async function testImageUploadEndpoint(updateId) {
  try {
    console.log('📤 Testing dedicated image upload endpoint...');
    
    const form = new FormData();
    form.append('images', fs.createReadStream(path.join(TEST_IMAGES_DIR, 'test1.png')));
    form.append('images', fs.createReadStream(path.join(TEST_IMAGES_DIR, 'test2.jpg')));

    const response = await axios.post(
      `${API_BASE}/campaign-updates/${updateId}/images`,
      form,
      {
        headers: {
          'Authorization': `Bearer ${TEST_CONFIG.authToken}`,
          ...form.getHeaders()
        }
      }
    );

    if (response.data.success) {
      console.log('✅ Images uploaded via dedicated endpoint');
      console.log('📊 Uploaded:', response.data.data.uploaded);
      console.log('❌ Failed:', response.data.data.failed);
      console.log('🔗 New image URLs:', response.data.data.images.map(img => img.url));
      
      return response.data.data;
    } else {
      console.log('❌ Failed to upload images:', response.data.message);
      return null;
    }
  } catch (error) {
    console.log('❌ Image upload error:', error.response?.data?.message || error.message);
    return null;
  }
}

/**
 * Test image accessibility
 */
async function testImageAccess(imageUrls) {
  try {
    console.log('🔍 Testing image accessibility...');
    
    for (const url of imageUrls) {
      try {
        const fullUrl = url.startsWith('http') ? url : `${BASE_URL}${url}`;
        const response = await axios.head(fullUrl);
        
        if (response.status === 200) {
          console.log(`✅ Image accessible: ${url}`);
        } else {
          console.log(`⚠️ Image response status ${response.status}: ${url}`);
        }
      } catch (error) {
        console.log(`❌ Image not accessible: ${url} - ${error.message}`);
      }
    }
  } catch (error) {
    console.log('❌ Image access test error:', error.message);
  }
}

/**
 * Cleanup test files
 */
async function cleanup() {
  try {
    console.log('🧹 Cleaning up test files...');
    
    if (fs.existsSync(TEST_IMAGES_DIR)) {
      fs.rmSync(TEST_IMAGES_DIR, { recursive: true, force: true });
      console.log('✅ Test images cleaned up');
    }
  } catch (error) {
    console.log('⚠️ Cleanup warning:', error.message);
  }
}

/**
 * Main test function
 */
async function runTests() {
  console.log('🚀 Starting Campaign Update Image Upload Tests');
  console.log('=' .repeat(60));
  
  try {
    // Setup
    await createTestImages();
    
    // Authentication
    const authenticated = await authenticate();
    if (!authenticated) {
      console.log('❌ Tests cannot continue without authentication');
      console.log('💡 Make sure you have valid test credentials or a test user account');
      return;
    }
    
    // Get test campaign
    const hasCampaign = await getTestCampaign();
    if (!hasCampaign) {
      console.log('❌ Tests cannot continue without a campaign');
      console.log('💡 Create a test campaign first or update TEST_CONFIG.campaignId');
      return;
    }
    
    // Test create with images
    const createdUpdate = await testCreateCampaignUpdate();
    if (!createdUpdate) {
      console.log('❌ Create test failed, skipping remaining tests');
      return;
    }
    
    // Test update with additional images
    const updatedUpdate = await testUpdateCampaignUpdate(createdUpdate.id);
    if (!updatedUpdate) {
      console.log('⚠️ Update test failed, but continuing...');
    }
    
    // Test dedicated upload endpoint
    const uploadResult = await testImageUploadEndpoint(createdUpdate.id);
    if (!uploadResult) {
      console.log('⚠️ Upload endpoint test failed, but continuing...');
    }
    
    // Test image accessibility
    const allImageUrls = [
      ...(createdUpdate.images || []),
      ...(updatedUpdate?.images || []),
      ...(uploadResult?.images?.map(img => img.url) || [])
    ];
    
    const uniqueUrls = [...new Set(allImageUrls)];
    if (uniqueUrls.length > 0) {
      await testImageAccess(uniqueUrls);
    }
    
    console.log('=' .repeat(60));
    console.log('✅ Campaign Update Image Upload Tests Completed');
    console.log(`📊 Total unique image URLs tested: ${uniqueUrls.length}`);
    
  } catch (error) {
    console.log('❌ Test suite error:', error.message);
  } finally {
    await cleanup();
  }
}

// Run tests if this script is executed directly
if (require.main === module) {
  runTests().catch(console.error);
}

module.exports = {
  runTests,
  createTestImages,
  authenticate,
  testCreateCampaignUpdate,
  testUpdateCampaignUpdate,
  testImageUploadEndpoint,
  testImageAccess
};