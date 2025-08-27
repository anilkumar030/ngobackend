const { DataTypes, Model, Op } = require('sequelize');
const { sequelize } = require('../config/database');
const { generateSlug } = require('../utils/helpers');

class Project extends Model {
  /**
   * Check if project is currently active
   */
  get isActive() {
    return this.status === 'active';
  }

  /**
   * Check if project is completed
   */
  get isCompleted() {
    return this.status === 'completed' || 
           (this.actual_completion_date && new Date() > this.actual_completion_date);
  }

  /**
   * Check if project is overdue
   */
  get isOverdue() {
    if (this.status === 'completed') return false;
    return this.estimated_completion_date && new Date() > this.estimated_completion_date;
  }

  /**
   * Calculate budget utilization percentage
   */
  get budgetUtilization() {
    if (!this.total_budget || this.total_budget === 0) return 0;
    return Math.min(Math.round((parseFloat(this.amount_spent) / parseFloat(this.total_budget)) * 100), 100);
  }

  /**
   * Get remaining budget
   */
  get remainingBudget() {
    return Math.max(parseFloat(this.total_budget) - parseFloat(this.amount_spent), 0);
  }

  /**
   * Calculate days remaining until estimated completion
   */
  get daysRemaining() {
    if (!this.estimated_completion_date || this.status === 'completed') return null;
    const now = new Date();
    const estimatedCompletion = new Date(this.estimated_completion_date);
    const diffTime = estimatedCompletion - now;
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  /**
   * Get actual project status based on conditions
   */
  get actualStatus() {
    if (this.status === 'completed') return 'completed';
    if (this.status === 'on-hold' || this.status === 'cancelled') return this.status;
    
    if (this.isOverdue) return 'overdue';
    if (this.status === 'active') return 'active';
    if (this.status === 'upcoming') return 'upcoming';
    
    return this.status;
  }

  /**
   * Calculate completed phases count
   */
  get completedPhases() {
    if (!this.implementation_strategy?.phases) return 0;
    return this.implementation_strategy.phases.filter(phase => phase.status === 'completed').length;
  }

  /**
   * Get total phases count
   */
  get totalPhases() {
    return this.implementation_strategy?.phases?.length || 0;
  }

  /**
   * Calculate phase completion percentage
   */
  get phaseCompletion() {
    if (this.totalPhases === 0) return 0;
    return Math.round((this.completedPhases / this.totalPhases) * 100);
  }

  /**
   * Calculate overall progress percentage based on phases and manual progress
   */
  get calculatedProgress() {
    // If manual progress is set and higher, use that
    const manualProgress = parseFloat(this.progress_percentage) || 0;
    const phaseProgress = this.phaseCompletion;
    
    // Use the higher of manual progress or phase-based progress
    return Math.max(manualProgress, phaseProgress);
  }

  /**
   * Generate SEO-friendly slug from title
   */
  async generateSlug() {
    let baseSlug = generateSlug(this.title);
    let slug = baseSlug;
    let counter = 1;
    
    // Ensure slug is unique
    while (await Project.findOne({ where: { slug, id: { [Op.ne]: this.id || null } } })) {
      slug = `${baseSlug}-${counter}`;
      counter++;
    }
    
    return slug;
  }

  /**
   * Update project progress
   */
  async updateProgress(progressPercentage) {
    this.progress_percentage = Math.min(Math.max(progressPercentage, 0), 100);
    
    // Auto-complete if 100% progress
    if (this.progress_percentage === 100 && this.status === 'active') {
      this.status = 'completed';
      this.actual_completion_date = new Date();
    }
    
    return await this.save();
  }

  /**
   * Update budget spent
   */
  async updateBudgetSpent(amount) {
    this.amount_spent = (parseFloat(this.amount_spent) || 0) + parseFloat(amount);
    return await this.save();
  }

  /**
   * Get public project data
   */
  getPublicData() {
    return {
      id: this.id,
      title: this.title,
      slug: this.slug,
      description: this.description,
      long_description: this.long_description,
      category: this.category,
      status: this.actualStatus,
      featured_image: this.featured_image,
      images: this.images,
      location: this.location,
      start_date: this.start_date,
      estimated_completion: this.estimated_completion_date,
      actual_completion: this.actual_completion_date,
      budget: parseFloat(this.total_budget) || 0,
      spent: parseFloat(this.amount_spent) || 0,
      budget_utilization: this.budgetUtilization,
      remaining_budget: this.remainingBudget,
      beneficiaries: this.beneficiaries_count || 0,
      progress_percentage: this.calculatedProgress,
      phase_completion: this.phaseCompletion,
      days_remaining: this.daysRemaining,
      implementation_strategy: this.implementation_strategy || { phases: [] },
      impact_metrics: this.impact_metrics || {},
      is_featured: this.is_featured,
      created_at: this.created_at,
      updated_at: this.updated_at
    };
  }
}

Project.init({
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
    comment: 'Detailed project description with rich content'
  },
  category: {
    type: DataTypes.ENUM(
      'Water Projects',
      'Housing',
      'Emergency Relief', 
      'Healthcare',
      'Education',
      'Environment',
      'Infrastructure',
      'Community Development',
      'Disaster Relief',
      'Other'
    ),
    allowNull: false,
    defaultValue: 'Other'
  },
  status: {
    type: DataTypes.ENUM('upcoming', 'active', 'completed', 'on-hold', 'cancelled'),
    allowNull: false,
    defaultValue: 'active'
  },
  priority: {
    type: DataTypes.ENUM('low', 'medium', 'high', 'critical'),
    allowNull: false,
    defaultValue: 'medium'
  },
  location: {
    type: DataTypes.STRING(500),
    allowNull: false,
    validate: {
      len: [1, 500],
      notEmpty: true
    }
  },
  geographic_scope: {
    type: DataTypes.ENUM('local', 'district', 'state', 'national', 'international'),
    allowNull: false,
    defaultValue: 'local'
  },
  start_date: {
    type: DataTypes.DATE,
    allowNull: false,
    validate: {
      isDate: true
    }
  },
  estimated_completion_date: {
    type: DataTypes.DATE,
    allowNull: true,
    validate: {
      isDate: true,
      isAfterStartDate(value) {
        if (value && this.start_date && value <= this.start_date) {
          throw new Error('Estimated completion date must be after start date');
        }
      }
    }
  },
  actual_completion_date: {
    type: DataTypes.DATE,
    allowNull: true,
    validate: {
      isDate: true
    }
  },
  total_budget: {
    type: DataTypes.DECIMAL(15, 2),
    allowNull: false,
    validate: {
      min: 0,
      max: 1000000000 // 100 crores maximum
    }
  },
  amount_spent: {
    type: DataTypes.DECIMAL(15, 2),
    defaultValue: 0.00,
    validate: {
      min: 0
    }
  },
  funding_sources: {
    type: DataTypes.JSONB,
    defaultValue: [],
    comment: 'Array of funding source details'
  },
  beneficiaries_count: {
    type: DataTypes.INTEGER,
    allowNull: true,
    validate: {
      min: 0
    },
    comment: 'Number of people/entities benefiting from this project'
  },
  progress_percentage: {
    type: DataTypes.DECIMAL(5, 2),
    defaultValue: 0.00,
    validate: {
      min: 0,
      max: 100
    }
  },
  implementation_strategy: {
    type: DataTypes.JSONB,
    defaultValue: {
      phases: [],
      methodology: '',
      timeline: {},
      resources: []
    },
    comment: 'Project implementation details including phases, methodology, timeline'
  },
  impact_metrics: {
    type: DataTypes.JSONB,
    defaultValue: {},
    comment: 'Measurable impact metrics and KPIs'
  },
  stakeholders: {
    type: DataTypes.JSONB,
    defaultValue: [],
    comment: 'Project stakeholders and their roles'
  },
  risks_and_mitigation: {
    type: DataTypes.JSONB,
    defaultValue: [],
    comment: 'Identified risks and mitigation strategies'
  },
  sustainability_plan: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'Long-term sustainability and maintenance plan'
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
    comment: 'Array of image URLs for project gallery'
  },
  documents: {
    type: DataTypes.JSONB,
    defaultValue: [],
    comment: 'Array of project documents and reports'
  },
  is_featured: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    comment: 'Featured projects for homepage display'
  },
  is_public: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    comment: 'Whether project information is publicly visible'
  },
  tags: {
    type: DataTypes.JSONB,
    defaultValue: [],
    comment: 'Tags for categorization and search'
  },
  metadata: {
    type: DataTypes.JSONB,
    defaultValue: {},
    comment: 'Additional project metadata'
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
  managed_by: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: 'users',
      key: 'id'
    },
    onUpdate: 'CASCADE',
    onDelete: 'SET NULL',
    comment: 'Current project manager'
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
  modelName: 'Project',
  tableName: 'projects',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  hooks: {
    beforeCreate: async (project) => {
      if (!project.slug) {
        project.slug = await project.generateSlug();
      }
    },
    beforeUpdate: async (project) => {
      if (project.changed('title') && !project.changed('slug')) {
        project.slug = await project.generateSlug();
      }
      
      // Auto-complete if progress reaches 100%
      if (project.changed('progress_percentage') && 
          project.progress_percentage === 100 && 
          project.status === 'active') {
        project.status = 'completed';
        project.actual_completion_date = new Date();
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
      fields: ['priority']
    },
    {
      fields: ['geographic_scope']
    },
    {
      fields: ['is_featured']
    },
    {
      fields: ['is_public']
    },
    {
      fields: ['created_by']
    },
    {
      fields: ['managed_by']
    },
    {
      fields: ['start_date']
    },
    {
      fields: ['estimated_completion_date']
    },
    {
      fields: ['actual_completion_date']
    },
    {
      fields: ['location']
    },
    {
      fields: ['created_at']
    },
    {
      fields: ['progress_percentage']
    },
    {
      fields: ['total_budget']
    },
    {
      fields: ['status', 'is_featured']
    },
    {
      fields: ['category', 'status']
    },
    {
      fields: ['status', 'priority']
    },
    // GIN indexes for JSONB columns
    {
      fields: ['tags'],
      using: 'gin'
    },
    {
      fields: ['implementation_strategy'],
      using: 'gin'
    },
    {
      fields: ['impact_metrics'],
      using: 'gin'
    }
  ],
  scopes: {
    active: {
      where: {
        status: 'active',
        is_public: true
      }
    },
    completed: {
      where: {
        status: 'completed',
        is_public: true
      }
    },
    featured: {
      where: {
        is_featured: true,
        is_public: true,
        status: ['active', 'completed']
      }
    },
    byCategory: (category) => ({
      where: {
        category: category,
        is_public: true,
        status: ['active', 'completed']
      }
    }),
    byPriority: (priority) => ({
      where: {
        priority: priority,
        status: ['active', 'upcoming'],
        is_public: true
      }
    }),
    overdue: {
      where: {
        status: ['active'],
        estimated_completion_date: {
          [Op.lt]: new Date()
        }
      }
    },
    recent: {
      where: {
        is_public: true,
        status: ['active', 'completed']
      },
      order: [['created_at', 'DESC']],
      limit: 10
    },
    public: {
      where: {
        is_public: true,
        status: ['active', 'completed', 'upcoming']
      }
    }
  }
});

module.exports = Project;