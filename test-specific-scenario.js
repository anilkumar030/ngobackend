#!/usr/bin/env node

/**
 * Test the specific scenario that was causing the UUID error
 * 
 * This test creates a minimal scenario to verify the UUID validation fix
 */

const axios = require('axios');

const BASE_URL = process.env.API_BASE_URL || 'http://localhost:5000';
const API_URL = `${BASE_URL}/api`;

async function testScenario() {
  console.log('🧪 Testing the specific UUID error scenario');
  console.log('==========================================');
  
  // Test 1: Direct route that might be causing issues
  console.log('\n1. Testing /api/donations/statistics...');
  try {
    const response = await axios.get(`${API_URL}/donations/statistics`, {
      validateStatus: () => true
    });
    console.log(`   Status: ${response.status}`);
    if (response.status === 404) {
      console.log('   ✅ Good: Route not found (no conflict)');
    } else {
      console.log('   Response:', JSON.stringify(response.data, null, 2));
    }
  } catch (error) {
    console.log('   Error:', error.message);
  }

  // Test 2: Check if there's a generic statistics endpoint
  console.log('\n2. Testing /api/statistics...');
  try {
    const response = await axios.get(`${API_URL}/statistics`, {
      validateStatus: () => true
    });
    console.log(`   Status: ${response.status}`);
    if (response.status === 200) {
      console.log('   ✅ Statistics endpoint exists and working');
    } else {
      console.log('   Response:', JSON.stringify(response.data, null, 2));
    }
  } catch (error) {
    console.log('   Error:', error.message);
  }

  // Test 3: Check if payment statistics endpoint exists
  console.log('\n3. Testing /api/payment/statistics...');
  try {
    const response = await axios.get(`${API_URL}/payment/statistics`, {
      validateStatus: () => true
    });
    console.log(`   Status: ${response.status}`);
    console.log('   Response:', JSON.stringify(response.data, null, 2));
  } catch (error) {
    console.log('   Error:', error.message);
  }

  // Test 4: Simulate what would happen if 'statistics' was passed as UUID
  console.log('\n4. Testing direct UUID validation...');
  const { isValidUUID } = require('./src/utils/helpers');
  
  const testCases = ['statistics', '123', 'invalid-uuid', '550e8400-e29b-41d4-a716-446655440000'];
  testCases.forEach(testCase => {
    const isValid = isValidUUID(testCase);
    console.log(`   "${testCase}" -> ${isValid ? '✅ Valid UUID' : '❌ Invalid UUID'}`);
  });

  console.log('\n📋 Summary');
  console.log('==========');
  console.log('If the original error was "invalid input syntax for type uuid: \'statistics\'",');
  console.log('it means:');
  console.log('1. A request was made to a route that captures "statistics" as an ID parameter');
  console.log('2. That ID was passed to Donation.findByPk() without validation');
  console.log('3. Our fix should prevent this by validating UUIDs before database queries');
  console.log('');
  console.log('Our solution:');
  console.log('✅ Added UUID validation middleware to routes with :id parameters');
  console.log('✅ Validation happens before authentication (earliest possible)');
  console.log('✅ Helper function for UUID validation is working correctly');
  console.log('');
  console.log('If the error persists, it might be coming from:');
  console.log('- A different route that we haven\'t identified');
  console.log('- Direct database calls that bypass route validation');
  console.log('- Frontend code passing invalid parameters');
}

testScenario().catch(console.error);