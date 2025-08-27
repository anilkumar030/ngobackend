const { DataTypes, Model, Op } = require('sequelize');
const { sequelize } = require('../config/database');
const { generateSlug } = require('../utils/helpers');

class Event extends Model {
  /**
   * Check if event is currently active for registration
   */
  get isActive() {
    if (this.status !== 'active') return false;
    
    const now = new Date();
    if (this.registration_end_date && now > this.registration_end_date) return false;
    if (this.start_date && now > this.end_date) return false;
    
    return true;
  }

  /**
   * Check if event is upcoming
   */
  get isUpcoming() {
    const now = new Date();
    return this.start_date && now < this.start_date;
  }

  /**
   * Check if event is ongoing
   */
  get isOngoing() {
    const now = new Date();
    return this.start_date && this.end_date && 
           now >= this.start_date && now <= this.end_date;
  }

  /**
   * Check if event is completed
   */
  get isCompleted() {
    const now = new Date();
    return this.end_date && now > this.end_date;
  }

  /**
   * Get event status based on dates
   */
  get actualStatus() {
    if (this.status === 'draft' || this.status === 'cancelled') {
      return this.status;
    }
    
    if (this.isCompleted) return 'completed';
    if (this.isOngoing) return 'ongoing';
    if (this.isUpcoming) return 'upcoming';
    
    return this.status;
  }

  /**
   * Check if event has available slots
   */
  get hasAvailableSlots() {
    if (!this.max_participants) return true;
    return this.registered_participants < this.max_participants;
  }

  /**
   * Calculate registration progress percentage
   */
  get registrationProgress() {
    if (!this.max_participants) return 0;
    return Math.min(Math.round((this.registered_participants / this.max_participants) * 100), 100);
  }

  /**
   * Get remaining slots
   */
  get remainingSlots() {
    if (!this.max_participants) return null;
    return Math.max(this.max_participants - this.registered_participants, 0);
  }

  /**
   * Generate SEO-friendly slug from title
   */
  async generateSlug() {
    let baseSlug = generateSlug(this.title);
    let slug = baseSlug;
    let counter = 1;
    
    // Ensure slug is unique
    while (await Event.findOne({ where: { slug, id: { [Op.ne]: this.id || null } } })) {
      slug = `${baseSlug}-${counter}`;
      counter++;
    }
    
    return slug;
  }

  /**
   * Update registered participants count
   */
  async updateRegistrationCount(increment = 1) {
    this.registered_participants = Math.max((this.registered_participants || 0) + increment, 0);
    return await this.save();
  }

  /**
   * Get public event data
   */
  getPublicData() {
    return {
      id: this.id,
      title: this.title,
      slug: this.slug,
      description: this.description,
      long_description: this.long_description,
      start_date: this.start_date,
      end_date: this.end_date,
      location: this.location,
      featured_image: this.featured_image,
      images: this.images,
      category: this.category,
      max_participants: this.max_participants,
      registered_participants: this.registered_participants,
      registration_progress: this.registrationProgress,
      remaining_slots: this.remainingSlots,
      status: this.actualStatus,
      is_featured: this.is_featured,
      organizer: this.organizer,
      registration_start_date: this.registration_start_date,
      registration_end_date: this.registration_end_date,
      registration_fee: this.registration_fee,
      created_at: this.created_at,
      updated_at: this.updated_at
    };
  }
}

Event.init({
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  title: {
    type: DataTypes.STRING(500),
    allowNull: false,
    validate: {
      len: [3, 500],
      notEmpty: true
    }
  },
  slug: {
    type: DataTypes.STRING(255),
    allowNull: false,
    unique: true,
    validate: {
      len: [3, 255],
      is: /^[a-z0-9-]+$/ // Only lowercase letters, numbers, and hyphens
    }
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true,
    validate: {
      len: [0, 1000]
    }
  },
  long_description: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'Detailed event description with rich content'
  },
  category: {
    type: DataTypes.ENUM('healthcare', 'education', 'workshop', 'awareness', 'fundraising', 'volunteer', 'other'),
    allowNull: false,
    defaultValue: 'other'
  },
  status: {
    type: DataTypes.ENUM('draft', 'active', 'cancelled', 'completed'),
    allowNull: false,
    defaultValue: 'active'
  },
  start_date: {
    type: DataTypes.DATE,
    allowNull: false,
    validate: {
      isDate: true,
      isAfter: {
        args: new Date().toISOString(),
        msg: 'Start date must be in the future'
      }
    }
  },
  end_date: {
    type: DataTypes.DATE,
    allowNull: false,
    validate: {
      isDate: true,
      isAfterStartDate(value) {
        if (value && this.start_date && value <= this.start_date) {
          throw new Error('End date must be after start date');
        }
      }
    }
  },
  location: {
    type: DataTypes.STRING(500),
    allowNull: false,
    validate: {
      len: [1, 500],
      notEmpty: true
    }
  },
  venue_details: {
    type: DataTypes.JSONB,
    defaultValue: {},
    comment: 'Detailed venue information including address, landmarks, contact'
  },
  max_participants: {
    type: DataTypes.INTEGER,
    allowNull: true,
    validate: {
      min: 1,
      max: 10000
    },
    comment: 'Maximum number of participants allowed, null for unlimited'
  },
  registered_participants: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    validate: {
      min: 0
    }
  },
  registration_fee: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0.00,
    validate: {
      min: 0
    },
    comment: 'Registration fee in INR, 0 for free events'
  },
  registration_start_date: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: 'When registration opens, null for immediate'
  },
  registration_end_date: {
    type: DataTypes.DATE,
    allowNull: true,
    validate: {
      isBeforeEventStart(value) {
        if (value && this.start_date && value > this.start_date) {
          throw new Error('Registration end date must be before event start date');
        }
      }
    },
    comment: 'Registration deadline, null for until event starts'
  },
  featured_image: {
    type: DataTypes.STRING(500),
    allowNull: true,
    validate: {
      isUrl: true
    }
  },
  images: {
    type: DataTypes.JSONB,
    defaultValue: [],
    comment: 'Array of image URLs for event gallery'
  },
  is_featured: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    comment: 'Featured events for homepage display'
  },
  organizer: {
    type: DataTypes.JSONB,
    defaultValue: {},
    comment: 'Organizer details: name, contact, email'
  },
  requirements: {
    type: DataTypes.JSONB,
    defaultValue: [],
    comment: 'Array of requirements or items participants should bring'
  },
  agenda: {
    type: DataTypes.JSONB,
    defaultValue: [],
    comment: 'Event schedule and agenda items'
  },
  speakers: {
    type: DataTypes.JSONB,
    defaultValue: [],
    comment: 'Array of speaker/facilitator information'
  },
  certificates: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    comment: 'Whether certificates will be provided'
  },
  tags: {
    type: DataTypes.JSONB,
    defaultValue: [],
    comment: 'Tags for categorization and search'
  },
  metadata: {
    type: DataTypes.JSONB,
    defaultValue: {},
    comment: 'Additional event metadata'
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
  modelName: 'Event',
  tableName: 'events',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  hooks: {
    beforeCreate: async (event) => {
      if (!event.slug) {
        event.slug = await event.generateSlug();
      }
    },
    beforeUpdate: async (event) => {
      if (event.changed('title') && !event.changed('slug')) {
        event.slug = await event.generateSlug();
      }
    }
  },
  indexes: [
    {
      unique: true,
      fields: ['slug']
    },
    {
      fields: ['status']
    },
    {
      fields: ['category']
    },
    {
      fields: ['is_featured']
    },
    {
      fields: ['created_by']
    },
    {
      fields: ['start_date']
    },
    {
      fields: ['end_date']
    },
    {
      fields: ['registration_start_date']
    },
    {
      fields: ['registration_end_date']
    },
    {
      fields: ['location']
    },
    {
      fields: ['created_at']
    },
    {
      fields: ['status', 'is_featured']
    },
    {
      fields: ['category', 'status']
    },
    {
      fields: ['start_date', 'status']
    },
    // GIN indexes for JSONB columns
    {
      fields: ['tags'],
      using: 'gin'
    },
    {
      fields: ['venue_details'],
      using: 'gin'
    }
  ],
  scopes: {
    active: {
      where: {
        status: 'active'
      }
    },
    upcoming: {
      where: {
        status: 'active',
        start_date: {
          [Op.gt]: new Date()
        }
      }
    },
    ongoing: {
      where: {
        status: 'active',
        start_date: {
          [Op.lte]: new Date()
        },
        end_date: {
          [Op.gte]: new Date()
        }
      }
    },
    completed: {
      where: {
        end_date: {
          [Op.lt]: new Date()
        }
      }
    },
    featured: {
      where: {
        is_featured: true,
        status: 'active'
      }
    },
    byCategory: (category) => ({
      where: {
        category: category,
        status: 'active'
      }
    }),
    registrationOpen: {
      where: {
        status: 'active',
        [Op.or]: [
          { registration_start_date: null },
          { registration_start_date: { [Op.lte]: new Date() } }
        ],
        [Op.or]: [
          { registration_end_date: null },
          { registration_end_date: { [Op.gte]: new Date() } }
        ]
      }
    },
    public: {
      where: {
        status: ['active', 'completed']
      }
    }
  }
});

module.exports = Event;