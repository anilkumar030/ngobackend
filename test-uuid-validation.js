#!/usr/bin/env node

/**
 * Test script to verify UUID validation fixes for donation endpoints
 * 
 * This script tests the fix for the error:
 * "invalid input syntax for type uuid: 'statistics'"
 * 
 * Run with: node test-uuid-validation.js
 */

const axios = require('axios');

// Configuration
const BASE_URL = process.env.API_BASE_URL || 'http://localhost:5000';
const API_URL = `${BASE_URL}/api`;

// Test data - invalid UUID strings that should fail validation
const INVALID_UUIDS = [
  'statistics',
  'invalid-uuid',
  '123',
  'not-a-uuid-at-all',
  '12345678-1234-1234-1234-12345678901', // Too short
  '12345678-1234-1234-1234-123456789012z', // Invalid character
];

// Valid UUID for positive test
const VALID_UUID = '550e8400-e29b-41d4-a716-446655440000';

// Test results tracking
const testResults = {
  total: 0,
  passed: 0,
  failed: 0,
  errors: []
};

/**
 * Test function for invalid UUID validation
 */
async function testInvalidUUID(endpoint, invalidUuid) {
  try {
    testResults.total++;
    console.log(`\n🧪 Testing ${endpoint} with invalid UUID: "${invalidUuid}"`);
    
    const response = await axios.get(`${API_URL}${endpoint}/${invalidUuid}`, {
      timeout: 5000,
      validateStatus: function (status) {
        // Accept any status code to handle the response properly
        return true;
      }
    });
    
    // Check if we got the expected 400 validation error
    if (response.status === 400) {
      const errorData = response.data;
      
      // Check if the error message indicates UUID validation
      if (errorData.errors && 
          errorData.errors.params && 
          errorData.errors.params.some(err => 
            err.message.includes('Invalid ID format') || 
            err.message.includes('UUID')
          )) {
        console.log('✅ PASS: Got expected validation error (400)');
        console.log(`   Error: ${errorData.message}`);
        testResults.passed++;
        return true;
      } else {
        console.log('❌ FAIL: Got 400 but wrong error structure');
        console.log('   Response:', JSON.stringify(errorData, null, 2));
        testResults.failed++;
        testResults.errors.push({
          test: `${endpoint}/${invalidUuid}`,
          expected: 'UUID validation error',
          actual: 'Wrong error structure'
        });
        return false;
      }
    } else if (response.status === 500) {
      // This indicates the old error (UUID database error) still exists
      console.log('❌ FAIL: Got 500 error - UUID validation not working');
      console.log('   This suggests the original error still exists');
      testResults.failed++;
      testResults.errors.push({
        test: `${endpoint}/${invalidUuid}`,
        expected: '400 validation error',
        actual: '500 server error - original bug still present'
      });
      return false;
    } else {
      console.log(`❌ FAIL: Got unexpected status ${response.status}`);
      console.log('   Response:', JSON.stringify(response.data, null, 2));
      testResults.failed++;
      testResults.errors.push({
        test: `${endpoint}/${invalidUuid}`,
        expected: '400 validation error',
        actual: `${response.status} status`
      });
      return false;
    }
    
  } catch (error) {
    if (error.code === 'ECONNREFUSED') {
      console.log('❌ FAIL: Cannot connect to server');
      console.log('   Make sure the server is running on', BASE_URL);
      testResults.failed++;
      testResults.errors.push({
        test: `${endpoint}/${invalidUuid}`,
        expected: 'Server response',
        actual: 'Connection refused'
      });
      return false;
    } else if (error.response && error.response.status === 400) {
      // Axios threw an error for 400 status, which is expected
      console.log('✅ PASS: Got expected validation error (400)');
      testResults.passed++;
      return true;
    } else {
      console.log('❌ FAIL: Unexpected error');
      console.log('   Error:', error.message);
      testResults.failed++;
      testResults.errors.push({
        test: `${endpoint}/${invalidUuid}`,
        expected: '400 validation error',
        actual: error.message
      });
      return false;
    }
  }
}

/**
 * Test function for valid UUID (should reach controller and return 404/403)
 */
async function testValidUUID(endpoint, validUuid) {
  try {
    testResults.total++;
    console.log(`\n🧪 Testing ${endpoint} with valid UUID: "${validUuid}"`);
    
    const response = await axios.get(`${API_URL}${endpoint}/${validUuid}`, {
      timeout: 5000,
      validateStatus: function (status) {
        return true; // Accept any status
      }
    });
    
    // For valid UUID, we expect to reach the controller
    // We might get 401 (unauthorized), 403 (forbidden), or 404 (not found)
    // But NOT 400 (validation error) or 500 (database UUID error)
    if ([401, 403, 404].includes(response.status)) {
      console.log(`✅ PASS: Valid UUID reached controller (${response.status})`);
      console.log('   This means UUID validation passed successfully');
      testResults.passed++;
      return true;
    } else if (response.status === 400) {
      console.log('❌ FAIL: Valid UUID failed validation');
      console.log('   Response:', JSON.stringify(response.data, null, 2));
      testResults.failed++;
      testResults.errors.push({
        test: `${endpoint}/${validUuid}`,
        expected: '401/403/404 (controller response)',
        actual: '400 validation error'
      });
      return false;
    } else if (response.status === 500) {
      console.log('❌ FAIL: Server error with valid UUID');
      console.log('   Response:', JSON.stringify(response.data, null, 2));
      testResults.failed++;
      testResults.errors.push({
        test: `${endpoint}/${validUuid}`,
        expected: '401/403/404 (controller response)',
        actual: '500 server error'
      });
      return false;
    } else {
      console.log(`✅ PASS: Got status ${response.status} - UUID validation working`);
      testResults.passed++;
      return true;
    }
    
  } catch (error) {
    if (error.code === 'ECONNREFUSED') {
      console.log('❌ FAIL: Cannot connect to server');
      testResults.failed++;
      testResults.errors.push({
        test: `${endpoint}/${validUuid}`,
        expected: 'Server response',
        actual: 'Connection refused'
      });
      return false;
    } else {
      console.log('❌ FAIL: Unexpected error');
      console.log('   Error:', error.message);
      testResults.failed++;
      testResults.errors.push({
        test: `${endpoint}/${validUuid}`,
        expected: 'Controller response',
        actual: error.message
      });
      return false;
    }
  }
}

/**
 * Main test function
 */
async function runTests() {
  console.log('🚀 Starting UUID Validation Tests');
  console.log('=====================================');
  console.log(`Testing API at: ${API_URL}`);
  console.log('');

  // First, let's test the most common scenario that might have caused the original error
  // Testing if there's a route that could interpret "statistics" as an ID
  
  console.log('🔍 Testing the original error scenario');
  console.log('-------------------------------------');
  
  // Test the specific endpoint pattern that might have caused the issue
  try {
    console.log('Testing if /api/donations/statistics exists...');
    const response = await axios.get(`${API_URL}/donations/statistics`, {
      timeout: 5000,
      validateStatus: () => true
    });
    
    if (response.status === 404) {
      console.log('✅ Good: /api/donations/statistics returns 404 (route not found)');
    } else if (response.status === 400) {
      console.log('✅ Good: Route exists but returns validation error');
      console.log('   Response:', JSON.stringify(response.data, null, 2));
    } else {
      console.log(`⚠️  Route responds with status ${response.status}`);
      console.log('   Response:', JSON.stringify(response.data, null, 2));
    }
  } catch (error) {
    console.log('❌ Error testing /api/donations/statistics:', error.message);
  }

  // Test endpoints that use UUID parameters
  const endpoints = [
    '/payment/donations',
    '/payment/orders',
  ];

  // Test invalid UUIDs
  console.log('📋 Testing Invalid UUID Rejection');
  console.log('----------------------------------');
  
  for (const endpoint of endpoints) {
    for (const invalidUuid of INVALID_UUIDS) {
      await testInvalidUUID(endpoint, invalidUuid);
      await new Promise(resolve => setTimeout(resolve, 100)); // Small delay
    }
  }

  // Test valid UUID
  console.log('\n📋 Testing Valid UUID Acceptance');
  console.log('----------------------------------');
  
  for (const endpoint of endpoints) {
    await testValidUUID(endpoint, VALID_UUID);
    await new Promise(resolve => setTimeout(resolve, 100)); // Small delay
  }

  // Print results
  console.log('\n📊 Test Results');
  console.log('================');
  console.log(`Total Tests: ${testResults.total}`);
  console.log(`Passed: ${testResults.passed}`);
  console.log(`Failed: ${testResults.failed}`);
  console.log(`Success Rate: ${((testResults.passed / testResults.total) * 100).toFixed(1)}%`);

  if (testResults.failed > 0) {
    console.log('\n❌ Failed Tests:');
    testResults.errors.forEach((error, index) => {
      console.log(`${index + 1}. ${error.test}`);
      console.log(`   Expected: ${error.expected}`);
      console.log(`   Actual: ${error.actual}`);
    });
  }

  if (testResults.failed === 0) {
    console.log('\n🎉 All tests passed! UUID validation is working correctly.');
    console.log('   The original error "invalid input syntax for type uuid: \'statistics\'" should be fixed.');
  } else {
    console.log('\n⚠️  Some tests failed. Please check the implementation.');
  }

  return testResults.failed === 0;
}

// Run the tests
if (require.main === module) {
  runTests()
    .then((success) => {
      process.exit(success ? 0 : 1);
    })
    .catch((error) => {
      console.error('❌ Test runner error:', error);
      process.exit(1);
    });
}

module.exports = { runTests, testInvalidUUID, testValidUUID };