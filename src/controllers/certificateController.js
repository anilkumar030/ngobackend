const { Certificate, Donation, User, Campaign, UserAddress } = require('../models');
const { catchAsync, AppError } = require('../middleware/errorHandler');
const { redisUtils, CACHE_KEYS } = require('../config/redis');
const logger = require('../utils/logger');
const { Op } = require('sequelize');

/**
 * Get user certificates with pagination and filters
 */
const getUserCertificates = catchAsync(async (req, res) => {
  const {
    page = 1,
    limit = 10,
    year,
    type
  } = req.query;

  const userId = req.user.id;
  const offset = (page - 1) * limit;

  // Build where conditions
  const whereConditions = { user_id: userId };

  if (type && ['80g', 'annual_summary', 'project_specific', 'consolidated'].includes(type)) {
    whereConditions.type = type;
  }

  if (year) {
    // Filter by financial year
    const startYear = parseInt(year);
    const endYear = startYear + 1;
    whereConditions.financial_year = `${startYear}-${endYear}`;
  }

  // Get certificates with pagination
  const { count, rows: certificates } = await Certificate.findAndCountAll({
    where: whereConditions,
    order: [['created_at', 'DESC'], ['issue_date', 'DESC']],
    limit: parseInt(limit),
    offset: offset,
  });

  // Process certificates for response with donations_included
  const processedCertificates = certificates.map(cert => {
    const certData = cert.getPublicData();
    // Map donations_included to match the required format
    certData.donations_included = cert.donations_included.map(donation => ({
      donation_id: donation.donation_id,
      amount: parseFloat(donation.amount),
      date: donation.date,
      campaign: donation.campaign || 'General Donation'
    }));
    return certData;
  });

  // Calculate summary statistics
  const summary = {
    total_certificates: count,
    total_eligible_donations: 0,
    tax_saved_estimate: 0
  };

  // Calculate totals for issued certificates
  const issuedCertificates = certificates.filter(cert => cert.status === 'issued');
  if (issuedCertificates.length > 0) {
    summary.total_eligible_donations = issuedCertificates.reduce(
      (sum, cert) => sum + parseFloat(cert.eligible_amount || 0), 
      0
    );
    // Tax savings calculation: 100% deduction under 80G (up to certain limits)
    const maxDeduction = Math.min(summary.total_eligible_donations, 200000); // Rs 2 lakh limit example
    summary.tax_saved_estimate = Math.round(maxDeduction * 0.30); // 30% tax bracket estimate
  }

  const totalPages = Math.ceil(count / limit);

  res.status(200).json({
    success: true,
    data: {
      certificates: processedCertificates,
      summary,
      pagination: {
        current_page: parseInt(page),
        per_page: parseInt(limit),
        total: count,
        total_pages: totalPages,
        has_next: page < totalPages,
        has_prev: page > 1,
      },
    },
  });
});

/**
 * Generate/request certificate
 */
const generateCertificate = catchAsync(async (req, res) => {
  const { year, type = '80g' } = req.body;
  const userId = req.user.id;

  // Validate required fields
  if (!year) {
    throw new AppError('Year is required', 400, true, 'MISSING_YEAR');
  }

  // Validate type
  if (!['80g', 'annual_summary', 'project_specific', 'consolidated'].includes(type)) {
    throw new AppError('Invalid certificate type', 400, true, 'INVALID_TYPE');
  }

  // Validate year format
  const yearNum = parseInt(year);
  const currentYear = new Date().getFullYear();
  if (isNaN(yearNum) || yearNum < 2020 || yearNum > currentYear) {
    throw new AppError('Invalid year provided', 400, true, 'INVALID_YEAR');
  }

  // Calculate financial year
  const financialYear = `${yearNum}-${yearNum + 1}`;

  // Check if certificate already exists for this year and type
  const existingCertificate = await Certificate.findOne({
    where: {
      user_id: userId,
      financial_year: financialYear,
      type: type,
      status: { [Op.in]: ['draft', 'processing', 'issued'] }
    }
  });

  if (existingCertificate) {
    if (existingCertificate.status === 'issued') {
      return res.status(200).json({
        success: true,
        message: 'Certificate already exists and is ready for download',
        data: {
          certificate: existingCertificate.getPublicData()
        }
      });
    } else {
      return res.status(200).json({
        success: true,
        message: 'Certificate generation is already in progress for this year and type',
        data: {
          certificate: existingCertificate.getPublicData()
        }
      });
    }
  }

  // Calculate date range for the financial year
  const startDate = new Date(`${yearNum}-04-01`); // April 1st
  const endDate = new Date(`${yearNum + 1}-03-31`); // March 31st next year

  // Get all eligible donations for the financial year
  const donations = await Donation.findAll({
    where: {
      user_id: userId,
      payment_status: 'completed',
      status: 'completed',
      created_at: {
        [Op.between]: [startDate, endDate]
      }
    },
    include: [
      {
        model: Campaign,
        as: 'campaign',
        attributes: ['id', 'title', 'category', 'is_tax_exempted']
      }
    ],
    order: [['created_at', 'ASC']]
  });

  if (donations.length === 0) {
    throw new AppError(
      `No eligible donations found for financial year ${financialYear}`, 
      404, 
      true, 
      'NO_ELIGIBLE_DONATIONS'
    );
  }

  // Filter donations based on certificate type
  let eligibleDonations = donations;
  let eligibleAmount = 0;
  let totalAmount = donations.reduce((sum, donation) => sum + parseFloat(donation.amount), 0);

  if (type === '80g') {
    // Only include tax-exempt donations for 80G certificates
    eligibleDonations = donations.filter(donation => 
      donation.campaign && donation.campaign.is_tax_exempted !== false
    );
    eligibleAmount = eligibleDonations.reduce((sum, donation) => sum + parseFloat(donation.amount), 0);
  } else {
    eligibleAmount = totalAmount; // For other types, all donations are eligible
  }

  if (eligibleDonations.length === 0) {
    throw new AppError(
      `No eligible donations found for ${type} certificate in financial year ${financialYear}`, 
      404, 
      true, 
      'NO_ELIGIBLE_DONATIONS'
    );
  }

  // Prepare donations data for certificate
  const donationsIncluded = eligibleDonations.map(donation => ({
    donation_id: donation.id,
    amount: parseFloat(donation.amount),
    date: donation.created_at,
    campaign: donation.campaign ? donation.campaign.title : 'General Donation'
  }));

  // Get user information
  const user = await User.findByPk(userId, {
    attributes: ['first_name', 'last_name', 'email', 'phone', 'pan_number'],
    include: [
      {
        model: UserAddress,
        as: 'addresses',
        where: { is_primary: true },
        required: false,
        limit: 1
      }
    ]
  });

  // Prepare certificate data
  const certificateData = {
    user_id: userId,
    type: type,
    financial_year: financialYear,
    total_amount: eligibleAmount, // Use eligible amount as total for the certificate
    eligible_amount: eligibleAmount,
    donation_ids: eligibleDonations.map(d => d.id),
    donations_included: donationsIncluded,
    status: 'processing', // Start with processing status
    pan_number: user.pan_number,
    donor_address: user.addresses && user.addresses.length > 0 ? user.addresses[0].toJSON() : null,
    generation_metadata: {
      requested_at: new Date().toISOString(),
      donation_count: eligibleDonations.length,
      total_donations_in_year: donations.length,
      date_range: {
        start: startDate.toISOString(),
        end: endDate.toISOString()
      }
    }
  };

  // Create certificate record
  const certificate = await Certificate.create(certificateData);

  logger.contextLogger.database('Certificate generation requested', 'Certificate', {
    certificateId: certificate.id,
    userId: userId,
    financialYear: financialYear,
    type: type,
    eligibleAmount: eligibleAmount,
    donationCount: eligibleDonations.length
  });

  // TODO: Queue certificate generation job
  // In a real implementation, this would trigger a background job to:
  // 1. Generate PDF certificate
  // 2. Upload to cloud storage
  // 3. Update certificate record with file URL
  // 4. Send notification to user

  // For now, simulate processing (in production, this would be async)
  setTimeout(async () => {
    try {
      const projectName = (process.env.PROJECT_NAME || 'BDRF').toLowerCase();
      const certificateUrl = `https://certificates.${projectName}.org/${certificate.certificate_number}.pdf`;
      
      await certificate.markAsIssued(certificateUrl, null);
      
      logger.contextLogger.database('Certificate generated and issued', 'Certificate', {
        certificateId: certificate.id,
        certificateNumber: certificate.certificate_number
      });
    } catch (error) {
      logger.logError(error, {
        context: 'certificate_generation',
        certificateId: certificate.id
      });
    }
  }, 2000); // 2 second delay to simulate processing

  res.status(201).json({
    success: true,
    message: 'Certificate generation request submitted. You will receive it via email within 2-3 business days.',
    data: {
      certificate: {
        id: certificate.id,
        certificate_number: certificate.certificate_number,
        type: certificate.type,
        year: yearNum,
        status: certificate.status,
        requested_at: certificate.created_at
      }
    }
  });
});

/**
 * Get specific certificate details
 */
const getCertificateById = catchAsync(async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;

  const certificate = await Certificate.findOne({
    where: {
      id: id,
      user_id: userId
    }
  });

  if (!certificate) {
    throw new AppError('Certificate not found', 404, true, 'CERTIFICATE_NOT_FOUND');
  }

  // Get detailed certificate data with donations
  const certificateData = certificate.getPublicData();
  certificateData.donations_included = certificate.donations_included.map(donation => ({
    donation_id: donation.donation_id,
    amount: parseFloat(donation.amount),
    date: donation.date,
    campaign: donation.campaign || 'General Donation'
  }));

  res.status(200).json({
    success: true,
    data: {
      certificate: certificateData
    }
  });
});

/**
 * Download certificate PDF (increment download counter)
 */
const downloadCertificate = catchAsync(async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;

  const certificate = await Certificate.findOne({
    where: {
      id: id,
      user_id: userId,
      status: 'issued'
    }
  });

  if (!certificate) {
    throw new AppError('Certificate not found or not available for download', 404, true, 'CERTIFICATE_NOT_FOUND');
  }

  if (!certificate.file_url) {
    throw new AppError('Certificate file not available', 404, true, 'FILE_NOT_AVAILABLE');
  }

  // Check if certificate is expired
  if (certificate.expires_at && new Date() > certificate.expires_at) {
    throw new AppError('Certificate has expired', 400, true, 'CERTIFICATE_EXPIRED');
  }

  // Increment download count
  await certificate.increment('download_count');
  certificate.last_downloaded = new Date();
  await certificate.save();

  logger.contextLogger.database('Certificate downloaded', 'Certificate', {
    certificateId: certificate.id,
    userId: userId,
    downloadCount: certificate.download_count + 1
  });

  res.status(200).json({
    success: true,
    data: {
      download_url: certificate.file_url,
      file_name: `${certificate.certificate_number}.pdf`,
      file_size: certificate.file_size
    }
  });
});

module.exports = {
  getUserCertificates,
  generateCertificate,
  getCertificateById,
  downloadCertificate,
};