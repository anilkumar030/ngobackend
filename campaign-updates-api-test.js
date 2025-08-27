#!/usr/bin/env node

/**
 * Comprehensive Campaign Updates API Test Suite
 * Tests all endpoints with various scenarios including validation, security, and edge cases
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');

// Test configuration
const BASE_URL = 'http://localhost:8090';
const API_BASE = `${BASE_URL}/api`;
const ACCESS_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2ZWRhMWE2ZC02NzI4LTRkOWMtYWM5ZC0wZTVhMDcyNmE0OTAiLCJlbWFpbCI6ImFkbWluQHNoaXZkaGFhbS5vcmciLCJyb2xlIjoic3VwZXJfYWRtaW4iLCJ0eXBlIjoiYWNjZXNzIiwiaWF0IjoxNzU1MjY0NzI1LCJleHAiOjE3NTUzNTExMjV9.l6QxSeXx_kNc6BcLnIedZWLRKABt3bMSOCkASl3NpyE';

// Test campaign ID (using first campaign from the list)
const TEST_CAMPAIGN_ID = '7f34e1d7-ba85-42fc-9278-24976f318432';

// Test results storage
const testResults = {
  summary: {
    totalTests: 0,
    passed: 0,
    failed: 0,
    skipped: 0,
    startTime: new Date().toISOString(),
    endTime: null
  },
  categories: {
    authentication: { passed: 0, failed: 0, tests: [] },
    validation: { passed: 0, failed: 0, tests: [] },
    functionality: { passed: 0, failed: 0, tests: [] },
    security: { passed: 0, failed: 0, tests: [] },
    performance: { passed: 0, failed: 0, tests: [] },
    edgeCases: { passed: 0, failed: 0, tests: [] }
  },
  createdUpdates: [],
  errors: []
};

// Utility functions
const log = (message, type = 'info') => {
  const timestamp = new Date().toISOString();
  const colors = {
    info: '\x1b[36m',    // cyan
    success: '\x1b[32m',  // green
    error: '\x1b[31m',    // red
    warn: '\x1b[33m',     // yellow
    reset: '\x1b[0m'      // reset
  };
  
  console.log(`${colors[type]}[${timestamp}] ${message}${colors.reset}`);
};

const makeRequest = async (method, endpoint, data = null, headers = {}) => {
  const config = {
    method,
    url: `${API_BASE}${endpoint}`,
    headers: {
      'Content-Type': 'application/json',
      ...headers
    }
  };
  
  if (data) {
    config.data = data;
  }
  
  try {
    const response = await axios(config);
    return {
      success: true,
      status: response.status,
      data: response.data,
      headers: response.headers
    };
  } catch (error) {
    return {
      success: false,
      status: error.response?.status || 0,
      data: error.response?.data || null,
      error: error.message,
      headers: error.response?.headers || {}
    };
  }
};

const runTest = async (testName, category, testFunction) => {
  testResults.summary.totalTests++;
  
  try {
    log(`Running test: ${testName}`, 'info');
    const startTime = Date.now();
    
    const result = await testFunction();
    
    const duration = Date.now() - startTime;
    const testResult = {
      name: testName,
      status: result.passed ? 'PASSED' : 'FAILED',
      duration,
      details: result.details || {},
      errors: result.errors || [],
      timestamp: new Date().toISOString()
    };
    
    testResults.categories[category].tests.push(testResult);
    
    if (result.passed) {
      testResults.summary.passed++;
      testResults.categories[category].passed++;
      log(`✅ PASSED: ${testName} (${duration}ms)`, 'success');
    } else {
      testResults.summary.failed++;
      testResults.categories[category].failed++;
      log(`❌ FAILED: ${testName} (${duration}ms)`, 'error');
      if (result.errors.length > 0) {
        result.errors.forEach(error => log(`   Error: ${error}`, 'error'));
      }
    }
    
    return testResult;
  } catch (error) {
    testResults.summary.failed++;
    testResults.categories[category].failed++;
    
    const testResult = {
      name: testName,
      status: 'ERROR',
      duration: 0,
      details: {},
      errors: [error.message],
      timestamp: new Date().toISOString()
    };
    
    testResults.categories[category].tests.push(testResult);
    log(`💥 ERROR: ${testName} - ${error.message}`, 'error');
    
    return testResult;
  }
};

// Test implementations
const tests = {
  authentication: {
    'Valid admin token authentication': async () => {
      const response = await makeRequest('GET', `/campaigns/${TEST_CAMPAIGN_ID}/updates`, null, {
        'Authorization': `Bearer ${ACCESS_TOKEN}`
      });
      
      return {
        passed: response.success,
        details: { 
          status: response.status,
          hasAuth: !!response.data?.success
        },
        errors: response.success ? [] : [response.error || 'Authentication failed']
      };
    },

    'Invalid token handling': async () => {
      const response = await makeRequest('POST', `/campaigns/${TEST_CAMPAIGN_ID}/updates`, {
        title: 'Test Update',
        description: 'This is a test update for invalid token testing'
      }, {
        'Authorization': 'Bearer invalid-token'
      });
      
      return {
        passed: !response.success && response.status === 401,
        details: { 
          status: response.status,
          expectedUnauthorized: true
        },
        errors: response.status === 401 ? [] : [`Expected 401, got ${response.status}`]
      };
    },

    'Missing authorization header': async () => {
      const response = await makeRequest('POST', `/campaigns/${TEST_CAMPAIGN_ID}/updates`, {
        title: 'Test Update',
        description: 'This is a test update for missing auth testing'
      });
      
      return {
        passed: !response.success && response.status === 401,
        details: { 
          status: response.status,
          expectedUnauthorized: true
        },
        errors: response.status === 401 ? [] : [`Expected 401, got ${response.status}`]
      };
    }
  },

  validation: {
    'Title validation - minimum length': async () => {
      const response = await makeRequest('POST', `/campaigns/${TEST_CAMPAIGN_ID}/updates`, {
        title: 'ab', // Too short
        description: 'This is a valid description that meets minimum requirements'
      }, {
        'Authorization': `Bearer ${ACCESS_TOKEN}`
      });
      
      return {
        passed: !response.success && response.status === 400,
        details: { 
          status: response.status,
          errorMessage: response.data?.message
        },
        errors: response.status === 400 ? [] : [`Expected 400 validation error, got ${response.status}`]
      };
    },

    'Title validation - maximum length': async () => {
      const longTitle = 'a'.repeat(501); // Too long
      const response = await makeRequest('POST', `/campaigns/${TEST_CAMPAIGN_ID}/updates`, {
        title: longTitle,
        description: 'This is a valid description that meets minimum requirements'
      }, {
        'Authorization': `Bearer ${ACCESS_TOKEN}`
      });
      
      return {
        passed: !response.success && response.status === 400,
        details: { 
          status: response.status,
          titleLength: longTitle.length
        },
        errors: response.status === 400 ? [] : [`Expected 400 validation error, got ${response.status}`]
      };
    },

    'Description validation - minimum length': async () => {
      const response = await makeRequest('POST', `/campaigns/${TEST_CAMPAIGN_ID}/updates`, {
        title: 'Valid Title',
        description: 'short' // Too short
      }, {
        'Authorization': `Bearer ${ACCESS_TOKEN}`
      });
      
      return {
        passed: !response.success && response.status === 400,
        details: { 
          status: response.status,
          errorMessage: response.data?.message
        },
        errors: response.status === 400 ? [] : [`Expected 400 validation error, got ${response.status}`]
      };
    },

    'Description validation - maximum length': async () => {
      const longDescription = 'a'.repeat(50001); // Too long
      const response = await makeRequest('POST', `/campaigns/${TEST_CAMPAIGN_ID}/updates`, {
        title: 'Valid Title',
        description: longDescription
      }, {
        'Authorization': `Bearer ${ACCESS_TOKEN}`
      });
      
      return {
        passed: !response.success && response.status === 400,
        details: { 
          status: response.status,
          descriptionLength: longDescription.length
        },
        errors: response.status === 400 ? [] : [`Expected 400 validation error, got ${response.status}`]
      };
    },

    'Invalid campaign ID format': async () => {
      const response = await makeRequest('POST', '/campaigns/invalid-uuid/updates', {
        title: 'Valid Title',
        description: 'This is a valid description for testing invalid campaign ID'
      }, {
        'Authorization': `Bearer ${ACCESS_TOKEN}`
      });
      
      return {
        passed: !response.success && response.status === 400,
        details: { 
          status: response.status,
          errorMessage: response.data?.message
        },
        errors: response.status === 400 ? [] : [`Expected 400 validation error, got ${response.status}`]
      };
    },

    'Images array validation - invalid format': async () => {
      const response = await makeRequest('POST', `/campaigns/${TEST_CAMPAIGN_ID}/updates`, {
        title: 'Valid Title',
        description: 'This is a valid description for testing invalid images',
        images: 'not-an-array'
      }, {
        'Authorization': `Bearer ${ACCESS_TOKEN}`
      });
      
      return {
        passed: !response.success && response.status === 400,
        details: { 
          status: response.status,
          errorMessage: response.data?.message
        },
        errors: response.status === 400 ? [] : [`Expected 400 validation error, got ${response.status}`]
      };
    },

    'Images array validation - invalid URLs': async () => {
      const response = await makeRequest('POST', `/campaigns/${TEST_CAMPAIGN_ID}/updates`, {
        title: 'Valid Title',
        description: 'This is a valid description for testing invalid image URLs',
        images: ['not-a-valid-url', 'also-not-valid']
      }, {
        'Authorization': `Bearer ${ACCESS_TOKEN}`
      });
      
      return {
        passed: !response.success && response.status === 400,
        details: { 
          status: response.status,
          errorMessage: response.data?.message
        },
        errors: response.status === 400 ? [] : [`Expected 400 validation error, got ${response.status}`]
      };
    }
  },

  functionality: {
    'Create campaign update - valid data': async () => {
      const updateData = {
        title: 'Test Campaign Update ' + Date.now(),
        description: 'This is a comprehensive test update to verify that campaign update creation works correctly. This description meets all the minimum requirements and provides sufficient detail for testing purposes.',
        images: [
          'https://example.com/image1.jpg',
          'https://example.com/image2.jpg'
        ]
      };
      
      const response = await makeRequest('POST', `/campaigns/${TEST_CAMPAIGN_ID}/updates`, updateData, {
        'Authorization': `Bearer ${ACCESS_TOKEN}`
      });
      
      if (response.success && response.data?.data?.update) {
        testResults.createdUpdates.push(response.data.data.update);
      }
      
      return {
        passed: response.success && response.status === 201,
        details: { 
          status: response.status,
          updateId: response.data?.data?.update?.id,
          hasImages: response.data?.data?.update?.images?.length > 0
        },
        errors: response.success ? [] : [response.error || 'Failed to create update']
      };
    },

    'Create campaign update - empty images array': async () => {
      const updateData = {
        title: 'Test Update No Images ' + Date.now(),
        description: 'This is a test update without any images to verify that empty images array works correctly.',
        images: []
      };
      
      const response = await makeRequest('POST', `/campaigns/${TEST_CAMPAIGN_ID}/updates`, updateData, {
        'Authorization': `Bearer ${ACCESS_TOKEN}`
      });
      
      if (response.success && response.data?.data?.update) {
        testResults.createdUpdates.push(response.data.data.update);
      }
      
      return {
        passed: response.success && response.status === 201,
        details: { 
          status: response.status,
          updateId: response.data?.data?.update?.id,
          imagesCount: response.data?.data?.update?.images?.length || 0
        },
        errors: response.success ? [] : [response.error || 'Failed to create update']
      };
    },

    'Get campaign updates with pagination': async () => {
      const response = await makeRequest('GET', `/campaigns/${TEST_CAMPAIGN_ID}/updates?page=1&limit=5&sort_by=created_at&sort_order=desc`);
      
      return {
        passed: response.success && response.status === 200,
        details: { 
          status: response.status,
          updatesCount: response.data?.data?.updates?.length || 0,
          hasPagination: !!response.data?.data?.pagination,
          currentPage: response.data?.data?.pagination?.current_page,
          totalPages: response.data?.data?.pagination?.total_pages
        },
        errors: response.success ? [] : [response.error || 'Failed to get updates']
      };
    },

    'Get specific campaign update': async () => {
      if (testResults.createdUpdates.length === 0) {
        return {
          passed: false,
          details: {},
          errors: ['No updates available to test - create test failed']
        };
      }
      
      const updateId = testResults.createdUpdates[0].id;
      const response = await makeRequest('GET', `/campaign-updates/${updateId}`);
      
      return {
        passed: response.success && response.status === 200,
        details: { 
          status: response.status,
          updateId: response.data?.data?.update?.id,
          hasTitle: !!response.data?.data?.update?.title,
          hasDescription: !!response.data?.data?.update?.description
        },
        errors: response.success ? [] : [response.error || 'Failed to get update']
      };
    },

    'Update campaign update': async () => {
      if (testResults.createdUpdates.length === 0) {
        return {
          passed: false,
          details: {},
          errors: ['No updates available to test - create test failed']
        };
      }
      
      const updateId = testResults.createdUpdates[0].id;
      const updateData = {
        title: 'Updated Title ' + Date.now(),
        description: 'This is an updated description to verify that campaign updates can be modified correctly.',
        images: ['https://example.com/updated-image.jpg']
      };
      
      const response = await makeRequest('PUT', `/campaign-updates/${updateId}`, updateData, {
        'Authorization': `Bearer ${ACCESS_TOKEN}`
      });
      
      return {
        passed: response.success && response.status === 200,
        details: { 
          status: response.status,
          updateId: response.data?.data?.update?.id,
          updatedTitle: response.data?.data?.update?.title
        },
        errors: response.success ? [] : [response.error || 'Failed to update']
      };
    },

    'Test campaign details include updates': async () => {
      const response = await makeRequest('GET', `/campaigns/${TEST_CAMPAIGN_ID}`, null, {
        'Authorization': `Bearer ${ACCESS_TOKEN}`
      });
      
      return {
        passed: response.success && response.status === 200,
        details: { 
          status: response.status,
          campaignId: response.data?.data?.campaign?.id,
          hasUpdates: response.data?.data?.campaign?.updates !== undefined,
          updatesCount: response.data?.data?.campaign?.updates?.length || 0
        },
        errors: response.success ? [] : [response.error || 'Failed to get campaign']
      };
    }
  },

  security: {
    'Unauthorized access to protected endpoints': async () => {
      const tests = [
        { method: 'POST', endpoint: `/campaigns/${TEST_CAMPAIGN_ID}/updates` },
        { method: 'PUT', endpoint: '/campaign-updates/test-id' },
        { method: 'DELETE', endpoint: '/campaign-updates/test-id' }
      ];
      
      let allPassed = true;
      const details = {};
      const errors = [];
      
      for (const test of tests) {
        const response = await makeRequest(test.method, test.endpoint, {
          title: 'Test',
          description: 'Test description for security testing'
        });
        
        if (response.status !== 401) {
          allPassed = false;
          errors.push(`${test.method} ${test.endpoint} should return 401, got ${response.status}`);
        }
        
        details[`${test.method}_${test.endpoint}`] = response.status;
      }
      
      return {
        passed: allPassed,
        details,
        errors
      };
    },

    'SQL injection attempts in parameters': async () => {
      const maliciousIds = [
        "'; DROP TABLE campaignupdates; --",
        "1' OR '1'='1",
        "' UNION SELECT * FROM users --"
      ];
      
      let allPassed = true;
      const details = {};
      const errors = [];
      
      for (const maliciousId of maliciousIds) {
        const response = await makeRequest('GET', `/campaign-updates/${encodeURIComponent(maliciousId)}`);
        
        // Should return 400 (validation error) or 404 (not found), not 500 (server error)
        if (response.status === 500) {
          allPassed = false;
          errors.push(`SQL injection attempt caused server error: ${maliciousId}`);
        }
        
        details[`injection_${maliciousIds.indexOf(maliciousId)}`] = response.status;
      }
      
      return {
        passed: allPassed,
        details,
        errors
      };
    },

    'XSS attempts in request body': async () => {
      const xssPayloads = [
        '<script>alert("xss")</script>',
        'javascript:alert("xss")',
        '<img src="x" onerror="alert(\'xss\')">'
      ];
      
      let allPassed = true;
      const details = {};
      const errors = [];
      
      for (const payload of xssPayloads) {
        const response = await makeRequest('POST', `/campaigns/${TEST_CAMPAIGN_ID}/updates`, {
          title: payload,
          description: 'Test description with XSS attempt for security validation testing'
        }, {
          'Authorization': `Bearer ${ACCESS_TOKEN}`
        });
        
        // Should either reject the request or sanitize the input
        if (response.success && response.data?.data?.update?.title === payload) {
          allPassed = false;
          errors.push(`XSS payload not sanitized: ${payload}`);
        }
        
        details[`xss_${xssPayloads.indexOf(payload)}`] = {
          status: response.status,
          sanitized: response.success ? response.data?.data?.update?.title !== payload : true
        };
      }
      
      return {
        passed: allPassed,
        details,
        errors
      };
    }
  },

  performance: {
    'Response time for update creation': async () => {
      const startTime = Date.now();
      
      const response = await makeRequest('POST', `/campaigns/${TEST_CAMPAIGN_ID}/updates`, {
        title: 'Performance Test Update ' + Date.now(),
        description: 'This is a performance test update to measure response time for campaign update creation endpoint'
      }, {
        'Authorization': `Bearer ${ACCESS_TOKEN}`
      });
      
      const responseTime = Date.now() - startTime;
      
      if (response.success && response.data?.data?.update) {
        testResults.createdUpdates.push(response.data.data.update);
      }
      
      return {
        passed: response.success && responseTime < 5000, // Should respond within 5 seconds
        details: { 
          status: response.status,
          responseTime,
          acceptable: responseTime < 5000
        },
        errors: responseTime >= 5000 ? [`Response time too slow: ${responseTime}ms`] : []
      };
    },

    'Pagination performance with large datasets': async () => {
      const startTime = Date.now();
      
      const response = await makeRequest('GET', `/campaigns/${TEST_CAMPAIGN_ID}/updates?page=1&limit=50`);
      
      const responseTime = Date.now() - startTime;
      
      return {
        passed: response.success && responseTime < 3000, // Should respond within 3 seconds
        details: { 
          status: response.status,
          responseTime,
          itemsReturned: response.data?.data?.updates?.length || 0
        },
        errors: responseTime >= 3000 ? [`Pagination too slow: ${responseTime}ms`] : []
      };
    }
  },

  edgeCases: {
    'Non-existent campaign ID': async () => {
      const fakeId = '12345678-1234-1234-1234-123456789012';
      const response = await makeRequest('POST', `/campaigns/${fakeId}/updates`, {
        title: 'Test Update',
        description: 'This is a test update for non-existent campaign'
      }, {
        'Authorization': `Bearer ${ACCESS_TOKEN}`
      });
      
      return {
        passed: !response.success && response.status === 404,
        details: { 
          status: response.status,
          errorMessage: response.data?.message
        },
        errors: response.status === 404 ? [] : [`Expected 404, got ${response.status}`]
      };
    },

    'Non-existent update ID': async () => {
      const fakeId = '12345678-1234-1234-1234-123456789012';
      const response = await makeRequest('GET', `/campaign-updates/${fakeId}`);
      
      return {
        passed: !response.success && response.status === 404,
        details: { 
          status: response.status,
          errorMessage: response.data?.message
        },
        errors: response.status === 404 ? [] : [`Expected 404, got ${response.status}`]
      };
    },

    'Delete non-existent update': async () => {
      const fakeId = '12345678-1234-1234-1234-123456789012';
      const response = await makeRequest('DELETE', `/campaign-updates/${fakeId}`, null, {
        'Authorization': `Bearer ${ACCESS_TOKEN}`
      });
      
      return {
        passed: !response.success && response.status === 404,
        details: { 
          status: response.status,
          errorMessage: response.data?.message
        },
        errors: response.status === 404 ? [] : [`Expected 404, got ${response.status}`]
      };
    },

    'Empty request body': async () => {
      const response = await makeRequest('POST', `/campaigns/${TEST_CAMPAIGN_ID}/updates`, {}, {
        'Authorization': `Bearer ${ACCESS_TOKEN}`
      });
      
      return {
        passed: !response.success && response.status === 400,
        details: { 
          status: response.status,
          errorMessage: response.data?.message
        },
        errors: response.status === 400 ? [] : [`Expected 400, got ${response.status}`]
      };
    },

    'Update with partial data': async () => {
      if (testResults.createdUpdates.length === 0) {
        return {
          passed: false,
          details: {},
          errors: ['No updates available to test - create test failed']
        };
      }
      
      const updateId = testResults.createdUpdates[0].id;
      const response = await makeRequest('PUT', `/campaign-updates/${updateId}`, {
        title: 'Only Title Updated ' + Date.now()
      }, {
        'Authorization': `Bearer ${ACCESS_TOKEN}`
      });
      
      return {
        passed: response.success && response.status === 200,
        details: { 
          status: response.status,
          updateId: response.data?.data?.update?.id,
          partialUpdate: true
        },
        errors: response.success ? [] : [response.error || 'Partial update failed']
      };
    },

    'Very large images array': async () => {
      const largeImagesArray = Array.from({ length: 15 }, (_, i) => `https://example.com/image${i}.jpg`);
      
      const response = await makeRequest('POST', `/campaigns/${TEST_CAMPAIGN_ID}/updates`, {
        title: 'Large Images Array Test',
        description: 'Testing with a large images array to verify limits are enforced',
        images: largeImagesArray
      }, {
        'Authorization': `Bearer ${ACCESS_TOKEN}`
      });
      
      return {
        passed: !response.success && response.status === 400,
        details: { 
          status: response.status,
          imagesCount: largeImagesArray.length,
          errorMessage: response.data?.message
        },
        errors: response.status === 400 ? [] : [`Expected 400 for too many images, got ${response.status}`]
      };
    }
  }
};

// Cleanup function to delete created updates
const cleanup = async () => {
  log('Starting cleanup of created test updates...', 'info');
  
  let deletedCount = 0;
  for (const update of testResults.createdUpdates) {
    try {
      const response = await makeRequest('DELETE', `/campaign-updates/${update.id}`, null, {
        'Authorization': `Bearer ${ACCESS_TOKEN}`
      });
      
      if (response.success) {
        deletedCount++;
        log(`✅ Deleted update: ${update.id}`, 'success');
      } else {
        log(`❌ Failed to delete update: ${update.id}`, 'warn');
      }
    } catch (error) {
      log(`💥 Error deleting update ${update.id}: ${error.message}`, 'error');
    }
  }
  
  log(`🧹 Cleanup completed. Deleted ${deletedCount}/${testResults.createdUpdates.length} updates`, 'info');
};

// Main test runner
const runAllTests = async () => {
  log('🚀 Starting Campaign Updates API Comprehensive Test Suite', 'info');
  log(`📍 Testing against: ${API_BASE}`, 'info');
  log(`🎯 Test Campaign ID: ${TEST_CAMPAIGN_ID}`, 'info');
  log('=' * 80, 'info');
  
  // Run tests by category
  for (const [category, categoryTests] of Object.entries(tests)) {
    log(`\n📂 Testing Category: ${category.toUpperCase()}`, 'info');
    log('-' * 50, 'info');
    
    for (const [testName, testFunction] of Object.entries(categoryTests)) {
      await runTest(testName, category, testFunction);
    }
  }
  
  // Update end time
  testResults.summary.endTime = new Date().toISOString();
  
  // Generate and save report
  const report = generateReport();
  const reportPath = path.join(__dirname, `campaign-updates-test-report-${Date.now()}.json`);
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  
  // Print summary
  printSummary();
  
  log(`\n📊 Detailed report saved to: ${reportPath}`, 'info');
  
  // Cleanup created resources
  await cleanup();
  
  // Exit with appropriate code
  process.exit(testResults.summary.failed > 0 ? 1 : 0);
};

const generateReport = () => {
  return {
    ...testResults,
    testConfiguration: {
      baseUrl: BASE_URL,
      apiBase: API_BASE,
      testCampaignId: TEST_CAMPAIGN_ID,
      nodeVersion: process.version,
      platform: process.platform,
      timestamp: new Date().toISOString()
    }
  };
};

const printSummary = () => {
  const { summary, categories } = testResults;
  
  log('\n' + '=' * 80, 'info');
  log('📊 TEST EXECUTION SUMMARY', 'info');
  log('=' * 80, 'info');
  
  log(`⏱️  Duration: ${new Date(summary.endTime) - new Date(summary.startTime)}ms`, 'info');
  log(`📈 Total Tests: ${summary.totalTests}`, 'info');
  log(`✅ Passed: ${summary.passed}`, 'success');
  log(`❌ Failed: ${summary.failed}`, summary.failed > 0 ? 'error' : 'info');
  log(`⏭️  Skipped: ${summary.skipped}`, 'warn');
  log(`🎯 Success Rate: ${((summary.passed / summary.totalTests) * 100).toFixed(1)}%`, 'info');
  
  log('\n📂 RESULTS BY CATEGORY:', 'info');
  log('-' * 50, 'info');
  
  Object.entries(categories).forEach(([category, results]) => {
    const total = results.passed + results.failed;
    const successRate = total > 0 ? ((results.passed / total) * 100).toFixed(1) : '0.0';
    
    log(`📋 ${category.toUpperCase()}: ${results.passed}/${total} (${successRate}%)`, 
         results.failed > 0 ? 'warn' : 'success');
    
    if (results.failed > 0) {
      results.tests
        .filter(test => test.status === 'FAILED' || test.status === 'ERROR')
        .forEach(test => {
          log(`   ❌ ${test.name}`, 'error');
          test.errors.forEach(error => log(`      💬 ${error}`, 'error'));
        });
    }
  });
  
  if (testResults.createdUpdates.length > 0) {
    log(`\n🔧 Created ${testResults.createdUpdates.length} test updates during testing`, 'info');
  }
  
  log('\n' + '=' * 80, 'info');
};

// Error handling
process.on('unhandledRejection', (reason, promise) => {
  log(`Unhandled Rejection at: ${promise}, reason: ${reason}`, 'error');
  testResults.errors.push(`Unhandled Rejection: ${reason}`);
});

process.on('uncaughtException', (error) => {
  log(`Uncaught Exception: ${error.message}`, 'error');
  testResults.errors.push(`Uncaught Exception: ${error.message}`);
  process.exit(1);
});

// Run the tests
if (require.main === module) {
  runAllTests().catch(error => {
    log(`💥 Fatal error: ${error.message}`, 'error');
    process.exit(1);
  });
}

module.exports = { runAllTests, testResults };