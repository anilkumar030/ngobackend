const { DataTypes, Model } = require('sequelize');
const { sequelize } = require('../config/database');

/**
 * CampaignUpdate Model
 * 
 * Represents updates posted to campaigns to keep donors informed about
 * campaign progress, milestones, and developments.
 */
class CampaignUpdate extends Model {
  /**
   * Get public campaign update data
   */
  getPublicData() {
    return {
      id: this.id,
      campaignId: this.campaign_id,
      title: this.title,
      description: this.description,
      images: this.images,
      created_at: this.created_at,
      updated_at: this.updated_at
    };
  }

  /**
   * Check if update has images
   */
  get hasImages() {
    return this.images && Array.isArray(this.images) && this.images.length > 0;
  }

  /**
   * Get image count
   */
  get imageCount() {
    return this.images && Array.isArray(this.images) ? this.images.length : 0;
  }

  /**
   * Get first image for preview
   */
  get previewImage() {
    if (this.hasImages) {
      return this.images[0];
    }
    return null;
  }
}

CampaignUpdate.init({
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
    onDelete: 'CASCADE',
    comment: 'Reference to the campaign this update belongs to'
  },
  title: {
    type: DataTypes.STRING(500),
    allowNull: false,
    validate: {
      len: [3, 500],
      notEmpty: true
    },
    comment: 'Title of the campaign update'
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: false,
    validate: {
      notEmpty: true,
      len: [10, 50000] // Allow for detailed updates
    },
    comment: 'Detailed description of the campaign update'
  },
  images: {
    type: DataTypes.JSONB,
    defaultValue: [],
    validate: {
      isValidImageArray(value) {
        if (value !== null && value !== undefined) {
          if (!Array.isArray(value)) {
            throw new Error('Images must be an array');
          }
          // Validate each image URL
          value.forEach(imageUrl => {
            if (typeof imageUrl !== 'string' || imageUrl.trim().length === 0) {
              throw new Error('Each image must be a valid URL string');
            }
          });
        }
      }
    },
    comment: 'Array of image URLs associated with this update'
  },
  created_at: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
    allowNull: false
  },
  updated_at: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
    allowNull: false
  }
}, {
  sequelize,
  modelName: 'CampaignUpdate',
  tableName: 'campaignupdates',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [
    {
      fields: ['campaign_id'],
      name: 'campaignupdates_campaign_id_idx'
    },
    {
      fields: ['created_at'],
      name: 'campaignupdates_created_at_idx'
    },
    {
      fields: ['campaign_id', 'created_at'],
      name: 'campaignupdates_campaign_created_idx'
    },
    {
      fields: ['images'],
      using: 'gin',
      name: 'campaignupdates_images_gin_idx'
    }
  ],
  scopes: {
    /**
     * Get updates ordered by most recent first
     */
    recent: {
      order: [['created_at', 'DESC']]
    },
    
    /**
     * Get updates for a specific campaign
     */
    byCampaign: (campaignId) => ({
      where: {
        campaign_id: campaignId
      },
      order: [['created_at', 'DESC']]
    }),
    
    /**
     * Get updates with images only
     */
    withImages: {
      where: sequelize.literal("jsonb_array_length(images) > 0"),
      order: [['created_at', 'DESC']]
    },
    
    /**
     * Get recent updates with limit
     */
    recentWithLimit: (limit = 10) => ({
      order: [['created_at', 'DESC']],
      limit: limit
    })
  }
});

module.exports = CampaignUpdate;