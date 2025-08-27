const { DataTypes, Model, Op } = require('sequelize');
const { sequelize } = require('../config/database');

class Statistics extends Model {
  /**
   * Check if statistic is active and should be displayed
   */
  get isActive() {
    return this.is_active && (!this.valid_until || new Date() <= this.valid_until);
  }

  /**
   * Format value for display
   */
  get formattedValue() {
    if (!this.value) return '0';
    
    const numValue = parseFloat(this.value);
    if (isNaN(numValue)) return this.value;
    
    // Format based on display format preference
    switch (this.display_format) {
      case 'currency':
        return new Intl.NumberFormat('en-IN', {
          style: 'currency',
          currency: 'INR',
          maximumFractionDigits: 0
        }).format(numValue);
      
      case 'percentage':
        return `${numValue}%`;
      
      case 'compact':
        if (numValue >= 10000000) { // 1 crore
          return `${(numValue / 10000000).toFixed(1)} Cr`;
        } else if (numValue >= 100000) { // 1 lakh
          return `${(numValue / 100000).toFixed(1)} L`;
        } else if (numValue >= 1000) { // 1 thousand
          return `${(numValue / 1000).toFixed(1)}K`;
        }
        return numValue.toLocaleString('en-IN');
      
      case 'suffix':
        return `${numValue.toLocaleString('en-IN')}${this.value_suffix || ''}`;
      
      default:
        return numValue.toLocaleString('en-IN');
    }
  }

  /**
   * Get public statistic data for display
   */
  getPublicData() {
    if (!this.isActive) return null;
    
    return {
      id: this.id,
      label: this.label,
      value: this.value,
      formatted_value: this.formattedValue,
      icon: this.icon,
      description: this.description,
      category: this.category,
      display_order: this.display_order,
      last_updated: this.last_updated || this.updated_at
    };
  }

  /**
   * Update statistic value
   */
  async updateValue(newValue, updateSource = null) {
    this.value = newValue;
    this.last_updated = new Date();
    
    if (updateSource) {
      this.metadata = {
        ...this.metadata,
        last_update_source: updateSource,
        update_history: [
          ...(this.metadata?.update_history || []).slice(-9), // Keep last 9 entries
          {
            date: new Date().toISOString(),
            value: newValue,
            source: updateSource
          }
        ]
      };
    }
    
    return await this.save();
  }

  /**
   * Increment statistic value
   */
  async incrementValue(incrementBy = 1, updateSource = null) {
    const currentValue = parseFloat(this.value) || 0;
    return await this.updateValue(currentValue + incrementBy, updateSource);
  }
}

Statistics.init({
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  label: {
    type: DataTypes.STRING(255),
    allowNull: false,
    validate: {
      len: [1, 255],
      notEmpty: true
    },
    comment: 'Display label for the statistic (e.g., "Lives Impacted", "Villages Reached")'
  },
  key: {
    type: DataTypes.STRING(100),
    allowNull: false,
    unique: true,
    validate: {
      len: [1, 100],
      is: /^[a-z0-9_]+$/ // Only lowercase letters, numbers, and underscores
    },
    comment: 'Unique key for programmatic access'
  },
  value: {
    type: DataTypes.STRING(50),
    allowNull: false,
    defaultValue: '0',
    comment: 'Statistic value (stored as string to handle text like "5,00,000+")'
  },
  category: {
    type: DataTypes.ENUM(
      'impact',
      'reach',
      'financial',
      'projects',
      'events',
      'volunteers',
      'donations',
      'beneficiaries',
      'infrastructure',
      'environment',
      'healthcare',
      'education',
      'other'
    ),
    allowNull: false,
    defaultValue: 'impact'
  },
  icon: {
    type: DataTypes.STRING(50),
    allowNull: true,
    validate: {
      len: [0, 50]
    },
    comment: 'Icon class or name for UI display'
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true,
    validate: {
      len: [0, 500]
    },
    comment: 'Brief description explaining what this statistic represents'
  },
  display_format: {
    type: DataTypes.ENUM('number', 'currency', 'percentage', 'compact', 'suffix', 'text'),
    allowNull: false,
    defaultValue: 'number',
    comment: 'How to format the value for display'
  },
  value_suffix: {
    type: DataTypes.STRING(10),
    allowNull: true,
    comment: 'Suffix to append to value (e.g., "+", "K", "Cr")'
  },
  display_order: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
    validate: {
      min: 0
    },
    comment: 'Order for displaying statistics (lower numbers shown first)'
  },
  is_active: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true,
    comment: 'Whether this statistic should be displayed publicly'
  },
  is_featured: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false,
    comment: 'Whether this statistic should be featured prominently'
  },
  is_real_time: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false,
    comment: 'Whether this statistic is updated in real-time or manually'
  },
  update_frequency: {
    type: DataTypes.ENUM('real-time', 'hourly', 'daily', 'weekly', 'monthly', 'manual'),
    allowNull: false,
    defaultValue: 'manual',
    comment: 'How frequently this statistic is updated'
  },
  data_source: {
    type: DataTypes.STRING(255),
    allowNull: true,
    comment: 'Source of the data (e.g., database query, API, manual entry)'
  },
  calculation_method: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'Description of how this statistic is calculated'
  },
  valid_from: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: 'When this statistic becomes valid for display'
  },
  valid_until: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: 'When this statistic expires and should no longer be displayed'
  },
  last_updated: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: 'When the value was last updated'
  },
  target_value: {
    type: DataTypes.STRING(50),
    allowNull: true,
    comment: 'Target or goal value for this statistic'
  },
  baseline_value: {
    type: DataTypes.STRING(50),
    allowNull: true,
    comment: 'Starting or baseline value for comparison'
  },
  color_scheme: {
    type: DataTypes.STRING(50),
    allowNull: true,
    comment: 'Color theme for UI display'
  },
  tags: {
    type: DataTypes.JSONB,
    defaultValue: [],
    comment: 'Tags for filtering and categorization'
  },
  metadata: {
    type: DataTypes.JSONB,
    defaultValue: {},
    comment: 'Additional metadata including update history, sources, etc.'
  },
  created_by: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'users',
      key: 'id'
    },
    onUpdate: 'CASCADE',
    onDelete: 'RESTRICT'
  },
  updated_by: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: 'users',
      key: 'id'
    },
    onUpdate: 'CASCADE',
    onDelete: 'SET NULL'
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
  modelName: 'Statistics',
  tableName: 'statistics',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  hooks: {
    beforeUpdate: async (statistic) => {
      // Update last_updated when value changes
      if (statistic.changed('value')) {
        statistic.last_updated = new Date();
      }
    }
  },
  indexes: [
    {
      unique: true,
      fields: ['key']
    },
    {
      fields: ['category']
    },
    {
      fields: ['is_active']
    },
    {
      fields: ['is_featured']
    },
    {
      fields: ['display_order']
    },
    {
      fields: ['update_frequency']
    },
    {
      fields: ['created_by']
    },
    {
      fields: ['updated_by']
    },
    {
      fields: ['valid_from']
    },
    {
      fields: ['valid_until']
    },
    {
      fields: ['last_updated']
    },
    {
      fields: ['created_at']
    },
    {
      fields: ['category', 'is_active']
    },
    {
      fields: ['is_active', 'display_order']
    },
    {
      fields: ['is_featured', 'is_active']
    },
    // GIN indexes for JSONB columns
    {
      fields: ['tags'],
      using: 'gin'
    },
    {
      fields: ['metadata'],
      using: 'gin'
    }
  ],
  scopes: {
    active: {
      where: {
        is_active: true,
        [Op.or]: [
          { valid_until: null },
          { valid_until: { [Op.gte]: new Date() } }
        ]
      }
    },
    featured: {
      where: {
        is_active: true,
        is_featured: true,
        [Op.or]: [
          { valid_until: null },
          { valid_until: { [Op.gte]: new Date() } }
        ]
      }
    },
    byCategory: (category) => ({
      where: {
        category: category,
        is_active: true,
        [Op.or]: [
          { valid_until: null },
          { valid_until: { [Op.gte]: new Date() } }
        ]
      }
    }),
    realTime: {
      where: {
        is_real_time: true,
        is_active: true
      }
    },
    needsUpdate: (frequency) => ({
      where: {
        update_frequency: frequency,
        is_active: true,
        is_real_time: false
      }
    }),
    public: {
      where: {
        is_active: true,
        [Op.or]: [
          { valid_from: null },
          { valid_from: { [Op.lte]: new Date() } }
        ],
        [Op.or]: [
          { valid_until: null },
          { valid_until: { [Op.gte]: new Date() } }
        ]
      },
      order: [['display_order', 'ASC']]
    }
  }
});

module.exports = Statistics;