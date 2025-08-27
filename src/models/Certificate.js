const { DataTypes, Model, Op } = require('sequelize');
const { sequelize } = require('../config/database');

class Certificate extends Model {
  /**
   * Check if certificate is valid and not expired
   */
  get isValid() {
    return this.status === 'issued' && 
           (!this.expires_at || new Date() <= this.expires_at);
  }

  /**
   * Check if certificate is ready for download
   */
  get isDownloadable() {
    return this.status === 'issued' && this.file_url;
  }

  /**
   * Calculate tax savings estimate (assuming 50% tax bracket)
   */
  get taxSavingsEstimate() {
    const taxRate = 0.30; // Assuming 30% tax bracket for estimate
    return Math.round(parseFloat(this.eligible_amount || this.total_amount) * taxRate);
  }

  /**
   * Generate certificate number based on pattern
   */
  static generateCertificateNumber(year, sequenceNumber, type = '80G') {
    const paddedSequence = String(sequenceNumber).padStart(6, '0');
    const projectName = process.env.PROJECT_NAME || 'BDRF';
    const typeUpperCase = type.toUpperCase();
    return `${projectName}/${typeUpperCase}/${year}/${paddedSequence}`;
  }

  /**
   * Get public certificate data for display
   */
  getPublicData() {
    return {
      id: this.id,
      certificate_number: this.certificate_number,
      type: this.type,
      financial_year: this.financial_year,
      total_amount: this.total_amount,
      eligible_amount: this.eligible_amount,
      tax_savings_estimate: this.taxSavingsEstimate,
      issue_date: this.issue_date,
      expires_at: this.expires_at,
      status: this.status,
      file_url: this.isDownloadable ? this.file_url : null,
      is_downloadable: this.isDownloadable,
      created_at: this.created_at
    };
  }

  /**
   * Get detailed certificate data for admin
   */
  getDetailedData() {
    return {
      ...this.getPublicData(),
      user_id: this.user_id,
      donation_ids: this.donation_ids,
      donations_included: this.donations_included,
      generation_metadata: this.generation_metadata,
      issued_by: this.issued_by,
      updated_at: this.updated_at
    };
  }

  /**
   * Mark certificate as issued
   */
  async markAsIssued(fileUrl, issuedBy) {
    this.status = 'issued';
    this.file_url = fileUrl;
    this.issue_date = new Date();
    this.issued_by = issuedBy;
    
    // Set expiry date (certificates typically valid for 5 years)
    this.expires_at = new Date(Date.now() + (5 * 365 * 24 * 60 * 60 * 1000));
    
    return await this.save();
  }

  /**
   * Mark certificate as expired or cancelled
   */
  async markAsInvalid(reason, updatedBy) {
    this.status = reason === 'expired' ? 'expired' : 'cancelled';
    this.generation_metadata = {
      ...this.generation_metadata,
      invalidation_reason: reason,
      invalidated_at: new Date(),
      invalidated_by: updatedBy
    };
    
    return await this.save();
  }
}

Certificate.init({
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  certificate_number: {
    type: DataTypes.STRING(100),
    allowNull: false,
    unique: true,
    validate: {
      len: [1, 100],
      notEmpty: true
    },
    comment: 'Unique certificate number (e.g., BDRF/80G/2024/001234)'
  },
  type: {
    type: DataTypes.ENUM('80g', 'annual_summary', 'project_specific', 'consolidated'),
    allowNull: false,
    defaultValue: '80g',
    comment: 'Type of tax exemption certificate'
  },
  financial_year: {
    type: DataTypes.STRING(10),
    allowNull: false,
    validate: {
      len: [9, 9], // Format: 2023-2024
      is: /^\d{4}-\d{4}$/
    },
    comment: 'Financial year for which certificate is issued (e.g., 2023-2024)'
  },
  user_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'users',
      key: 'id'
    },
    onUpdate: 'CASCADE',
    onDelete: 'RESTRICT',
    comment: 'User to whom this certificate is issued'
  },
  total_amount: {
    type: DataTypes.DECIMAL(15, 2),
    allowNull: false,
    validate: {
      min: 0
    },
    comment: 'Total donation amount for the period'
  },
  eligible_amount: {
    type: DataTypes.DECIMAL(15, 2),
    allowNull: false,
    validate: {
      min: 0
    },
    comment: 'Amount eligible for tax deduction (may be same as total or different based on regulations)'
  },
  donation_ids: {
    type: DataTypes.JSONB,
    defaultValue: [],
    comment: 'Array of donation IDs included in this certificate'
  },
  donations_included: {
    type: DataTypes.JSONB,
    defaultValue: [],
    comment: 'Detailed list of donations included with amounts and dates'
  },
  status: {
    type: DataTypes.ENUM('draft', 'processing', 'issued', 'cancelled', 'expired'),
    allowNull: false,
    defaultValue: 'draft'
  },
  issue_date: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: 'Date when certificate was issued'
  },
  expires_at: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: 'Certificate expiry date'
  },
  file_url: {
    type: DataTypes.STRING(500),
    allowNull: true,
    validate: {
      isUrl: true
    },
    comment: 'URL to the generated certificate PDF file'
  },
  file_size: {
    type: DataTypes.INTEGER,
    allowNull: true,
    validate: {
      min: 0
    },
    comment: 'File size in bytes'
  },
  download_count: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    validate: {
      min: 0
    },
    comment: 'Number of times certificate has been downloaded'
  },
  last_downloaded: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: 'Last download timestamp'
  },
  // Template and generation details
  template_version: {
    type: DataTypes.STRING(20),
    allowNull: true,
    comment: 'Version of certificate template used'
  },
  generation_metadata: {
    type: DataTypes.JSONB,
    defaultValue: {},
    comment: 'Metadata about certificate generation process, system info, etc.'
  },
  // Regulatory compliance fields
  pan_number: {
    type: DataTypes.STRING(20),
    allowNull: true,
    validate: {
      is: /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/
    },
    comment: 'PAN number of the donor for tax purposes'
  },
  donor_address: {
    type: DataTypes.JSONB,
    allowNull: true,
    comment: 'Donor address at the time of certificate generation'
  },
  organization_details: {
    type: DataTypes.JSONB,
    defaultValue: {},
    comment: 'Organization details like registration numbers, authorized signatory'
  },
  // Audit trail
  issued_by: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: 'users',
      key: 'id'
    },
    onUpdate: 'CASCADE',
    onDelete: 'SET NULL',
    comment: 'User who issued/approved the certificate'
  },
  verification_code: {
    type: DataTypes.STRING(50),
    allowNull: true,
    unique: true,
    comment: 'Unique code for certificate verification'
  },
  notes: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'Internal notes about certificate generation or any special conditions'
  },
  created_at: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  },
  updated_at: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  }
}, {
  sequelize,
  modelName: 'Certificate',
  tableName: 'certificates',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  hooks: {
    beforeCreate: async (certificate) => {
      // Generate certificate number if not provided
      if (!certificate.certificate_number) {
        const year = certificate.financial_year.split('-')[1]; // Get second year from 2023-2024
        
        // Get the next sequence number for the year
        const lastCertificate = await Certificate.findOne({
          where: {
            financial_year: certificate.financial_year
          },
          order: [['created_at', 'DESC']]
        });
        
        let sequenceNumber = 1;
        if (lastCertificate && lastCertificate.certificate_number) {
          const lastNumber = lastCertificate.certificate_number.split('/').pop();
          sequenceNumber = parseInt(lastNumber) + 1;
        }
        
        certificate.certificate_number = Certificate.generateCertificateNumber(year, sequenceNumber, certificate.type);
      }
      
      // Generate verification code
      if (!certificate.verification_code) {
        certificate.verification_code = `VERIFY-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
      }
    },
    afterUpdate: async (certificate) => {
      // Update download tracking
      if (certificate.changed('download_count')) {
        certificate.last_downloaded = new Date();
      }
    }
  },
  indexes: [
    {
      unique: true,
      fields: ['certificate_number']
    },
    {
      unique: true,
      fields: ['verification_code']
    },
    {
      fields: ['user_id']
    },
    {
      fields: ['type']
    },
    {
      fields: ['financial_year']
    },
    {
      fields: ['status']
    },
    {
      fields: ['issued_by']
    },
    {
      fields: ['issue_date']
    },
    {
      fields: ['expires_at']
    },
    {
      fields: ['created_at']
    },
    {
      fields: ['user_id', 'financial_year']
    },
    {
      fields: ['user_id', 'status']
    },
    {
      fields: ['financial_year', 'status']
    },
    {
      fields: ['status', 'type']
    },
    // GIN indexes for JSONB columns
    {
      fields: ['donation_ids'],
      using: 'gin'
    },
    {
      fields: ['donations_included'],
      using: 'gin'
    }
  ],
  scopes: {
    issued: {
      where: {
        status: 'issued'
      }
    },
    valid: {
      where: {
        status: 'issued',
        [Op.or]: [
          { expires_at: null },
          { expires_at: { [Op.gte]: new Date() } }
        ]
      }
    },
    byFinancialYear: (year) => ({
      where: {
        financial_year: year
      }
    }),
    byType: (type) => ({
      where: {
        type: type
      }
    }),
    downloadable: {
      where: {
        status: 'issued',
        file_url: {
          [Op.ne]: null
        }
      }
    },
    recent: {
      order: [['issue_date', 'DESC']],
      limit: 10
    },
    forUser: (userId) => ({
      where: {
        user_id: userId
      }
    })
  }
});

module.exports = Certificate;