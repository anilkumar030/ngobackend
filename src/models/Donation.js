const { DataTypes, Model, Op } = require('sequelize');
const { sequelize } = require('../config/database');

class Donation extends Model {
  /**
   * Check if donation is successful
   */
  get isSuccessful() {
    return this.payment_status === 'completed' && this.status === 'completed';
  }

  /**
   * Check if donation is pending
   */
  get isPending() {
    return this.payment_status === 'pending' || this.status === 'pending';
  }

  /**
   * Check if donation failed
   */
  get isFailed() {
    return this.payment_status === 'failed' || this.status === 'failed';
  }

  /**
   * Get donor display name (anonymous or actual name)
   */
  get donorDisplayName() {
    if (this.is_anonymous || !this.show_name_publicly) {
      return 'Anonymous Donor';
    }
    
    if (this.donor_name) {
      return this.donor_name;
    }
    
    return 'Anonymous Donor';
  }

  /**
   * Get donation amount in rupees (from paise)
   */
  get donationAmountInRupees() {
    return this.donation_amount / 100;
  }

  /**
   * Get tip amount in rupees (from paise)
   */
  get tipAmountInRupees() {
    return this.tip_amount / 100;
  }

  /**
   * Get total amount in rupees (from paise)
   */
  get totalAmountInRupees() {
    return this.total_amount / 100;
  }

  /**
   * Check if donor provided PAN for 80G certificate
   */
  get canReceive80GCertificate() {
    return !!(this.donor_pan && this.donor_address);
  }

  /**
   * Get public donation data (safe for display)
   */
  getPublicData() {
    return {
      id: this.id,
      amount: this.amount,
      currency: this.currency,
      donor_name: this.donorDisplayName,
      message: this.is_anonymous ? null : this.message,
      created_at: this.created_at,
      is_anonymous: this.is_anonymous
    };
  }

  /**
   * Mark donation as completed
   */
  async markCompleted(paymentDetails = {}) {
    this.status = 'completed';
    this.payment_status = 'completed';
    this.completed_at = new Date();
    
    if (paymentDetails.transaction_id) {
      this.transaction_id = paymentDetails.transaction_id;
    }
    
    if (paymentDetails.payment_method) {
      this.payment_method = paymentDetails.payment_method;
    }
    
    return await this.save();
  }

  /**
   * Mark donation as failed
   */
  async markFailed(reason = null) {
    this.status = 'failed';
    this.payment_status = 'failed';
    this.failed_at = new Date();
    
    if (reason) {
      this.failure_reason = reason;
    }
    
    return await this.save();
  }

  /**
   * Generate receipt data
   */
  generateReceiptData() {
    if (!this.isSuccessful) {
      throw new Error('Cannot generate receipt for incomplete donation');
    }
    
    return {
      donation_id: this.id,
      receipt_number: this.receipt_number,
      donor_name: this.donor_name,
      donor_email: this.donor_email,
      amount: this.amount,
      currency: this.currency,
      payment_method: this.payment_method,
      transaction_id: this.transaction_id,
      donation_date: this.completed_at || this.created_at,
      campaign_title: this.Campaign?.title,
      is_tax_exempted: true // Assuming religious donations are tax-exempt in India
    };
  }

  /**
   * Get donation statistics for a campaign
   */
  static async getCampaignStats(campaignId) {
    const stats = await this.findAll({
      where: {
        campaign_id: campaignId,
        status: 'completed'
      },
      attributes: [
        [sequelize.fn('COUNT', sequelize.col('id')), 'total_donations'],
        [sequelize.fn('SUM', sequelize.col('donation_amount')), 'total_amount_paise'],
        [sequelize.fn('AVG', sequelize.col('donation_amount')), 'average_amount_paise'],
        [sequelize.fn('MAX', sequelize.col('donation_amount')), 'highest_amount_paise'],
        [sequelize.fn('MIN', sequelize.col('donation_amount')), 'lowest_amount_paise']
      ],
      raw: true
    });
    
    const result = stats[0];
    return {
      total_donations: parseInt(result.total_donations) || 0,
      total_amount: Math.round((result.total_amount_paise || 0) / 100),
      average_amount: Math.round((result.average_amount_paise || 0) / 100),
      highest_amount: Math.round((result.highest_amount_paise || 0) / 100),
      lowest_amount: Math.round((result.lowest_amount_paise || 0) / 100)
    };
  }
}

Donation.init({
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  campaign_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'campaigns',
      key: 'id'
    },
    onUpdate: 'CASCADE',
    onDelete: 'RESTRICT'
  },
  user_id: {
    type: DataTypes.UUID,
    allowNull: true, // Nullable for anonymous donations
    references: {
      model: 'users',
      key: 'id'
    },
    onUpdate: 'CASCADE',
    onDelete: 'SET NULL'
  },
  // Base donation amount in paise (stored as integer for precision)
  donation_amount: {
    type: DataTypes.INTEGER,
    allowNull: false,
    validate: {
      min: 100, // Minimum ₹1 in paise
      max: 100000000 // Maximum ₹10,00,000 in paise
    },
    comment: 'Base donation amount in paise'
  },
  // Tip amount in paise  
  tip_amount: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
    validate: {
      min: 0,
      max: 10000000 // Maximum ₹1,00,000 tip in paise
    },
    comment: 'Tip amount in paise'
  },
  // Total amount (donation + tip) in paise
  total_amount: {
    type: DataTypes.INTEGER,
    allowNull: false,
    validate: {
      min: 100, // Minimum ₹1 in paise
      max: 110000000 // Maximum ₹11,00,000 total in paise
    },
    comment: 'Total amount (donation + tip) in paise'
  },
  // Keep the old amount field for backward compatibility (will be calculated from donation_amount)
  amount: {
    type: DataTypes.DECIMAL(15, 2),
    allowNull: false,
    validate: {
      min: 1, // Minimum ₹1
      max: 1000000 // Maximum ₹10,00,000 per donation
    }
  },
  currency: {
    type: DataTypes.STRING(3),
    allowNull: false,
    defaultValue: 'INR',
    validate: {
      isIn: [['INR', 'USD', 'EUR']] // Supported currencies
    }
  },
  donor_name: {
    type: DataTypes.STRING(255),
    allowNull: true,
    validate: {
      len: [0, 255]
    }
  },
  donor_email: {
    type: DataTypes.STRING(255),
    allowNull: true,
    validate: {
      isEmail: true,
      len: [0, 255]
    }
  },
  donor_phone: {
    type: DataTypes.STRING(20),
    allowNull: true,
    validate: {
      is: /^[+]?[1-9][\d\s-()]+$/
    }
  },
  // PAN number for 80G certificate (optional)
  donor_pan: {
    type: DataTypes.STRING(10),
    allowNull: true,
    validate: {
      is: /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/i // PAN format validation
    },
    comment: 'PAN number for 80G tax certificate'
  },
  // Address for 80G certificate (optional)
  donor_address: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'Donor address for 80G certificate and receipts'
  },
  // What the donation is for
  donation_towards: {
    type: DataTypes.STRING(255),
    allowNull: false,
    comment: 'What the donation is for (e.g., "Sadhu Welfare Seva")'
  },
  message: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'Optional message from donor'
  },
  // Preference to display name publicly on campaign  
  show_name_publicly: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false,
    comment: 'Whether to display donor name publicly on campaign'
  },
  // Preference to receive WhatsApp updates
  receive_whatsapp_updates: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false,
    comment: 'Whether to receive WhatsApp notifications and updates'
  },
  is_anonymous: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    comment: 'Whether to display donor information publicly'
  },
  status: {
    type: DataTypes.ENUM('pending', 'completed', 'failed', 'refunded', 'cancelled'),
    allowNull: false,
    defaultValue: 'pending'
  },
  payment_status: {
    type: DataTypes.ENUM('pending', 'processing', 'completed', 'failed', 'refunded'),
    allowNull: false,
    defaultValue: 'pending'
  },
  payment_method: {
    type: DataTypes.STRING(50),
    allowNull: true,
    comment: 'Payment method used (card, netbanking, upi, wallet)'
  },
  payment_gateway: {
    type: DataTypes.STRING(50),
    allowNull: false,
    defaultValue: 'razorpay'
  },
  // Razorpay specific fields (aligned with API requirements)
  razorpay_order_id: {
    type: DataTypes.STRING(255),
    allowNull: true,
    comment: 'Razorpay order ID'
  },
  razorpay_payment_id: {
    type: DataTypes.STRING(255),
    allowNull: true,
    comment: 'Razorpay payment ID (after payment)'
  },
  // Keep old field names for backward compatibility
  payment_gateway_order_id: {
    type: DataTypes.STRING(255),
    allowNull: true,
    comment: 'Order ID from payment gateway (deprecated, use razorpay_order_id)'
  },
  payment_gateway_payment_id: {
    type: DataTypes.STRING(255),
    allowNull: true,
    comment: 'Payment ID from payment gateway (deprecated, use razorpay_payment_id)'
  },
  transaction_id: {
    type: DataTypes.STRING(255),
    allowNull: true,
    comment: 'Bank transaction ID'
  },
  receipt_number: {
    type: DataTypes.STRING(100),
    allowNull: true,
    unique: true,
    comment: 'Receipt number for tax purposes'
  },
  failure_reason: {
    type: DataTypes.STRING(500),
    allowNull: true,
    comment: 'Reason for payment failure'
  },
  refund_amount: {
    type: DataTypes.DECIMAL(15, 2),
    allowNull: true,
    validate: {
      min: 0
    }
  },
  refund_reason: {
    type: DataTypes.STRING(500),
    allowNull: true
  },
  tax_benefit_claimed: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    comment: '80G tax benefit claimed'
  },
  howyoucanhelp: {
    type: DataTypes.JSONB,
    allowNull: true,
    comment: 'Specific help option selected for this donation - {title: "One hygiene kit", amount: 500}'
  },
  metadata: {
    type: DataTypes.JSONB,
    defaultValue: {},
    comment: 'Additional payment and processing metadata'
  },
  completed_at: {
    type: DataTypes.DATE,
    allowNull: true
  },
  failed_at: {
    type: DataTypes.DATE,
    allowNull: true
  },
  refunded_at: {
    type: DataTypes.DATE,
    allowNull: true
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
  modelName: 'Donation',
  tableName: 'donations',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  hooks: {
    beforeCreate: async (donation) => {
      // Set amount field for backward compatibility (use donation_amount)
      if (donation.donation_amount && !donation.amount) {
        donation.amount = donation.donation_amount / 100; // Convert paise to rupees
      }
      
      // Ensure total_amount is consistent
      if (donation.donation_amount && donation.tip_amount !== undefined && !donation.total_amount) {
        donation.total_amount = donation.donation_amount + donation.tip_amount;
      }
      
      // Set razorpay fields for backward compatibility
      if (donation.razorpay_order_id && !donation.payment_gateway_order_id) {
        donation.payment_gateway_order_id = donation.razorpay_order_id;
      }
      if (donation.razorpay_payment_id && !donation.payment_gateway_payment_id) {
        donation.payment_gateway_payment_id = donation.razorpay_payment_id;
      }

      // Generate receipt number for completed donations
      if (donation.status === 'completed' && !donation.receipt_number) {
        const date = new Date();
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        
        // Count donations for the day to generate sequential number
        const todayDonationsCount = await Donation.count({
          where: {
            created_at: {
              [Op.gte]: new Date(year, date.getMonth(), date.getDate()),
              [Op.lt]: new Date(year, date.getMonth(), date.getDate() + 1)
            }
          }
        });
        
        donation.receipt_number = `SD${year}${month}${day}${String(todayDonationsCount + 1).padStart(4, '0')}`;
      }
    },
    beforeUpdate: async (donation) => {
      // Update amount field for backward compatibility when donation_amount changes
      if (donation.changed('donation_amount')) {
        donation.amount = donation.donation_amount / 100;
      }
      
      // Update total_amount if component amounts change
      if (donation.changed('donation_amount') || donation.changed('tip_amount')) {
        donation.total_amount = donation.donation_amount + (donation.tip_amount || 0);
      }
      
      // Set razorpay fields for backward compatibility
      if (donation.changed('razorpay_order_id') && !donation.payment_gateway_order_id) {
        donation.payment_gateway_order_id = donation.razorpay_order_id;
      }
      if (donation.changed('razorpay_payment_id') && !donation.payment_gateway_payment_id) {
        donation.payment_gateway_payment_id = donation.razorpay_payment_id;
      }
    },
    afterUpdate: async (donation) => {
      // Generate receipt number when donation is marked as completed
      if (donation.changed('status') && donation.status === 'completed' && !donation.receipt_number) {
        const date = new Date();
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        
        const todayDonationsCount = await Donation.count({
          where: {
            created_at: {
              [Op.gte]: new Date(year, date.getMonth(), date.getDate()),
              [Op.lt]: new Date(year, date.getMonth(), date.getDate() + 1)
            },
            status: 'completed'
          }
        });
        
        donation.receipt_number = `SD${year}${month}${day}${String(todayDonationsCount + 1).padStart(4, '0')}`;
        await donation.save();
      }
    }
  },
  indexes: [
    {
      fields: ['campaign_id']
    },
    {
      fields: ['user_id']
    },
    {
      fields: ['status']
    },
    {
      fields: ['payment_status']
    },
    {
      fields: ['razorpay_order_id']
    },
    {
      fields: ['razorpay_payment_id']
    },
    {
      fields: ['payment_gateway_order_id']
    },
    {
      fields: ['payment_gateway_payment_id']
    },
    {
      unique: true,
      fields: ['receipt_number']
    },
    {
      fields: ['donor_email']
    },
    {
      fields: ['donor_phone']
    },
    {
      fields: ['donation_towards']
    },
    {
      fields: ['show_name_publicly']
    },
    {
      fields: ['receive_whatsapp_updates']
    },
    {
      fields: ['created_at']
    },
    {
      fields: ['completed_at']
    },
    {
      fields: ['campaign_id', 'status']
    },
    {
      fields: ['user_id', 'status']
    },
    {
      fields: ['amount']
    },
    {
      fields: ['is_anonymous']
    },
    {
      fields: ['howyoucanhelp'],
      using: 'gin'
    }
  ],
  scopes: {
    successful: {
      where: {
        status: 'completed',
        payment_status: 'completed'
      }
    },
    pending: {
      where: {
        status: 'pending'
      }
    },
    failed: {
      where: {
        status: 'failed'
      }
    },
    anonymous: {
      where: {
        is_anonymous: true
      }
    },
    public: {
      where: {
        status: 'completed'
      }
    },
    recentDonations: {
      where: {
        status: 'completed'
      },
      order: [['completed_at', 'DESC']],
      limit: 10
    }
  }
});

module.exports = Donation;