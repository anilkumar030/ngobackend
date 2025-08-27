const { DataTypes, Model, Op } = require('sequelize');
const { sequelize } = require('../config/database');

class SavedCampaign extends Model {
  /**
   * Check if saved campaign is still active
   */
  get isActive() {
    return this.Campaign && 
           this.Campaign.status === 'active' && 
           this.Campaign.isActive;
  }

  /**
   * Check if campaign has been deleted or is no longer available
   */
  get isValidCampaign() {
    return this.Campaign !== null;
  }

  /**
   * Get display data for saved campaign
   */
  getDisplayData() {
    const campaignData = this.Campaign ? {
      id: this.Campaign.id,
      title: this.Campaign.title,
      slug: this.Campaign.slug,
      description: this.Campaign.description,
      target_amount: this.Campaign.target_amount,
      raised_amount: this.Campaign.raised_amount,
      progress_percentage: this.Campaign.progressPercentage,
      status: this.Campaign.actualStatus,
      featured_image: this.Campaign.images?.[0] || null,
      end_date: this.Campaign.end_date,
      category: this.Campaign.category,
      location: this.Campaign.location
    } : null;

    return {
      id: this.id,
      saved_at: this.created_at,
      notes: this.notes,
      is_notification_enabled: this.is_notification_enabled,
      campaign: campaignData,
      is_valid: this.isValidCampaign,
      is_active: this.isActive
    };
  }

  /**
   * Toggle notification settings
   */
  async toggleNotifications() {
    this.is_notification_enabled = !this.is_notification_enabled;
    this.last_notification_sent = null; // Reset notification tracking
    return await this.save();
  }

  /**
   * Update user notes
   */
  async updateNotes(notes) {
    this.notes = notes;
    return await this.save();
  }

  /**
   * Mark as notified (for update notifications)
   */
  async markNotified() {
    this.last_notification_sent = new Date();
    return await this.save();
  }
}

SavedCampaign.init({
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
  campaign_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'campaigns',
      key: 'id'
    },
    onUpdate: 'CASCADE',
    onDelete: 'CASCADE'
  },
  notes: {
    type: DataTypes.TEXT,
    allowNull: true,
    validate: {
      len: [0, 1000]
    },
    comment: 'Personal notes about why user saved this campaign'
  },
  is_notification_enabled: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    comment: 'Whether user wants notifications about campaign updates'
  },
  notification_preferences: {
    type: DataTypes.JSONB,
    defaultValue: {
      campaign_updates: true,
      milestone_reached: true,
      campaign_ending: true,
      campaign_completed: true
    },
    comment: 'Granular notification preferences'
  },
  last_notification_sent: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: 'Last time a notification was sent for this saved campaign'
  },
  saved_from: {
    type: DataTypes.STRING(100),
    allowNull: true,
    validate: {
      len: [0, 100]
    },
    comment: 'Source page/context where campaign was saved (e.g., "homepage", "search", "category")'
  },
  tags: {
    type: DataTypes.JSONB,
    defaultValue: [],
    comment: 'User-defined tags for organizing saved campaigns'
  },
  priority: {
    type: DataTypes.ENUM('low', 'medium', 'high'),
    allowNull: false,
    defaultValue: 'medium',
    comment: 'User-assigned priority level'
  },
  reminder_date: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: 'Optional reminder date set by user'
  },
  metadata: {
    type: DataTypes.JSONB,
    defaultValue: {},
    comment: 'Additional user-specific metadata'
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
  modelName: 'SavedCampaign',
  tableName: 'saved_campaigns',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  hooks: {
    beforeCreate: async (savedCampaign) => {
      // Check if user has already saved this campaign
      const existingSave = await SavedCampaign.findOne({
        where: {
          user_id: savedCampaign.user_id,
          campaign_id: savedCampaign.campaign_id
        }
      });
      
      if (existingSave) {
        throw new Error('Campaign is already saved by this user');
      }
    }
  },
  indexes: [
    {
      unique: true,
      fields: ['user_id', 'campaign_id'],
      name: 'saved_campaigns_user_campaign_unique'
    },
    {
      fields: ['user_id']
    },
    {
      fields: ['campaign_id']
    },
    {
      fields: ['priority']
    },
    {
      fields: ['is_notification_enabled']
    },
    {
      fields: ['reminder_date']
    },
    {
      fields: ['created_at']
    },
    {
      fields: ['last_notification_sent']
    },
    {
      fields: ['user_id', 'created_at']
    },
    {
      fields: ['user_id', 'priority']
    },
    // GIN indexes for JSONB columns
    {
      fields: ['tags'],
      using: 'gin'
    },
    {
      fields: ['notification_preferences'],
      using: 'gin'
    }
  ],
  scopes: {
    byUser: (userId) => ({
      where: {
        user_id: userId
      }
    }),
    withNotifications: {
      where: {
        is_notification_enabled: true
      }
    },
    byPriority: (priority) => ({
      where: {
        priority: priority
      }
    }),
    needingReminder: {
      where: {
        reminder_date: {
          [Op.lte]: new Date()
        }
      }
    },
    recent: {
      order: [['created_at', 'DESC']],
      limit: 10
    },
    activeCampaigns: {
      include: [{
        model: sequelize.models.Campaign,
        as: 'campaign',
        where: {
          status: 'active'
        }
      }]
    }
  }
});

module.exports = SavedCampaign;