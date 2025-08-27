const { DataTypes, Model, Op } = require('sequelize');
const { sequelize } = require('../config/database');

class EventRegistration extends Model {
  /**
   * Check if registration is confirmed and active
   */
  get isConfirmed() {
    return this.status === 'confirmed';
  }

  /**
   * Check if registration is pending approval
   */
  get isPending() {
    return this.status === 'pending';
  }

  /**
   * Check if registration is cancelled
   */
  get isCancelled() {
    return this.status === 'cancelled';
  }

  /**
   * Check if registration requires payment
   */
  get requiresPayment() {
    return this.Event && 
           parseFloat(this.Event.registration_fee || 0) > 0 && 
           this.payment_status !== 'completed';
  }

  /**
   * Check if registration is fully paid
   */
  get isFullyPaid() {
    return this.payment_status === 'completed' || 
           !this.requiresPayment;
  }

  /**
   * Get total registration amount
   */
  get totalAmount() {
    const baseAmount = parseFloat(this.registration_amount || 0);
    const additionalFees = parseFloat(this.additional_fees || 0);
    return baseAmount + additionalFees;
  }

  /**
   * Generate registration number
   */
  static generateRegistrationNumber(eventId, sequenceNumber) {
    const eventIdShort = eventId.substring(0, 8).toUpperCase();
    const paddedSequence = String(sequenceNumber).padStart(4, '0');
    const year = new Date().getFullYear();
    return `REG${year}${eventIdShort}${paddedSequence}`;
  }

  /**
   * Get display data for registration
   */
  getDisplayData() {
    const eventData = this.Event ? {
      id: this.Event.id,
      title: this.Event.title,
      slug: this.Event.slug,
      start_date: this.Event.start_date,
      end_date: this.Event.end_date,
      location: this.Event.location,
      featured_image: this.Event.featured_image,
      registration_fee: this.Event.registration_fee
    } : null;

    return {
      id: this.id,
      registration_number: this.registration_number,
      participant_count: this.participant_count,
      status: this.status,
      payment_status: this.payment_status,
      total_amount: this.totalAmount,
      contact_phone: this.contact_phone,
      special_requirements: this.special_requirements,
      is_confirmed: this.isConfirmed,
      requires_payment: this.requiresPayment,
      is_fully_paid: this.isFullyPaid,
      registered_at: this.created_at,
      event: eventData
    };
  }

  /**
   * Get admin registration data (includes all fields)
   */
  getAdminData() {
    return {
      ...this.getDisplayData(),
      user_id: this.user_id,
      event_id: this.event_id,
      participant_details: this.participant_details,
      emergency_contact: this.emergency_contact,
      dietary_requirements: this.dietary_requirements,
      accessibility_needs: this.accessibility_needs,
      registration_amount: this.registration_amount,
      additional_fees: this.additional_fees,
      payment_method: this.payment_method,
      transaction_id: this.transaction_id,
      check_in_status: this.check_in_status,
      check_in_time: this.check_in_time,
      check_out_time: this.check_out_time,
      attendance_marked: this.attendance_marked,
      certificate_issued: this.certificate_issued,
      feedback_submitted: this.feedback_submitted,
      metadata: this.metadata,
      confirmed_by: this.confirmed_by,
      confirmed_at: this.confirmed_at,
      cancelled_by: this.cancelled_by,
      cancelled_at: this.cancelled_at,
      created_at: this.created_at,
      updated_at: this.updated_at
    };
  }

  /**
   * Confirm registration
   */
  async confirm(confirmedBy = null) {
    this.status = 'confirmed';
    this.confirmed_at = new Date();
    this.confirmed_by = confirmedBy;
    return await this.save();
  }

  /**
   * Cancel registration
   */
  async cancel(cancelledBy = null, reason = null) {
    this.status = 'cancelled';
    this.cancelled_at = new Date();
    this.cancelled_by = cancelledBy;
    
    if (reason) {
      this.metadata = {
        ...this.metadata,
        cancellation_reason: reason
      };
    }
    
    return await this.save();
  }

  /**
   * Mark as checked in
   */
  async checkIn() {
    this.check_in_status = 'checked_in';
    this.check_in_time = new Date();
    return await this.save();
  }

  /**
   * Mark as checked out
   */
  async checkOut() {
    this.check_in_status = 'checked_out';
    this.check_out_time = new Date();
    return await this.save();
  }

  /**
   * Mark attendance
   */
  async markAttendance(attended = true) {
    this.attendance_marked = attended;
    return await this.save();
  }

  /**
   * Update payment status
   */
  async updatePaymentStatus(status, transactionId = null, paymentMethod = null) {
    this.payment_status = status;
    
    if (transactionId) {
      this.transaction_id = transactionId;
    }
    
    if (paymentMethod) {
      this.payment_method = paymentMethod;
    }
    
    return await this.save();
  }
}

EventRegistration.init({
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  registration_number: {
    type: DataTypes.STRING(50),
    allowNull: false,
    unique: true,
    comment: 'Unique registration number for tracking'
  },
  event_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'events',
      key: 'id'
    },
    onUpdate: 'CASCADE',
    onDelete: 'CASCADE'
  },
  user_id: {
    type: DataTypes.UUID,
    allowNull: true, // Allow anonymous registrations
    references: {
      model: 'users',
      key: 'id'
    },
    onUpdate: 'CASCADE',
    onDelete: 'SET NULL'
  },
  participant_count: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 1,
    validate: {
      min: 1,
      max: 10
    },
    comment: 'Number of participants registered'
  },
  participant_details: {
    type: DataTypes.JSONB,
    defaultValue: [],
    comment: 'Details of all participants including names, ages, etc.'
  },
  contact_phone: {
    type: DataTypes.STRING(20),
    allowNull: false,
    validate: {
      is: /^[+]?[1-9][\d\s-()]+$/,
      notEmpty: true
    }
  },
  contact_email: {
    type: DataTypes.STRING(255),
    allowNull: true,
    validate: {
      isEmail: true
    }
  },
  emergency_contact: {
    type: DataTypes.JSONB,
    allowNull: true,
    comment: 'Emergency contact information'
  },
  special_requirements: {
    type: DataTypes.TEXT,
    allowNull: true,
    validate: {
      len: [0, 1000]
    },
    comment: 'Special requirements or requests from participant'
  },
  dietary_requirements: {
    type: DataTypes.JSONB,
    defaultValue: [],
    comment: 'Dietary restrictions and preferences'
  },
  accessibility_needs: {
    type: DataTypes.JSONB,
    defaultValue: [],
    comment: 'Accessibility requirements'
  },
  status: {
    type: DataTypes.ENUM('pending', 'confirmed', 'waitlisted', 'cancelled', 'no_show'),
    allowNull: false,
    defaultValue: 'pending'
  },
  // Payment-related fields
  registration_amount: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0.00,
    validate: {
      min: 0
    },
    comment: 'Base registration fee'
  },
  additional_fees: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0.00,
    validate: {
      min: 0
    },
    comment: 'Additional fees like materials, meals, etc.'
  },
  payment_status: {
    type: DataTypes.ENUM('pending', 'completed', 'failed', 'refunded', 'waived'),
    allowNull: false,
    defaultValue: 'pending'
  },
  payment_method: {
    type: DataTypes.STRING(50),
    allowNull: true,
    comment: 'Payment method used'
  },
  transaction_id: {
    type: DataTypes.STRING(255),
    allowNull: true,
    comment: 'Payment transaction reference'
  },
  // Check-in/Check-out tracking
  check_in_status: {
    type: DataTypes.ENUM('not_checked_in', 'checked_in', 'checked_out'),
    allowNull: false,
    defaultValue: 'not_checked_in'
  },
  check_in_time: {
    type: DataTypes.DATE,
    allowNull: true
  },
  check_out_time: {
    type: DataTypes.DATE,
    allowNull: true
  },
  attendance_marked: {
    type: DataTypes.BOOLEAN,
    allowNull: true,
    comment: 'Whether attendance was marked (null = not yet marked)'
  },
  // Post-event tracking
  certificate_issued: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  certificate_url: {
    type: DataTypes.STRING(500),
    allowNull: true,
    validate: {
      isUrl: true
    }
  },
  feedback_submitted: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  feedback_rating: {
    type: DataTypes.INTEGER,
    allowNull: true,
    validate: {
      min: 1,
      max: 5
    }
  },
  feedback_comment: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  // Communication tracking
  confirmation_email_sent: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  reminder_sent: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  follow_up_sent: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  // Source and referral tracking
  registration_source: {
    type: DataTypes.STRING(100),
    allowNull: true,
    comment: 'Source of registration (website, social media, etc.)'
  },
  referral_code: {
    type: DataTypes.STRING(50),
    allowNull: true,
    comment: 'Referral or promo code used'
  },
  tags: {
    type: DataTypes.JSONB,
    defaultValue: [],
    comment: 'Tags for categorization and filtering'
  },
  metadata: {
    type: DataTypes.JSONB,
    defaultValue: {},
    comment: 'Additional registration metadata'
  },
  // Audit fields
  confirmed_by: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: 'users',
      key: 'id'
    },
    onUpdate: 'CASCADE',
    onDelete: 'SET NULL'
  },
  confirmed_at: {
    type: DataTypes.DATE,
    allowNull: true
  },
  cancelled_by: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: 'users',
      key: 'id'
    },
    onUpdate: 'CASCADE',
    onDelete: 'SET NULL'
  },
  cancelled_at: {
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
  modelName: 'EventRegistration',
  tableName: 'event_registrations',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  hooks: {
    beforeCreate: async (registration) => {
      // Generate registration number if not provided
      if (!registration.registration_number) {
        // Get the next sequence number for the event
        const existingCount = await EventRegistration.count({
          where: {
            event_id: registration.event_id
          }
        });
        
        registration.registration_number = EventRegistration.generateRegistrationNumber(
          registration.event_id, 
          existingCount + 1
        );
      }
    }
  },
  indexes: [
    {
      unique: true,
      fields: ['registration_number']
    },
    {
      fields: ['event_id']
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
      fields: ['check_in_status']
    },
    {
      fields: ['attendance_marked']
    },
    {
      fields: ['contact_phone']
    },
    {
      fields: ['contact_email']
    },
    {
      fields: ['confirmed_by']
    },
    {
      fields: ['cancelled_by']
    },
    {
      fields: ['created_at']
    },
    {
      fields: ['confirmed_at']
    },
    {
      fields: ['cancelled_at']
    },
    {
      fields: ['event_id', 'status']
    },
    {
      fields: ['event_id', 'payment_status']
    },
    {
      fields: ['user_id', 'status']
    },
    {
      fields: ['status', 'check_in_status']
    },
    // GIN indexes for JSONB columns
    {
      fields: ['tags'],
      using: 'gin'
    },
    {
      fields: ['participant_details'],
      using: 'gin'
    }
  ],
  scopes: {
    confirmed: {
      where: {
        status: 'confirmed'
      }
    },
    pending: {
      where: {
        status: 'pending'
      }
    },
    cancelled: {
      where: {
        status: 'cancelled'
      }
    },
    waitlisted: {
      where: {
        status: 'waitlisted'
      }
    },
    paidRegistrations: {
      where: {
        payment_status: 'completed'
      }
    },
    pendingPayment: {
      where: {
        payment_status: 'pending'
      }
    },
    checkedIn: {
      where: {
        check_in_status: 'checked_in'
      }
    },
    attended: {
      where: {
        attendance_marked: true
      }
    },
    byEvent: (eventId) => ({
      where: {
        event_id: eventId
      }
    }),
    byUser: (userId) => ({
      where: {
        user_id: userId
      }
    }),
    needingConfirmation: {
      where: {
        status: 'pending',
        confirmation_email_sent: false
      }
    },
    needingReminder: (eventDate) => ({
      where: {
        status: 'confirmed',
        reminder_sent: false
      },
      include: [{
        model: sequelize.models.Event,
        as: 'event',
        where: {
          start_date: {
            [Op.gte]: new Date(),
            [Op.lte]: eventDate
          }
        }
      }]
    }),
    recent: {
      order: [['created_at', 'DESC']],
      limit: 50
    }
  }
});

module.exports = EventRegistration;