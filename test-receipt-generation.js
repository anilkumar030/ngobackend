require('dotenv').config();
const receiptService = require('./src/services/receiptService');

async function testReceiptGeneration() {
  try {
    console.log('Testing receipt generation...');
    
    const testData = {
      donationId: 'test-donation-123',
      campaignId: 'test-campaign-123',
      campaignName: 'Uttarakhand Flash Flood Disaster',
      donorName: 'Sagar',
      donorEmail: 'sagar@example.com',
      donorPhone: '+91 9876543210',
      donationAmount: 500,
      paymentMethod: 'razorpay',
      paymentId: 'R1ajfShwt1LSQ',
      createdAt: new Date('2025-08-06T02:20:38.000Z')
    };
    
    const result = await receiptService.generateReceipt(testData);
    
    if (result.success) {
      console.log('✅ Receipt generated successfully!');
      console.log('File path:', result.filePath);
      console.log('Receipt URL:', result.receiptUrl);
    } else {
      console.error('❌ Failed to generate receipt:', result.error);
    }
  } catch (error) {
    console.error('❌ Error during test:', error);
  }
}

testReceiptGeneration();