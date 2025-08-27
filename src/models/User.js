const { DataTypes, Model, Op } = require('sequelize');
const bcrypt = require('bcryptjs');
const { sequelize } = require('../config/database');

class User extends Model {
  /**
   * Check if password matches the hashed password
   */
  async validatePassword(password) {
    return await bcrypt.compare(password, this.password_hash);
  }

  /**
   * Generate full name
   */
  get fullName() {
    return `${this.first_name} ${this.last_name}`.trim();
  }

  /**
   * Check if user has specific role
   */
  hasRole(role) {
    return this.role === role;
  }

  /**
   * Check if user is admin or super admin
   */
  isAdmin() {
    return ['admin', 'super_admin'].includes(this.role);
  }

  /**
   * Get safe user data (without sensitive information)
   */
  getSafeData() {
    const { password_hash, email_verification_token, phone_verification_code, reset_password_token, ...safeData } = this.toJSON();
    return safeData;
  }

  /**
   * Update total donations and count
   */
  async updateDonationStats(amount) {
    this.total_donations = (parseFloat(this.total_donations) || 0) + parseFloat(amount);
    this.donation_count = (this.donation_count || 0) + 1;
    return await this.save();
  }

  /**
   * Update last login timestamp
   */
  async updateLastLogin() {
    this.last_login = new Date();
    return await this.save();
  }
}

User.init({
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  email: {
    type: DataTypes.STRING(255),
    allowNull: false,
    unique: true,
    validate: {
      isEmail: true,
      len: [5, 255]
    }
  },
  password_hash: {
    type: DataTypes.STRING(255),
    allowNull: false,
    validate: {
      len: [60, 255] // bcrypt hash length
    }
  },
  first_name: {
    type: DataTypes.STRING(100),
    allowNull: false,
    validate: {
      len: [1, 100],
      notEmpty: true
    }
  },
  last_name: {
    type: DataTypes.STRING(100),
    allowNull: false,
    validate: {
      len: [1, 100],
      notEmpty: true
    }
  },
  phone_number: {
    type: DataTypes.STRING(20),
    allowNull: true,
    validate: {
      is: /^[+]?[1-9][\d\s-()]+$/
    }
  },
  date_of_birth: {
    type: DataTypes.DATEONLY,
    allowNull: true,
    validate: {
      isDate: true,
      isBefore: new Date().toISOString() // Cannot be in future
    }
  },
  gender: {
    type: DataTypes.ENUM('male', 'female', 'other', 'prefer_not_to_say'),
    allowNull: true
  },
  profile_image: {
    type: DataTypes.STRING(500),
    allowNull: true,
    validate: {
      isUrl: true
    }
  },
  role: {
    type: DataTypes.ENUM('user', 'admin', 'super_admin'),
    allowNull: false,
    defaultValue: 'user'
  },
  is_email_verified: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  is_phone_verified: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  email_verification_token: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  email_verified_at: {
    type: DataTypes.DATE,
    allowNull: true
  },
  phone_verification_code: {
    type: DataTypes.STRING(10),
    allowNull: true
  },
  phone_verified_at: {
    type: DataTypes.DATE,
    allowNull: true
  },
  reset_password_token: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  reset_password_expires: {
    type: DataTypes.DATE,
    allowNull: true
  },
  refresh_token: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  total_donations: {
    type: DataTypes.DECIMAL(15, 2),
    defaultValue: 0.00,
    validate: {
      min: 0
    }
  },
  donation_count: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    validate: {
      min: 0
    }
  },
  preferences: {
    type: DataTypes.JSONB,
    defaultValue: {},
    comment: 'User preferences like newsletter subscription, notification settings'
  },
  last_login: {
    type: DataTypes.DATE,
    allowNull: true
  },
  is_active: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  created_at: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  },
  updated_at: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  },
  deleted_at: {
    type: DataTypes.DATE,
    allowNull: true
  }
}, {
  sequelize,
  modelName: 'User',
  tableName: 'users',
  timestamps: true,
  paranoid: true, // Soft deletes
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  deletedAt: 'deleted_at',
  // Password hashing is handled in the AuthService to avoid double hashing
  indexes: [
    {
      unique: true,
      fields: ['email']
    },
    {
      fields: ['phone_number']
    },
    {
      fields: ['role']
    },
    {
      fields: ['is_email_verified']
    },
    {
      fields: ['is_active']
    },
    {
      fields: ['created_at']
    },
    {
      fields: ['total_donations']
    }
  ],
  scopes: {
    active: {
      where: {
        is_active: true,
        deleted_at: null
      }
    },
    verified: {
      where: {
        is_email_verified: true
      }
    },
    admins: {
      where: {
        role: ['admin', 'super_admin']
      }
    },
    donors: {
      where: {
        donation_count: {
          [Op.gt]: 0
        }
      }
    }
  }
});

module.exports = User;