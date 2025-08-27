const { DataTypes, Model, Op } = require('sequelize');
const { sequelize } = require('../config/database');

class UserAddress extends Model {
  /**
   * Get full address as a string
   */
  get fullAddress() {
    const parts = [
      this.address_line_1,
      this.address_line_2,
      this.city,
      this.state,
      this.postal_code,
      this.country
    ].filter(Boolean);
    
    return parts.join(', ');
  }

  /**
   * Set as default address for user
   */
  async setAsDefault() {
    // First, remove default from all other addresses of this user
    await UserAddress.update(
      { is_default: false },
      { where: { user_id: this.user_id, id: { [Op.ne]: this.id } } }
    );
    
    // Set this address as default
    this.is_default = true;
    return await this.save();
  }
}

UserAddress.init({
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  user_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'users',
      key: 'id'
    },
    onUpdate: 'CASCADE',
    onDelete: 'CASCADE'
  },
  type: {
    type: DataTypes.ENUM('home', 'work', 'billing', 'shipping', 'other'),
    allowNull: false,
    defaultValue: 'home'
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
  company: {
    type: DataTypes.STRING(150),
    allowNull: true,
    validate: {
      len: [0, 150]
    }
  },
  address_line_1: {
    type: DataTypes.STRING(255),
    allowNull: false,
    validate: {
      len: [1, 255],
      notEmpty: true
    }
  },
  address_line_2: {
    type: DataTypes.STRING(255),
    allowNull: true,
    validate: {
      len: [0, 255]
    }
  },
  city: {
    type: DataTypes.STRING(100),
    allowNull: false,
    validate: {
      len: [1, 100],
      notEmpty: true
    }
  },
  state: {
    type: DataTypes.STRING(100),
    allowNull: false,
    validate: {
      len: [1, 100],
      notEmpty: true
    }
  },
  postal_code: {
    type: DataTypes.STRING(20),
    allowNull: false,
    validate: {
      len: [1, 20],
      notEmpty: true
    }
  },
  country: {
    type: DataTypes.STRING(100),
    allowNull: false,
    defaultValue: 'India',
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
  is_default: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
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
  modelName: 'UserAddress',
  tableName: 'user_addresses',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [
    {
      fields: ['user_id']
    },
    {
      fields: ['user_id', 'type']
    },
    {
      fields: ['user_id', 'is_default']
    },
    {
      fields: ['postal_code']
    },
    {
      fields: ['city', 'state']
    }
  ],
  hooks: {
    afterCreate: async (address) => {
      // If this is the first address for the user, make it default
      const userAddressCount = await UserAddress.count({
        where: { user_id: address.user_id }
      });
      
      if (userAddressCount === 1) {
        address.is_default = true;
        await address.save();
      }
    },
    beforeUpdate: async (address) => {
      // If setting as default, remove default from other addresses
      if (address.changed('is_default') && address.is_default) {
        await UserAddress.update(
          { is_default: false },
          { 
            where: { 
              user_id: address.user_id, 
              id: { [Op.ne]: address.id } 
            } 
          }
        );
      }
    }
  },
  scopes: {
    default: {
      where: {
        is_default: true
      }
    },
    byType: (type) => ({
      where: {
        type: type
      }
    })
  }
});

module.exports = UserAddress;