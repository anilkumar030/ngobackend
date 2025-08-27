const nodemailer = require('nodemailer');
const config = require('../config/environment');
const logger = require('../utils/logger');
const { AppError } = require('../middleware/errorHandler');

// Get project name from environment variable with fallback
const PROJECT_NAME = process.env.PROJECT_NAME || 'Shiv Dhaam Foundation';

class EmailService {
  constructor() {
    this.transporter = null;
    this.initializeTransporter();
  }

  /**
   * Initialize email transporter
   */
  initializeTransporter() {
    try {
      this.transporter = nodemailer.createTransport({
        service: config.email.service,
        auth: {
          user: config.email.user,
          pass: config.email.password,
        },
        secure: true,
        tls: {
          rejectUnauthorized: false,
        },
      });

      // Verify transporter (non-blocking, just log the result)
      setImmediate(() => {
        this.transporter.verify((error, success) => {
          if (error) {
            logger.logError(error, { service: 'EmailService', method: 'initializeTransporter' });
          } else {
            logger.info('Email service initialized successfully');
          }
        });
      });

    } catch (error) {
      logger.logError(error, { service: 'EmailService', method: 'initializeTransporter' });
    }
  }

  /**
   * Send email
   */
  async sendEmail(to, subject, html, options = {}) {
    try {
      if (!this.transporter) {
        throw new AppError('Email service not initialized', 500);
      }

      const mailOptions = {
        from: {
          name: PROJECT_NAME,
          address: config.email.from,
        },
        to,
        subject,
        html,
        ...options,
      };

      const result = await this.transporter.sendMail(mailOptions);

      logger.contextLogger.email('Email sent', to, subject, {
        messageId: result.messageId,
        response: result.response,
      });

      return {
        success: true,
        messageId: result.messageId,
      };

    } catch (error) {
      logger.logError(error, { 
        service: 'EmailService', 
        method: 'sendEmail',
        to,
        subject,
      });
      
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Send verification email
   */
  async sendVerificationEmail(email, token, userData = {}) {
    const { first_name = 'User' } = userData;
    const verificationLink = `${config.urls.frontend}/verify-email?token=${token}`;

    const subject = `Welcome to ${PROJECT_NAME} - Verify Your Email`;
    const html = this.generateVerificationEmailHTML(first_name, verificationLink);

    return await this.sendEmail(email, subject, html);
  }

  /**
   * Send password reset email
   */
  async sendPasswordResetEmail(email, token, userData = {}) {
    const { first_name = 'User' } = userData;
    const resetLink = `${config.urls.frontend}/reset-password?token=${token}`;

    const subject = `Reset Your Password - ${PROJECT_NAME}`;
    const html = this.generatePasswordResetEmailHTML(first_name, resetLink);

    return await this.sendEmail(email, subject, html);
  }

  /**
   * Send donation confirmation email
   */
  async sendDonationConfirmation(email, donationData) {
    const { donationId, amount, campaignTitle, donorName } = donationData;

    const subject = `Thank You for Your Donation - ${PROJECT_NAME}`;
    const html = this.generateDonationConfirmationHTML({
      donorName,
      amount,
      campaignTitle,
      donationId,
    });

    return await this.sendEmail(email, subject, html);
  }

  /**
   * Send donation receipt email
   */
  async sendDonationReceipt(email, receiptData) {
    const { donationId, amount, campaignTitle, donorName, receiptUrl } = receiptData;

    const subject = `Donation Receipt - ${PROJECT_NAME}`;
    const html = this.generateDonationReceiptHTML({
      donorName,
      amount,
      campaignTitle,
      donationId,
      receiptUrl,
    });

    const attachments = receiptUrl ? [{
      filename: `donation-receipt-${donationId}.pdf`,
      path: receiptUrl,
    }] : [];

    return await this.sendEmail(email, subject, html, { attachments });
  }

  /**
   * Send receipt email with PDF attachment (standalone receipt request)
   * @param {string} email - Recipient email
   * @param {Object} data - Receipt data
   * @param {string} data.attachmentPath - Path to the PDF file
   * @param {string} data.fileName - Name of the PDF file
   * @param {Object} data.donationDetails - Optional donation details
   */
  async sendReceiptEmail(email, data) {
    const { attachmentPath, fileName, donationDetails } = data;

    const subject = `Donation Receipt - ${PROJECT_NAME}`;
    
    let donorName = 'Valued Supporter';
    let additionalInfo = '';
    
    if (donationDetails) {
      donorName = donationDetails.donor_name || 'Valued Supporter';
      // Handle both donation_amount (paise) and amount (rupees) fields
      const donationAmount = donationDetails.donationAmountInRupees || 
                            Math.round((donationDetails.donation_amount || 0) / 100) || 
                            donationDetails.amount || 0;
      additionalInfo = `
        <p><strong>Donation Amount:</strong> ₹${donationAmount}</p>
        <p><strong>Donation ID:</strong> ${donationDetails.id}</p>
        <p><strong>Date:</strong> ${new Date(donationDetails.created_at).toLocaleDateString('en-IN')}</p>
      `;
    }

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #8B0000; margin-bottom: 10px;">${PROJECT_NAME}</h1>
          <h2 style="color: #333; margin-top: 0;">Donation Receipt</h2>
        </div>
        
        <div style="background-color: #f9f9f9; padding: 20px; border-radius: 5px; margin-bottom: 20px;">
          <p>Dear ${donorName},</p>
          
          <p>Thank you for your generous contribution to ${PROJECT_NAME}. As requested, please find your donation receipt attached to this email.</p>
          
          ${additionalInfo}
          
          <p>This receipt serves as proof of your donation and can be used for tax purposes where applicable.</p>
        </div>
        
        <div style="background-color: #fff3cd; padding: 15px; border-radius: 5px; border-left: 4px solid #ffc107; margin-bottom: 20px;">
          <p style="margin: 0; font-size: 14px;"><strong>Note:</strong> Please save this receipt for your records. If you have any questions about your donation, please contact us at team@bdrf.in</p>
        </div>
        
        <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee;">
          <p style="color: #666; font-size: 14px;">
            Thank you for your continued support.<br>
            ${PROJECT_NAME}<br>
            <a href="https://bdrf.in" style="color: #8B0000;">https://bdrf.in</a>
          </p>
        </div>
      </div>
    `;

    const attachments = [{
      filename: fileName,
      path: attachmentPath,
      contentType: 'application/pdf'
    }];

    return await this.sendEmail(email, subject, html, { attachments });
  }

  /**
   * Send order confirmation email
   */
  async sendOrderConfirmation(email, orderData) {
    const { orderId, totalAmount, items, customerName } = orderData;

    const subject = `Order Confirmation - ${PROJECT_NAME} Store`;
    const html = this.generateOrderConfirmationHTML({
      customerName,
      orderId,
      totalAmount,
      items,
    });

    return await this.sendEmail(email, subject, html);
  }

  /**
   * Send newsletter email
   */
  async sendNewsletter(email, newsletterData) {
    const { title, content, unsubscribeLink } = newsletterData;

    const subject = `Newsletter: ${title} - ${PROJECT_NAME}`;
    const html = this.generateNewsletterHTML({
      title,
      content,
      unsubscribeLink,
    });

    return await this.sendEmail(email, subject, html);
  }

  /**
   * Send campaign update email
   */
  async sendCampaignUpdate(email, campaignData) {
    const { campaignTitle, updateTitle, updateContent, campaignUrl } = campaignData;

    const subject = `Campaign Update: ${campaignTitle}`;
    const html = this.generateCampaignUpdateHTML({
      campaignTitle,
      updateTitle,
      updateContent,
      campaignUrl,
    });

    return await this.sendEmail(email, subject, html);
  }

  /**
   * Send contact form notification email to admin
   */
  async sendContactFormNotification(adminEmail, contactData) {
    const { firstName, lastName, email, phone, message } = contactData;

    const subject = `New Contact Form Submission - ${PROJECT_NAME}`;
    const html = this.generateContactFormEmailHTML({
      firstName,
      lastName,
      email,
      phone,
      message,
    });

    return await this.sendEmail(adminEmail, subject, html);
  }

  /**
   * Send contact form confirmation email to user
   */
  async sendContactFormConfirmation(email, userData) {
    const { firstName, lastName } = userData;

    const subject = `Thank you for contacting us - ${PROJECT_NAME}`;
    const html = this.generateContactConfirmationEmailHTML({
      firstName,
      lastName,
    });

    return await this.sendEmail(email, subject, html);
  }

  /**
   * Send welcome email
   */
  async sendWelcomeEmail(email, userData) {
    const { first_name, isEmailVerified } = userData;

    const subject = `Welcome to ${PROJECT_NAME}`;
    const html = this.generateWelcomeEmailHTML(first_name, isEmailVerified);

    return await this.sendEmail(email, subject, html);
  }

  /**
   * Send welcome email with password for donation-created users
   */
  async sendWelcomeEmailWithPassword(email, userData) {
    const { first_name, password, donationAmount, campaignTitle } = userData;

    const subject = `Welcome to ${PROJECT_NAME} - Your Account Details`;
    const html = this.generateWelcomeEmailWithPasswordHTML({
      firstName: first_name,
      email,
      password,
      donationAmount,
      campaignTitle
    });

    return await this.sendEmail(email, subject, html);
  }

  /**
   * Send bulk emails
   */
  async sendBulkEmails(emails, subject, html, options = {}) {
    const { batchSize = 50, delay = 1000 } = options;
    const results = [];

    for (let i = 0; i < emails.length; i += batchSize) {
      const batch = emails.slice(i, i + batchSize);
      
      const batchPromises = batch.map(email => 
        this.sendEmail(email, subject, html)
      );

      const batchResults = await Promise.allSettled(batchPromises);
      results.push(...batchResults);

      // Add delay between batches to avoid rate limiting
      if (i + batchSize < emails.length && delay > 0) {
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    const successful = results.filter(result => 
      result.status === 'fulfilled' && result.value.success
    ).length;

    const failed = results.length - successful;

    logger.contextLogger.email('Bulk email sent', `${emails.length} recipients`, subject, {
      successful,
      failed,
    });

    return {
      total: results.length,
      successful,
      failed,
      results,
    };
  }

  // HTML Template Generators

  generateVerificationEmailHTML(firstName, verificationLink) {
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background-color: #f8f9fa; padding: 20px; text-align: center;">
          <h1 style="color: #ff6b35; margin: 0;">${PROJECT_NAME}</h1>
        </div>
        
        <div style="padding: 40px 20px;">
          <h2 style="color: #333; margin-bottom: 20px;">Welcome ${firstName}!</h2>
          
          <p style="color: #666; line-height: 1.6; margin-bottom: 30px;">
            Thank you for joining ${PROJECT_NAME}. To complete your registration and start making a difference, 
            please verify your email address by clicking the button below.
          </p>
          
          <div style="text-align: center; margin-bottom: 30px;">
            <a href="${verificationLink}" 
               style="background-color: #ff6b35; color: white; padding: 15px 30px; 
                      text-decoration: none; border-radius: 5px; display: inline-block;">
              Verify Email Address
            </a>
          </div>
          
          <p style="color: #666; font-size: 14px;">
            If you didn't create an account with us, please ignore this email.
          </p>
          
          <p style="color: #666; font-size: 14px;">
            If the button doesn't work, copy and paste this link into your browser:<br>
            <a href="${verificationLink}">${verificationLink}</a>
          </p>
        </div>
        
        <div style="background-color: #f8f9fa; padding: 20px; text-align: center; font-size: 12px; color: #666;">
          © 2024 ${PROJECT_NAME}. All rights reserved.
        </div>
      </div>
    `;
  }

  generatePasswordResetEmailHTML(firstName, resetLink) {
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background-color: #f8f9fa; padding: 20px; text-align: center;">
          <h1 style="color: #ff6b35; margin: 0;">${PROJECT_NAME}</h1>
        </div>
        
        <div style="padding: 40px 20px;">
          <h2 style="color: #333; margin-bottom: 20px;">Password Reset Request</h2>
          
          <p style="color: #666; line-height: 1.6; margin-bottom: 30px;">
            Hello ${firstName},
          </p>
          
          <p style="color: #666; line-height: 1.6; margin-bottom: 30px;">
            We received a request to reset your password. Click the button below to create a new password. 
            This link will expire in 1 hour for security reasons.
          </p>
          
          <div style="text-align: center; margin-bottom: 30px;">
            <a href="${resetLink}" 
               style="background-color: #ff6b35; color: white; padding: 15px 30px; 
                      text-decoration: none; border-radius: 5px; display: inline-block;">
              Reset Password
            </a>
          </div>
          
          <p style="color: #666; font-size: 14px;">
            If you didn't request a password reset, please ignore this email. Your password will remain unchanged.
          </p>
        </div>
        
        <div style="background-color: #f8f9fa; padding: 20px; text-align: center; font-size: 12px; color: #666;">
          © 2024 ${PROJECT_NAME}. All rights reserved.
        </div>
      </div>
    `;
  }

  generateDonationConfirmationHTML(data) {
    const { donorName, amount, campaignTitle, donationId } = data;
    
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background-color: #f8f9fa; padding: 20px; text-align: center;">
          <h1 style="color: #ff6b35; margin: 0;">${PROJECT_NAME}</h1>
        </div>
        
        <div style="padding: 40px 20px;">
          <h2 style="color: #28a745; margin-bottom: 20px;">🙏 Thank You for Your Donation!</h2>
          
          <p style="color: #666; line-height: 1.6; margin-bottom: 30px;">
            Dear ${donorName},
          </p>
          
          <p style="color: #666; line-height: 1.6; margin-bottom: 30px;">
            Your generous donation of <strong>₹${amount}</strong> to the campaign 
            "<strong>${campaignTitle}</strong>" has been successfully received.
          </p>
          
          <div style="background-color: #f8f9fa; padding: 20px; border-radius: 5px; margin-bottom: 30px;">
            <h3 style="margin-top: 0; color: #333;">Donation Details</h3>
            <p style="margin: 5px 0;"><strong>Donation ID:</strong> ${donationId}</p>
            <p style="margin: 5px 0;"><strong>Amount:</strong> ₹${amount}</p>
            <p style="margin: 5px 0;"><strong>Campaign:</strong> ${campaignTitle}</p>
            <p style="margin: 5px 0;"><strong>Date:</strong> ${new Date().toLocaleDateString()}</p>
          </div>
          
          <p style="color: #666; line-height: 1.6;">
            Your contribution will make a real difference in the lives of those we serve. 
            We will send you updates on how your donation is being used.
          </p>
        </div>
        
        <div style="background-color: #f8f9fa; padding: 20px; text-align: center; font-size: 12px; color: #666;">
          © 2024 ${PROJECT_NAME}. All rights reserved.
        </div>
      </div>
    `;
  }

  generateOrderConfirmationHTML(data) {
    const { customerName, orderId, totalAmount, items } = data;
    
    const itemsHTML = items.map(item => `
      <tr>
        <td style="padding: 10px; border-bottom: 1px solid #eee;">${item.product.name}</td>
        <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: center;">${item.quantity}</td>
        <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: right;">₹${item.price}</td>
        <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: right;">₹${item.total}</td>
      </tr>
    `).join('');

    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background-color: #f8f9fa; padding: 20px; text-align: center;">
          <h1 style="color: #ff6b35; margin: 0;">${PROJECT_NAME}</h1>
        </div>
        
        <div style="padding: 40px 20px;">
          <h2 style="color: #28a745; margin-bottom: 20px;">Order Confirmation</h2>
          
          <p style="color: #666; line-height: 1.6; margin-bottom: 30px;">
            Dear ${customerName},
          </p>
          
          <p style="color: #666; line-height: 1.6; margin-bottom: 30px;">
            Thank you for your order! We've received your order and are preparing it for shipment.
          </p>
          
          <div style="background-color: #f8f9fa; padding: 20px; border-radius: 5px; margin-bottom: 30px;">
            <h3 style="margin-top: 0; color: #333;">Order Details</h3>
            <p style="margin: 5px 0;"><strong>Order ID:</strong> ${orderId}</p>
            <p style="margin: 5px 0;"><strong>Total Amount:</strong> ₹${totalAmount}</p>
            <p style="margin: 5px 0;"><strong>Date:</strong> ${new Date().toLocaleDateString()}</p>
          </div>
          
          <table style="width: 100%; border-collapse: collapse; margin-bottom: 30px;">
            <thead>
              <tr style="background-color: #f8f9fa;">
                <th style="padding: 15px 10px; text-align: left;">Item</th>
                <th style="padding: 15px 10px; text-align: center;">Qty</th>
                <th style="padding: 15px 10px; text-align: right;">Price</th>
                <th style="padding: 15px 10px; text-align: right;">Total</th>
              </tr>
            </thead>
            <tbody>
              ${itemsHTML}
            </tbody>
          </table>
          
          <p style="color: #666; line-height: 1.6;">
            You will receive a shipping confirmation email once your order is dispatched.
          </p>
        </div>
        
        <div style="background-color: #f8f9fa; padding: 20px; text-align: center; font-size: 12px; color: #666;">
          © 2024 ${PROJECT_NAME}. All rights reserved.
        </div>
      </div>
    `;
  }

  generateWelcomeEmailHTML(firstName, isEmailVerified) {
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background-color: #f8f9fa; padding: 20px; text-align: center;">
          <h1 style="color: #ff6b35; margin: 0;">${PROJECT_NAME}</h1>
        </div>
        
        <div style="padding: 40px 20px;">
          <h2 style="color: #333; margin-bottom: 20px;">Welcome to Our Community!</h2>
          
          <p style="color: #666; line-height: 1.6; margin-bottom: 30px;">
            Dear ${firstName},
          </p>
          
          <p style="color: #666; line-height: 1.6; margin-bottom: 30px;">
            Welcome to ${PROJECT_NAME}! We're thrilled to have you join our community of 
            compassionate individuals working together to make a positive impact.
          </p>
          
          ${!isEmailVerified ? `
          <div style="background-color: #fff3cd; padding: 15px; border-radius: 5px; margin-bottom: 30px; border-left: 4px solid #ffc107;">
            <p style="margin: 0; color: #856404;">
              <strong>Please verify your email address</strong> to access all features and start donating to causes you care about.
            </p>
          </div>
          ` : ''}
          
          <p style="color: #666; line-height: 1.6; margin-bottom: 30px;">
            Here's what you can do with your account:
          </p>
          
          <ul style="color: #666; line-height: 1.8; margin-bottom: 30px;">
            <li>Browse and donate to active campaigns</li>
            <li>Shop from our spiritual store</li>
            <li>Track your donation history</li>
            <li>Receive updates on the impact of your contributions</li>
          </ul>
          
          <div style="text-align: center; margin-bottom: 30px;">
            <a href="${config.urls.frontend}/campaigns" 
               style="background-color: #ff6b35; color: white; padding: 15px 30px; 
                      text-decoration: none; border-radius: 5px; display: inline-block;">
              Explore Campaigns
            </a>
          </div>
        </div>
        
        <div style="background-color: #f8f9fa; padding: 20px; text-align: center; font-size: 12px; color: #666;">
          © 2024 ${PROJECT_NAME}. All rights reserved.
        </div>
      </div>
    `;
  }

  generateWelcomeEmailWithPasswordHTML(data) {
    const { firstName, email, password, donationAmount, campaignTitle } = data;
    
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background-color: #f8f9fa; padding: 20px; text-align: center;">
          <h1 style="color: #ff6b35; margin: 0;">${PROJECT_NAME}</h1>
        </div>
        
        <div style="padding: 40px 20px;">
          <h2 style="color: #28a745; margin-bottom: 20px;">🙏 Thank You & Welcome!</h2>
          
          <p style="color: #666; line-height: 1.6; margin-bottom: 30px;">
            Dear ${firstName},
          </p>
          
          <p style="color: #666; line-height: 1.6; margin-bottom: 30px;">
            Thank you for your generous donation of <strong>₹${donationAmount}</strong> to 
            "<strong>${campaignTitle}</strong>". Your contribution will make a real difference!
          </p>
          
          <p style="color: #666; line-height: 1.6; margin-bottom: 30px;">
            We've created an account for you to track your donations and explore more ways to help. 
            Here are your login credentials:
          </p>
          
          <div style="background-color: #f8f9fa; padding: 20px; border-radius: 5px; margin-bottom: 30px; border-left: 4px solid #ff6b35;">
            <h3 style="margin-top: 0; color: #333;">Your Account Details</h3>
            <p style="margin: 5px 0;"><strong>Email:</strong> ${email}</p>
            <p style="margin: 5px 0;"><strong>Password:</strong> <span style="background-color: #fff; padding: 2px 6px; border: 1px solid #ddd; border-radius: 3px; font-family: monospace;">${password}</span></p>
          </div>
          
          <div style="background-color: #d1ecf1; padding: 15px; border-radius: 5px; margin-bottom: 30px; border-left: 4px solid #bee5eb;">
            <p style="margin: 0; color: #0c5460;">
              <strong>Important:</strong> Please change your password after your first login for security.
            </p>
          </div>
          
          <p style="color: #666; line-height: 1.6; margin-bottom: 30px;">
            With your account, you can:
          </p>
          
          <ul style="color: #666; line-height: 1.8; margin-bottom: 30px;">
            <li>View your donation history and receipts</li>
            <li>Track the impact of your contributions</li>
            <li>Discover and support other campaigns</li>
            <li>Shop from our spiritual store</li>
            <li>Receive updates on how your donations are being used</li>
          </ul>
          
          <div style="text-align: center; margin-bottom: 30px;">
            <a href="${config.urls.frontend}/login" 
               style="background-color: #ff6b35; color: white; padding: 15px 30px; 
                      text-decoration: none; border-radius: 5px; display: inline-block; margin-right: 10px;">
              Login to Your Account
            </a>
            <a href="${config.urls.frontend}/campaigns" 
               style="background-color: #28a745; color: white; padding: 15px 30px; 
                      text-decoration: none; border-radius: 5px; display: inline-block;">
              Explore More Campaigns
            </a>
          </div>
          
          <p style="color: #666; line-height: 1.6; font-size: 14px;">
            Thank you for joining our community of compassionate donors. Together, we can make a lasting impact!
          </p>
        </div>
        
        <div style="background-color: #f8f9fa; padding: 20px; text-align: center; font-size: 12px; color: #666;">
          © 2024 ${PROJECT_NAME}. All rights reserved.
        </div>
      </div>
    `;
  }

  generateNewsletterHTML(data) {
    const { title, content, unsubscribeLink } = data;
    
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background-color: #f8f9fa; padding: 20px; text-align: center;">
          <h1 style="color: #ff6b35; margin: 0;">${PROJECT_NAME}</h1>
        </div>
        
        <div style="padding: 40px 20px;">
          <h2 style="color: #333; margin-bottom: 30px;">${title}</h2>
          
          <div style="color: #666; line-height: 1.6;">
            ${content}
          </div>
        </div>
        
        <div style="background-color: #f8f9fa; padding: 20px; text-align: center; font-size: 12px; color: #666;">
          <p>© 2024 ${PROJECT_NAME}. All rights reserved.</p>
          <p>
            <a href="${unsubscribeLink}" style="color: #666;">Unsubscribe</a>
          </p>
        </div>
      </div>
    `;
  }

  generateCampaignUpdateHTML(data) {
    const { campaignTitle, updateTitle, updateContent, campaignUrl } = data;
    
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background-color: #f8f9fa; padding: 20px; text-align: center;">
          <h1 style="color: #ff6b35; margin: 0;">${PROJECT_NAME}</h1>
        </div>
        
        <div style="padding: 40px 20px;">
          <h2 style="color: #333; margin-bottom: 10px;">Campaign Update</h2>
          <h3 style="color: #666; margin-bottom: 30px;">${campaignTitle}</h3>
          
          <h4 style="color: #ff6b35; margin-bottom: 20px;">${updateTitle}</h4>
          
          <div style="color: #666; line-height: 1.6; margin-bottom: 30px;">
            ${updateContent}
          </div>
          
          <div style="text-align: center;">
            <a href="${campaignUrl}" 
               style="background-color: #ff6b35; color: white; padding: 15px 30px; 
                      text-decoration: none; border-radius: 5px; display: inline-block;">
              View Campaign
            </a>
          </div>
        </div>
        
        <div style="background-color: #f8f9fa; padding: 20px; text-align: center; font-size: 12px; color: #666;">
          © 2024 ${PROJECT_NAME}. All rights reserved.
        </div>
      </div>
    `;
  }

  /**
   * Generate contact form email HTML for admin notification
   */
  generateContactFormEmailHTML(data) {
    const { firstName, lastName, email, phone, message } = data;
    const submittedAt = new Date().toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });

    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #ddd;">
        <div style="background-color: #ff6b35; padding: 20px; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 24px;">New Contact Form Submission</h1>
          <p style="color: white; margin: 5px 0 0 0; font-size: 16px;">${PROJECT_NAME}</p>
        </div>
        
        <div style="padding: 30px 20px;">
          <h2 style="color: #333; margin-bottom: 25px; border-bottom: 2px solid #ff6b35; padding-bottom: 10px;">
            Contact Details
          </h2>
          
          <table style="width: 100%; border-collapse: collapse; margin-bottom: 30px;">
            <tr>
              <td style="padding: 12px 0; border-bottom: 1px solid #eee; font-weight: bold; color: #555; width: 30%;">
                Name:
              </td>
              <td style="padding: 12px 0; border-bottom: 1px solid #eee; color: #333;">
                ${firstName} ${lastName}
              </td>
            </tr>
            <tr>
              <td style="padding: 12px 0; border-bottom: 1px solid #eee; font-weight: bold; color: #555;">
                Email:
              </td>
              <td style="padding: 12px 0; border-bottom: 1px solid #eee; color: #333;">
                <a href="mailto:${email}" style="color: #ff6b35; text-decoration: none;">${email}</a>
              </td>
            </tr>
            <tr>
              <td style="padding: 12px 0; border-bottom: 1px solid #eee; font-weight: bold; color: #555;">
                Phone:
              </td>
              <td style="padding: 12px 0; border-bottom: 1px solid #eee; color: #333;">
                ${phone ? `<a href="tel:${phone}" style="color: #ff6b35; text-decoration: none;">${phone}</a>` : 'Not provided'}
              </td>
            </tr>
            <tr>
              <td style="padding: 12px 0; border-bottom: 1px solid #eee; font-weight: bold; color: #555;">
                Submitted:
              </td>
              <td style="padding: 12px 0; border-bottom: 1px solid #eee; color: #333;">
                ${submittedAt}
              </td>
            </tr>
          </table>
          
          <h3 style="color: #333; margin-bottom: 15px; border-bottom: 1px solid #ddd; padding-bottom: 8px;">
            Message:
          </h3>
          
          <div style="background-color: #f8f9fa; padding: 20px; border-radius: 5px; border-left: 4px solid #ff6b35;">
            <p style="margin: 0; color: #555; line-height: 1.6; white-space: pre-line;">${message}</p>
          </div>
          
          <div style="margin-top: 30px; padding: 20px; background-color: #e7f3ff; border-radius: 5px; border-left: 4px solid #007bff;">
            <h4 style="margin: 0 0 10px 0; color: #0056b3;">Quick Actions:</h4>
            <p style="margin: 5px 0; color: #0056b3;">
              • <a href="mailto:${email}?subject=Re: Your inquiry to ${PROJECT_NAME}" style="color: #007bff; text-decoration: none;">Reply to ${firstName}</a>
            </p>
            ${phone ? `<p style="margin: 5px 0; color: #0056b3;">• <a href="tel:${phone}" style="color: #007bff; text-decoration: none;">Call ${firstName}</a></p>` : ''}
          </div>
        </div>
        
        <div style="background-color: #f8f9fa; padding: 15px 20px; text-align: center; font-size: 12px; color: #666;">
          <p style="margin: 0;">This email was automatically generated by the ${PROJECT_NAME} contact form system.</p>
          <p style="margin: 5px 0 0 0;">Please respond to the inquiry as soon as possible.</p>
        </div>
      </div>
    `;
  }

  /**
   * Generate contact form confirmation email HTML for user
   */
  generateContactConfirmationEmailHTML(data) {
    const { firstName, lastName } = data;
    
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background-color: #f8f9fa; padding: 20px; text-align: center;">
          <h1 style="color: #ff6b35; margin: 0;">${PROJECT_NAME}</h1>
        </div>
        
        <div style="padding: 40px 20px;">
          <h2 style="color: #28a745; margin-bottom: 20px;">Thank You for Contacting Us!</h2>
          
          <p style="color: #666; line-height: 1.6; margin-bottom: 30px;">
            Dear ${firstName} ${lastName},
          </p>
          
          <p style="color: #666; line-height: 1.6; margin-bottom: 30px;">
            Thank you for reaching out to ${PROJECT_NAME}. We have received your message and 
            appreciate you taking the time to contact us.
          </p>
          
          <div style="background-color: #e7f3ff; padding: 20px; border-radius: 5px; margin-bottom: 30px; border-left: 4px solid #007bff;">
            <h3 style="margin-top: 0; color: #0056b3;">What happens next?</h3>
            <ul style="color: #0056b3; line-height: 1.6; margin: 0; padding-left: 20px;">
              <li>Our team will review your message within 24 hours</li>
              <li>We will respond to your inquiry via email or phone</li>
              <li>For urgent matters, please call us directly</li>
            </ul>
          </div>
          
          <p style="color: #666; line-height: 1.6; margin-bottom: 30px;">
            In the meantime, feel free to explore our website to learn more about our mission, 
            current campaigns, and how you can make a difference in the lives of those we serve.
          </p>
          
          <div style="text-align: center; margin-bottom: 30px;">
            <a href="${config.urls.frontend}/campaigns" 
               style="background-color: #ff6b35; color: white; padding: 15px 30px; 
                      text-decoration: none; border-radius: 5px; display: inline-block; margin-right: 10px;">
              View Our Campaigns
            </a>
            <a href="${config.urls.frontend}/about" 
               style="background-color: #28a745; color: white; padding: 15px 30px; 
                      text-decoration: none; border-radius: 5px; display: inline-block;">
              Learn About Us
            </a>
          </div>
          
          <p style="color: #666; line-height: 1.6; font-size: 14px;">
            Thank you for your interest in supporting our cause. Together, we can create positive change!
          </p>
        </div>
        
        <div style="background-color: #f8f9fa; padding: 20px; text-align: center; font-size: 12px; color: #666;">
          © 2024 ${PROJECT_NAME}. All rights reserved.
        </div>
      </div>
    `;
  }
}

module.exports = new EmailService();