const PDFDocument = require('pdfkit');
const fs = require('fs-extra');
const path = require('path');
const logger = require('../utils/logger');
const { Donation, Campaign } = require('../models');
const config = require('../config/environment');

class ReceiptService {
  constructor() {
    this.receiptsDir = path.join(__dirname, '../../public/receipts');
    this.organizationName = process.env.PROJECT_NAME || 'Shiv Dhaam Foundation';
    this.baseUrl = this.getBaseUrl();
    this.ensureReceiptsDirectory();
  }

  /**
   * Get the base URL for receipt links
   * @returns {string} Base URL for the application
   */
  getBaseUrl() {
    // In production, use environment variable or detect from request
    if (process.env.NODE_ENV === 'production') {
      return process.env.API_BASE_URL || process.env.FRONTEND_URL || 'https://bdrf.in';
    }
    
    // In development, construct from port
    const port = process.env.PORT || 5000;
    return `http://localhost:${port}`;
  }

  async ensureReceiptsDirectory() {
    try {
      await fs.ensureDir(this.receiptsDir);
      logger.info(`Receipts directory ensured at: ${this.receiptsDir}`);
    } catch (error) {
      logger.error('Error creating receipts directory:', error);
    }
  }

  formatDate(date) {
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    const seconds = String(d.getSeconds()).padStart(2, '0');
    return `${year}/${month}/${day} ${hours}:${minutes}:${seconds}`;
  }

  formatCurrency(amount) {
    return `Rs. ${amount.toLocaleString('en-IN')}`;
  }

  async generateReceipt(donationData) {
    try {
      const {
        donationId,
        campaignId,
        campaignName,
        donorName,
        donorEmail,
        donorPhone,
        donationAmount,
        paymentMethod = 'razorpay',
        paymentId,
        createdAt
      } = donationData;

      const fileName = `${campaignId}.pdf`;
      const filePath = path.join(this.receiptsDir, fileName);
      
      // Check if logo exists (try multiple formats)
      let logoPath = path.join(__dirname, '../../public/logo.png');
      let hasLogo = await fs.pathExists(logoPath);
      
      // If PNG doesn't exist, check for webp
      if (!hasLogo) {
        logoPath = path.join(__dirname, '../../public/logo.webp');
        hasLogo = await fs.pathExists(logoPath);
      }
      
      // If webp doesn't exist, check for jpg
      if (!hasLogo) {
        logoPath = path.join(__dirname, '../../public/logo.jpg');
        hasLogo = await fs.pathExists(logoPath);
      }

      return new Promise((resolve, reject) => {
        const doc = new PDFDocument({
          size: 'A4',
          margin: 50,
          info: {
            Title: `Donation Receipt - ${donorName}`,
            Author: 'Bharat Disaster Relief Foundation',
            Subject: `Donation Receipt for ${campaignName}`,
            Keywords: 'donation, receipt'
          }
        });

        const stream = fs.createWriteStream(filePath);
        doc.pipe(stream);

        const pageWidth = doc.page.width - 100;
        const centerX = doc.page.width / 2;

        // Logo Section (at the top)
        let currentY = 50;
        
        if (hasLogo) {
          // If logo exists, use it
          doc.image(logoPath, centerX - 40, currentY, { width: 80, height: 80 });
          currentY += 90;
        } else {
          // Draw logo placeholder with improved design
          const logoSize = 70;
          const logoY = currentY + 35;
          
          // Draw outer laurel wreaths
          doc.save();
          
          // Left laurel branch
          for (let i = 0; i < 8; i++) {
            const angle = -60 + i * 10;
            const x = centerX - 35 + i * 2;
            const y = logoY - 20 + Math.abs(i - 4) * 3;
            doc.save()
               .translate(x, y)
               .rotate(angle)
               .path('M 0,0 Q 5,-3 10,-2 Q 5,-1 0,0')
               .fill('#666666')
               .restore();
          }
          
          // Right laurel branch
          for (let i = 0; i < 8; i++) {
            const angle = 60 - i * 10;
            const x = centerX + 35 - i * 2;
            const y = logoY - 20 + Math.abs(i - 4) * 3;
            doc.save()
               .translate(x, y)
               .rotate(angle)
               .path('M 0,0 Q -5,-3 -10,-2 Q -5,-1 0,0')
               .fill('#666666')
               .restore();
          }
          
          // Center emblem circle
          doc.circle(centerX, logoY, logoSize/2)
             .lineWidth(2)
             .stroke('#8B0000');
          
          // Star at top
          doc.fontSize(14)
             .fillColor('#8B0000')
             .text('★', centerX - 7, logoY - 45);
          
          // Text inside circle (placeholder for actual logo)
          doc.fontSize(16)
             .font('Helvetica-Bold')
             .fillColor('#8B0000')
             .text('BDRF', centerX - 25, logoY - 8, {
               width: 50,
               align: 'center'
             });
          
          doc.restore();
          currentY += 100;
        }

        // Organization Name
        doc.fillColor('black')
           .fontSize(18)
           .font('Helvetica-Bold')
           .text('Bharat Disaster Relief Foundation', 50, currentY, {
             align: 'center',
             width: pageWidth
           });

        currentY = doc.y + 15;

        // Contact Details
        doc.fontSize(10)
           .font('Helvetica')
           .text('Contact Number: +91 81769 77572', 50, currentY, {
             align: 'center',
             width: pageWidth
           });

        currentY = doc.y + 2;
        doc.text('Email: team@bdrf.in', 50, currentY, {
          align: 'center',
          width: pageWidth
        });

        currentY = doc.y + 2;
        doc.text('Address: BDRF, Plot No 460, F 203,', 50, currentY, {
          align: 'center',
          width: pageWidth
        });

        currentY = doc.y + 2;
        doc.text('Sec- 5, Gurgaon, Haryana', 50, currentY, {
          align: 'center',
          width: pageWidth
        });

        // Donation Receipt Title
        currentY = doc.y + 35;
        doc.fontSize(22)
           .font('Helvetica-Bold')
           .text('Donation Receipt', 50, currentY, {
             align: 'center',
             width: pageWidth
           });

        // Receipt Details
        currentY = doc.y + 20;
        doc.fontSize(10)
           .font('Helvetica')
           .text('Receipt Number: ', 50, currentY, { continued: true })
           .fillColor('gray')
           .text(`pay_${paymentId || donationId}`);

        currentY = doc.y + 3;
        doc.fillColor('black')
           .text('Time of Donation: ', 50, currentY, { continued: true })
           .fillColor('gray')
           .text(this.formatDate(createdAt));

        // Greeting Section
        currentY = doc.y + 20;
        doc.fillColor('black')
           .fontSize(11)
           .font('Helvetica')
           .text(`Dear ${donorName},`, 50, currentY);

        currentY = doc.y + 8;
        doc.fontSize(10)
           .text(`We deeply appreciate your generous contribution to the ${campaignName}! Your unwavering support fuels our mission to create a brighter future for the community. Together, we are building a foundation for lasting change, and we are grateful to have you as a part of this journey.`, 50, currentY, {
             align: 'left',
             width: pageWidth
           });

        // Donation Summary Section
        currentY = doc.y + 25;
        doc.fontSize(14)
           .font('Helvetica-Bold')
           .text('Donation Summary', 50, currentY);

        // Create table for donation details
        currentY = doc.y + 10;
        const tableLeft = 50;
        const tableWidth = pageWidth;
        const rowHeight = 30;

        // Draw table header
        doc.rect(tableLeft, currentY, tableWidth, rowHeight)
           .fillAndStroke('#f5f5f5', '#dddddd');

        doc.fillColor('black')
           .fontSize(11)
           .font('Helvetica-Bold')
           .text('Item', tableLeft + 15, currentY + 8, {
             width: tableWidth / 2 - 30
           })
           .text('Details', tableLeft + tableWidth / 2 + 15, currentY + 8, {
             width: tableWidth / 2 - 30
           });

        // Draw table rows
        const rows = [
          ['Donor Name', donorName],
          ['Donation Amount', this.formatCurrency(donationAmount)],
          ['Payment Method', paymentMethod],
          ['Total Donation Amount', this.formatCurrency(donationAmount)]
        ];

        currentY += rowHeight;
        
        rows.forEach((row, index) => {
          // Draw row border
          doc.rect(tableLeft, currentY, tableWidth, rowHeight)
             .stroke('#dddddd');

          // Add text
          doc.fillColor('black')
             .fontSize(10)
             .font('Helvetica')
             .text(row[0], tableLeft + 15, currentY + 8, {
               width: tableWidth / 2 - 30
             });

          // Make last row (total) bold
          if (index === rows.length - 1) {
            doc.font('Helvetica-Bold');
          }

          doc.text(row[1], tableLeft + tableWidth / 2 + 15, currentY + 8, {
            width: tableWidth / 2 - 30
          });

          currentY += rowHeight;
        });

        // Footer message
        const footerY = doc.page.height - 120;
        doc.fontSize(10)
           .font('Helvetica')
           .fillColor('black')
           .text('Thank you for your kind-hearted support of the Bharat Disaster Relief Foundation. Your generosity is', 50, footerY, {
             align: 'center',
             width: pageWidth
           })
           .text('making a meaningful impact where it matters most.', 50, doc.y, {
             align: 'center',
             width: pageWidth
           });

        doc.moveDown(0.5)
           .fontSize(10)
           .fillColor('blue')
           .text('https://bdrf.in', 50, doc.y, {
             align: 'center',
             width: pageWidth,
             link: 'https://bdrf.in'
           });

        // Finalize PDF
        doc.end();

        stream.on('finish', () => {
          const receiptUrl = `${this.baseUrl}/receipts/${fileName}`;
          logger.info(`Receipt generated successfully: ${filePath}`);
          resolve({
            success: true,
            fileName,
            filePath,
            receiptUrl,
            fullUrl: receiptUrl,
            message: 'Receipt generated successfully'
          });
        });

        stream.on('error', (error) => {
          logger.error('Error writing receipt PDF:', error);
          reject({
            success: false,
            error: error.message
          });
        });
      });
    } catch (error) {
      logger.error('Error generating receipt:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async getReceiptPath(campaignId) {
    const fileName = `${campaignId}.pdf`;
    const filePath = path.join(this.receiptsDir, fileName);
    
    try {
      const exists = await fs.pathExists(filePath);
      if (exists) {
        return {
          success: true,
          filePath,
          fileName
        };
      } else {
        return {
          success: false,
          error: 'Receipt not found'
        };
      }
    } catch (error) {
      logger.error('Error checking receipt path:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get donation details by donation ID and return campaign ID
   * @param {string} donationId - UUID of the donation
   * @returns {Object} Success/error response with donation and campaign data
   */
  async getDonationDetails(donationId) {
    try {
      const donation = await Donation.findByPk(donationId, {
        include: [{
          model: Campaign,
          as: 'campaign',
          attributes: ['id', 'title', 'slug']
        }],
        attributes: [
          'id', 'campaign_id', 'donor_name', 'donor_email', 'donor_phone',
          'donation_amount', 'tip_amount', 'total_amount', 'amount',
          'payment_method', 'razorpay_payment_id', 'transaction_id',
          'created_at', 'completed_at', 'status', 'payment_status'
        ]
      });

      if (!donation) {
        return {
          success: false,
          error: 'Donation not found'
        };
      }

      if (!donation.isSuccessful) {
        return {
          success: false,
          error: 'Receipt not available for incomplete donation'
        };
      }

      return {
        success: true,
        donation,
        campaignId: donation.campaign_id,
        campaignName: donation.campaign?.title || 'General Donation'
      };
    } catch (error) {
      logger.error('Error fetching donation details:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get receipt path by donation ID (alternative lookup method)
   * @param {string} donationId - UUID of the donation
   * @returns {Object} Success/error response with file path
   */
  async getReceiptPathByDonationId(donationId) {
    try {
      const donationResult = await this.getDonationDetails(donationId);
      
      if (!donationResult.success) {
        return donationResult;
      }

      // Use the campaign ID to get the receipt path
      return await this.getReceiptPath(donationResult.campaignId);
    } catch (error) {
      logger.error('Error getting receipt path by donation ID:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Send receipt via email
   * @param {string} campaignId - Campaign ID or donation ID
   * @param {string} recipientEmail - Email address to send receipt to
   * @param {string} donationId - Optional donation ID for lookup
   * @returns {Object} Success/error response
   */
  async emailReceipt(campaignId, recipientEmail, donationId = null) {
    try {
      let receiptResult;
      let donationDetails = null;

      // If donation ID is provided, use it for lookup
      if (donationId) {
        const donationResult = await this.getDonationDetails(donationId);
        if (!donationResult.success) {
          return donationResult;
        }
        
        donationDetails = donationResult.donation;
        receiptResult = await this.getReceiptPath(donationResult.campaignId);
        
        // If receipt doesn't exist for this campaign, try to generate it
        if (!receiptResult.success) {
          logger.info(`Receipt not found for campaign ${donationResult.campaignId}, attempting to generate...`);
          
          const generateResult = await this.generateReceipt({
            donationId: donationDetails.id,
            campaignId: donationResult.campaignId,
            campaignName: donationResult.campaignName,
            donorName: donationDetails.donor_name,
            donorEmail: donationDetails.donor_email,
            donorPhone: donationDetails.donor_phone,
            donationAmount: Math.round((donationDetails.donation_amount || 0) / 100),
            paymentMethod: donationDetails.payment_method || 'razorpay',
            paymentId: donationDetails.razorpay_payment_id || donationDetails.transaction_id,
            createdAt: donationDetails.created_at
          });
          
          if (generateResult.success) {
            receiptResult = await this.getReceiptPath(donationResult.campaignId);
            logger.info(`Receipt generated successfully for campaign ${donationResult.campaignId}`);
          } else {
            logger.error(`Failed to generate receipt for campaign ${donationResult.campaignId}: ${generateResult.error}`);
            return {
              success: false,
              error: 'Receipt file not found and could not be generated. Please contact support.'
            };
          }
        }
      } else {
        // Use campaign ID directly
        receiptResult = await this.getReceiptPath(campaignId);
      }

      if (!receiptResult.success) {
        return {
          success: false,
          error: 'Receipt file not found. Please contact support.'
        };
      }

      // Verify file exists before attempting to send
      try {
        await fs.access(receiptResult.filePath);
      } catch (fileError) {
        logger.error(`Receipt file not accessible: ${receiptResult.filePath}`);
        return {
          success: false,
          error: 'Receipt file is not accessible. Please contact support.'
        };
      }

      // Import email service dynamically to avoid circular dependencies
      const emailService = require('./emailService');
      
      // Send email with receipt attachment
      const emailResult = await emailService.sendReceiptEmail(recipientEmail, {
        attachmentPath: receiptResult.filePath,
        fileName: receiptResult.fileName,
        donationDetails: donationDetails
      });

      if (emailResult.success) {
        logger.info(`Receipt emailed successfully to ${recipientEmail}: ${receiptResult.fileName}`);
        return {
          success: true,
          message: 'Receipt sent via email successfully'
        };
      } else {
        logger.error(`Failed to email receipt to ${recipientEmail}: ${emailResult.error}`);
        return {
          success: false,
          error: 'Failed to send receipt via email'
        };
      }
    } catch (error) {
      logger.error('Error emailing receipt:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async deleteReceipt(campaignId) {
    const fileName = `${campaignId}.pdf`;
    const filePath = path.join(this.receiptsDir, fileName);
    
    try {
      await fs.remove(filePath);
      logger.info(`Receipt deleted: ${filePath}`);
      return {
        success: true,
        message: 'Receipt deleted successfully'
      };
    } catch (error) {
      logger.error('Error deleting receipt:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
}

module.exports = new ReceiptService();