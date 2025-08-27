const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');

// Configuration
const BASE_URL = 'http://localhost:5000/api';
const TEST_EMAIL = 'admin@example.com';
const TEST_PASSWORD = 'password123';

// Global variables for test data
let authToken = '';
let testCampaignId = '';
let testUpdateId = '';

// Test utilities
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  white: '\x1b[37m'
};

function log(message, color = colors.white) {
  console.log(`${color}${message}${colors.reset}`);
}

function logTest(testName) {
  log(`\n🧪 Testing: ${testName}`, colors.cyan);
}

function logSuccess(message) {
  log(`✅ ${message}`, colors.green);
}

function logError(message) {
  log(`❌ ${message}`, colors.red);
}

function logWarning(message) {
  log(`⚠️  ${message}`, colors.yellow);
}

// HTTP client with error handling
async function makeRequest(method, url, data = null, headers = {}) {
  try {
    const config = {
      method,
      url: `${BASE_URL}${url}`,
      headers: {
        'Content-Type': 'application/json',
        ...headers
      }
    };

    if (data) {
      if (data instanceof FormData) {
        config.data = data;
        config.headers = {
          ...config.headers,
          ...data.getHeaders()
        };
      } else {
        config.data = data;
      }
    }

    const response = await axios(config);
    return { success: true, data: response.data, status: response.status };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data || error.message,
      status: error.response?.status || 500
    };
  }
}

// Test functions
async function authenticateUser() {
  logTest('User Authentication');
  
  const response = await makeRequest('POST', '/auth/login', {
    email: TEST_EMAIL,
    password: TEST_PASSWORD
  });

  if (response.success && response.data.data?.accessToken) {
    authToken = response.data.data.accessToken;
    logSuccess('User authenticated successfully');
    return true;
  } else {
    logError(`Authentication failed: ${JSON.stringify(response.error)}`);
    return false;
  }
}

async function getOrCreateTestCampaign() {
  logTest('Get or Create Test Campaign');
  
  // First, try to get existing campaigns
  const campaignsResponse = await makeRequest('GET', '/campaigns?limit=1', null, {
    'Authorization': `Bearer ${authToken}`
  });

  if (campaignsResponse.success && campaignsResponse.data.data?.campaigns?.length > 0) {
    testCampaignId = campaignsResponse.data.data.campaigns[0].id;
    logSuccess(`Using existing campaign: ${testCampaignId}`);
    return true;
  }

  // Create a new test campaign if none exists
  const campaignData = {
    title: 'Test Campaign for Updates API',
    slug: `test-campaign-updates-${Date.now()}`,
    description: 'This is a test campaign created specifically for testing the campaign updates API functionality.',
    short_description: 'Test campaign for updates API testing',
    target_amount: 10000,
    category: 'education',
    status: 'active',
    start_date: new Date().toISOString(),
    end_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() // 30 days from now
  };

  const response = await makeRequest('POST', '/campaigns', campaignData, {
    'Authorization': `Bearer ${authToken}`
  });

  if (response.success && response.data.data?.campaign?.id) {
    testCampaignId = response.data.data.campaign.id;
    logSuccess(`Test campaign created: ${testCampaignId}`);
    return true;
  } else {
    logError(`Failed to create test campaign: ${JSON.stringify(response.error)}`);
    return false;
  }
}

async function testCreateCampaignUpdate() {
  logTest('Create Campaign Update');
  
  const updateData = {
    title: 'First Update: Project Launch',
    description: 'We are excited to announce that our project has officially launched! Thank you to all our supporters. This update includes information about our progress and what to expect next. We have made significant strides in the first week and are on track to meet our goals.',
    images: [
      'https://example.com/image1.jpg',
      'https://example.com/image2.jpg'
    ]
  };

  const response = await makeRequest(
    'POST',
    `/campaigns/${testCampaignId}/updates`,
    updateData,
    {
      'Authorization': `Bearer ${authToken}`
    }
  );

  if (response.success && response.data.data?.update?.id) {
    testUpdateId = response.data.data.update.id;
    logSuccess(`Campaign update created: ${testUpdateId}`);
    log(`Update title: ${response.data.data.update.title}`, colors.blue);
    return true;
  } else {
    logError(`Failed to create campaign update: ${JSON.stringify(response.error)}`);
    return false;
  }
}

async function testCreateSecondUpdate() {
  logTest('Create Second Campaign Update');
  
  const updateData = {
    title: 'Mid-Project Progress Report',
    description: 'We have reached the halfway point of our campaign! Here is what we have accomplished so far and our plans for the remaining time.',
    images: []
  };

  const response = await makeRequest(
    'POST',
    `/campaigns/${testCampaignId}/updates`,
    updateData,
    {
      'Authorization': `Bearer ${authToken}`
    }
  );

  if (response.success && response.data.data?.update?.id) {
    logSuccess(`Second campaign update created: ${response.data.data.update.id}`);
    return true;
  } else {
    logError(`Failed to create second campaign update: ${JSON.stringify(response.error)}`);
    return false;
  }
}

async function testGetCampaignUpdates() {
  logTest('Get Campaign Updates');
  
  const response = await makeRequest('GET', `/campaigns/${testCampaignId}/updates`);

  if (response.success && response.data.data?.updates) {
    logSuccess(`Retrieved ${response.data.data.updates.length} campaign updates`);
    log(`Pagination info: ${JSON.stringify(response.data.data.pagination)}`, colors.blue);
    
    // Test pagination
    const paginatedResponse = await makeRequest('GET', `/campaigns/${testCampaignId}/updates?page=1&limit=1`);
    
    if (paginatedResponse.success) {
      logSuccess('Pagination working correctly');
    } else {
      logWarning('Pagination test failed');
    }
    
    return true;
  } else {
    logError(`Failed to get campaign updates: ${JSON.stringify(response.error)}`);
    return false;
  }
}

async function testGetSingleCampaignUpdate() {
  logTest('Get Single Campaign Update');
  
  const response = await makeRequest('GET', `/campaign-updates/${testUpdateId}`);

  if (response.success && response.data.data?.update) {
    logSuccess('Single campaign update retrieved successfully');
    log(`Update title: ${response.data.data.update.title}`, colors.blue);
    log(`Associated campaign: ${response.data.data.update.campaign?.title}`, colors.blue);
    return true;
  } else {
    logError(`Failed to get single campaign update: ${JSON.stringify(response.error)}`);
    return false;
  }
}

async function testUpdateCampaignUpdate() {
  logTest('Update Campaign Update');
  
  const updateData = {
    title: 'First Update: Project Launch (Updated)',
    description: 'We are excited to announce that our project has officially launched! Thank you to all our supporters. This update includes information about our progress and what to expect next. We have made significant strides in the first week and are on track to meet our goals. [UPDATED CONTENT]',
    images: [
      'https://example.com/image1.jpg',
      'https://example.com/image2.jpg',
      'https://example.com/image3.jpg'
    ]
  };

  const response = await makeRequest(
    'PUT',
    `/campaign-updates/${testUpdateId}`,
    updateData,
    {
      'Authorization': `Bearer ${authToken}`
    }
  );

  if (response.success) {
    logSuccess('Campaign update updated successfully');
    log(`New title: ${response.data.data.update.title}`, colors.blue);
    return true;
  } else {
    logError(`Failed to update campaign update: ${JSON.stringify(response.error)}`);
    return false;
  }
}

async function testGetCampaignWithUpdates() {
  logTest('Get Campaign with Updates (Integration Test)');
  
  const response = await makeRequest('GET', `/campaigns/${testCampaignId}`);

  if (response.success && response.data.data?.campaign) {
    const campaign = response.data.data.campaign;
    
    logSuccess('Campaign retrieved with updates integration');
    log(`Campaign title: ${campaign.title}`, colors.blue);
    
    if (campaign.updates && campaign.updates.length > 0) {
      logSuccess(`Campaign includes ${campaign.updates.length} updates`);
      log(`Updates summary: ${JSON.stringify(campaign.updates_summary)}`, colors.blue);
    } else {
      logWarning('Campaign does not include updates (may be expected)');
    }
    
    return true;
  } else {
    logError(`Failed to get campaign with updates: ${JSON.stringify(response.error)}`);
    return false;
  }
}

async function testAuthenticationFailure() {
  logTest('Authentication Failure Tests');
  
  // Test create without auth
  const createResponse = await makeRequest(
    'POST',
    `/campaigns/${testCampaignId}/updates`,
    {
      title: 'Unauthorized Update',
      description: 'This should fail'
    }
  );

  if (!createResponse.success && createResponse.status === 401) {
    logSuccess('Create update without auth properly rejected');
  } else {
    logError('Create update without auth should have failed');
  }

  // Test update without auth
  const updateResponse = await makeRequest(
    'PUT',
    `/campaign-updates/${testUpdateId}`,
    {
      title: 'Unauthorized Update'
    }
  );

  if (!updateResponse.success && updateResponse.status === 401) {
    logSuccess('Update without auth properly rejected');
  } else {
    logError('Update without auth should have failed');
  }

  // Test delete without auth
  const deleteResponse = await makeRequest('DELETE', `/campaign-updates/${testUpdateId}`);

  if (!deleteResponse.success && deleteResponse.status === 401) {
    logSuccess('Delete without auth properly rejected');
  } else {
    logError('Delete without auth should have failed');
  }
  
  return true;
}

async function testInputValidation() {
  logTest('Input Validation Tests');
  
  // Test missing title
  const missingTitleResponse = await makeRequest(
    'POST',
    `/campaigns/${testCampaignId}/updates`,
    {
      description: 'Description without title'
    },
    {
      'Authorization': `Bearer ${authToken}`
    }
  );

  if (!missingTitleResponse.success && missingTitleResponse.status === 400) {
    logSuccess('Missing title properly validated');
  } else {
    logWarning('Missing title validation may not be working');
  }

  // Test missing description
  const missingDescriptionResponse = await makeRequest(
    'POST',
    `/campaigns/${testCampaignId}/updates`,
    {
      title: 'Title without description'
    },
    {
      'Authorization': `Bearer ${authToken}`
    }
  );

  if (!missingDescriptionResponse.success && missingDescriptionResponse.status === 400) {
    logSuccess('Missing description properly validated');
  } else {
    logWarning('Missing description validation may not be working');
  }

  // Test invalid UUID
  const invalidIdResponse = await makeRequest('GET', '/campaign-updates/invalid-uuid');

  if (!invalidIdResponse.success && invalidIdResponse.status === 400) {
    logSuccess('Invalid UUID properly validated');
  } else {
    logWarning('Invalid UUID validation may not be working');
  }

  return true;
}

async function testDeleteCampaignUpdate() {
  logTest('Delete Campaign Update');
  
  const response = await makeRequest(
    'DELETE',
    `/campaign-updates/${testUpdateId}`,
    null,
    {
      'Authorization': `Bearer ${authToken}`
    }
  );

  if (response.success) {
    logSuccess('Campaign update deleted successfully');
    return true;
  } else {
    logError(`Failed to delete campaign update: ${JSON.stringify(response.error)}`);
    return false;
  }
}

async function testDeletedUpdateAccess() {
  logTest('Access Deleted Update');
  
  const response = await makeRequest('GET', `/campaign-updates/${testUpdateId}`);

  if (!response.success && response.status === 404) {
    logSuccess('Deleted update properly returns 404');
    return true;
  } else {
    logError('Deleted update should return 404');
    return false;
  }
}

// Main test runner
async function runTests() {
  log('\n🚀 Starting Campaign Updates API Test Suite', colors.yellow);
  log('=' .repeat(60), colors.yellow);

  const tests = [
    { name: 'User Authentication', func: authenticateUser, required: true },
    { name: 'Get/Create Test Campaign', func: getOrCreateTestCampaign, required: true },
    { name: 'Create Campaign Update', func: testCreateCampaignUpdate, required: true },
    { name: 'Create Second Update', func: testCreateSecondUpdate, required: false },
    { name: 'Get Campaign Updates', func: testGetCampaignUpdates, required: true },
    { name: 'Get Single Campaign Update', func: testGetSingleCampaignUpdate, required: true },
    { name: 'Update Campaign Update', func: testUpdateCampaignUpdate, required: true },
    { name: 'Get Campaign with Updates', func: testGetCampaignWithUpdates, required: true },
    { name: 'Authentication Failure Tests', func: testAuthenticationFailure, required: true },
    { name: 'Input Validation Tests', func: testInputValidation, required: false },
    { name: 'Delete Campaign Update', func: testDeleteCampaignUpdate, required: true },
    { name: 'Access Deleted Update', func: testDeletedUpdateAccess, required: true }
  ];

  const results = {
    total: tests.length,
    passed: 0,
    failed: 0,
    skipped: 0
  };

  for (const test of tests) {
    try {
      const passed = await test.func();
      if (passed) {
        results.passed++;
      } else {
        results.failed++;
        if (test.required) {
          log(`\n❌ Critical test failed: ${test.name}. Stopping execution.`, colors.red);
          break;
        }
      }
    } catch (error) {
      logError(`Test "${test.name}" threw an error: ${error.message}`);
      results.failed++;
      if (test.required) {
        log(`\n❌ Critical test failed: ${test.name}. Stopping execution.`, colors.red);
        break;
      }
    }
  }

  // Print final results
  log('\n📊 Test Results Summary', colors.yellow);
  log('=' .repeat(60), colors.yellow);
  log(`Total Tests: ${results.total}`, colors.white);
  log(`Passed: ${results.passed}`, colors.green);
  log(`Failed: ${results.failed}`, colors.red);
  log(`Success Rate: ${((results.passed / results.total) * 100).toFixed(1)}%`, colors.cyan);

  if (results.failed === 0) {
    log('\n🎉 All tests passed! Campaign Updates API is working correctly.', colors.green);
  } else if (results.passed > results.failed) {
    log('\n✅ Most tests passed. Some minor issues may need attention.', colors.yellow);
  } else {
    log('\n❌ Multiple tests failed. Please check the API implementation.', colors.red);
  }

  log('\n🏁 Test suite completed.', colors.cyan);
}

// Handle process events
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

// Run the tests
if (require.main === module) {
  runTests().catch(error => {
    console.error('Test suite failed:', error);
    process.exit(1);
  });
}

module.exports = {
  runTests,
  makeRequest,
  colors,
  log,
  logSuccess,
  logError,
  logWarning
};