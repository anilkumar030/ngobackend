const { Project, ProjectUpdate, User, sequelize } = require('../models');
const { catchAsync, AppError } = require('../middleware/errorHandler');
const { redisUtils, CACHE_KEYS } = require('../config/redis');
const logger = require('../utils/logger');
const { Op } = require('sequelize');

/**
 * Get all projects with filters and pagination
 */
const getProjects = catchAsync(async (req, res) => {
  const {
    page = 1,
    limit = 10,
    status,
    category,
    search,
    sort_by = 'created_at',
    sort_order = 'desc',
    is_featured
  } = req.query;

  // Check cache for public project listings
  const isPublicListing = !req.user;
  const cacheKey = isPublicListing ? CACHE_KEYS.PROJECTS_LIST(page, limit, req.query) : null;
  
  if (cacheKey) {
    const cachedResult = await redisUtils.get(cacheKey);
    if (cachedResult) {
      return res.status(200).json(cachedResult);
    }
  }

  const offset = (page - 1) * limit;

  // Build where conditions
  const whereConditions = { is_public: true };

  // Filter by status if provided
  if (status) {
    whereConditions.status = status;
  } else if (!req.user || req.user.role === 'user') {
    // Only show active and completed projects for public users
    whereConditions.status = { [Op.in]: ['active', 'completed'] };
  }

  if (category) {
    whereConditions.category = category;
  }

  if (is_featured !== undefined) {
    whereConditions.is_featured = is_featured === 'true';
  }

  if (search) {
    whereConditions[Op.or] = [
      { title: { [Op.iLike]: `%${search}%` } },
      { description: { [Op.iLike]: `%${search}%` } },
      { long_description: { [Op.iLike]: `%${search}%` } },
      { location: { [Op.iLike]: `%${search}%` } }
    ];
  }

  // Build sorting options with additional fields
  const validSortFields = {
    'title': 'title',
    'created_at': 'created_at',
    'start_date': 'start_date',
    'estimated_completion': 'estimated_completion_date',
    'progress_percentage': 'progress_percentage',
    'total_budget': 'total_budget',
    'amount_spent': 'amount_spent',
    'beneficiaries': 'beneficiaries_count'
  };

  const sortField = validSortFields[sort_by] || 'created_at';

  // Get projects with pagination
  const { count, rows: projects } = await Project.findAndCountAll({
    where: whereConditions,
    include: [
      {
        model: User,
        as: 'creator',
        attributes: ['id', 'first_name', 'last_name', 'email'],
      },
      {
        model: User,
        as: 'manager',
        attributes: ['id', 'first_name', 'last_name', 'email'],
        required: false,
      },
      {
        model: ProjectUpdate,
        as: 'updates',
        where: { status: 'published' },
        attributes: ['id', 'title', 'published_at'],
        required: false,
        limit: 3,
        order: [['published_at', 'DESC']]
      }
    ],
    order: [[sortField, sort_order.toUpperCase()]],
    limit: parseInt(limit),
    offset: offset,
  });

  // Process projects with computed fields and enhanced response format
  const projectsWithEnhancedData = projects.map(project => {
    return project.getPublicData();
  });

  const totalPages = Math.ceil(count / limit);

  const response = {
    success: true,
    data: {
      projects: projectsWithEnhancedData,
      pagination: {
        current_page: parseInt(page),
        per_page: parseInt(limit),
        total: count,
        total_pages: totalPages,
        has_next: page < totalPages,
        has_prev: page > 1,
      },
    },
  };

  // Cache public project listings for 10 minutes
  if (cacheKey) {
    await redisUtils.set(cacheKey, response, 600);
  }

  res.status(200).json(response);
});

/**
 * Get single project by ID or slug
 */
const getProject = catchAsync(async (req, res) => {
  const { identifier } = req.params;
  
  // Check if identifier is UUID, numeric ID, or slug
  const { isValidUUID } = require('../utils/helpers');
  let whereCondition;
  
  if (isValidUUID(identifier)) {
    whereCondition = { id: identifier };
  } else if (/^\d+$/.test(identifier)) {
    whereCondition = { id: identifier };
  } else {
    whereCondition = { slug: identifier };
  }

  // Check cache first
  const cacheKey = `project:${identifier}`;
  const cachedProject = await redisUtils.get(cacheKey);
  
  if (cachedProject) {
    return res.status(200).json({
      success: true,
      data: cachedProject,
    });
  }

  const project = await Project.findOne({
    where: whereCondition,
    include: [
      {
        model: User,
        as: 'creator',
        attributes: ['id', 'first_name', 'last_name', 'email', 'profile_image'],
      },
      {
        model: User,
        as: 'manager',
        attributes: ['id', 'first_name', 'last_name', 'email', 'profile_image'],
        required: false,
      },
      {
        model: ProjectUpdate,
        as: 'updates',
        where: { status: 'published' },
        attributes: ['id', 'title', 'custom_excerpt', 'content', 'published_at', 'featured_image', 'update_type'],
        required: false,
        limit: 5, // Latest 5 updates
        order: [['published_at', 'DESC']]
      }
    ],
  });

  if (!project) {
    throw new AppError('Project not found', 404, true, 'PROJECT_NOT_FOUND');
  }

  // Check if user can view this project
  if (!project.is_public && 
      (!req.user || 
       (req.user.id !== project.created_by && 
        req.user.id !== project.managed_by &&
        !['admin', 'super_admin'].includes(req.user.role)))) {
    throw new AppError('Project not found', 404, true, 'PROJECT_NOT_FOUND');
  }

  // Create enhanced project data with required API format
  const projectData = project.getPublicData();
  
  // Add updates information
  projectData.recent_updates = project.updates || [];
  projectData.total_updates_count = await ProjectUpdate.count({
    where: {
      project_id: project.id,
      status: 'published'
    }
  });

  // Add computed fields for admin/manager view
  if (req.user && (
    req.user.id === project.created_by || 
    req.user.id === project.managed_by ||
    ['admin', 'super_admin'].includes(req.user.role)
  )) {
    projectData.manager = project.manager;
    projectData.created_by_details = project.creator;
  }

  const response = {
    success: true,
    data: {
      project: projectData
    }
  };

  // Cache the project data for 15 minutes
  await redisUtils.set(cacheKey, projectData, 900);

  res.status(200).json(response);
});

/**
 * Get project updates
 */
const getProjectUpdates = catchAsync(async (req, res) => {
  const { id } = req.params;
  const {
    page = 1,
    limit = 10,
    update_type,
    sort_by = 'published_at',
    sort_order = 'desc'
  } = req.query;

  // Verify project exists and is accessible
  const project = await Project.findByPk(id);
  
  if (!project) {
    throw new AppError('Project not found', 404, true, 'PROJECT_NOT_FOUND');
  }

  if (!project.is_public && 
      (!req.user || 
       (req.user.id !== project.created_by && 
        req.user.id !== project.managed_by &&
        !['admin', 'super_admin'].includes(req.user.role)))) {
    throw new AppError('Project not found', 404, true, 'PROJECT_NOT_FOUND');
  }

  const offset = (page - 1) * limit;

  // Build where conditions
  const whereConditions = {
    project_id: id,
    status: 'published',
    published_at: { [Op.lte]: new Date() }
  };

  if (update_type) {
    whereConditions.update_type = update_type;
  }

  // Validate sort field
  const validSortFields = ['published_at', 'created_at', 'title', 'update_type'];
  const sortField = validSortFields.includes(sort_by) ? sort_by : 'published_at';

  // Get updates with pagination
  const { count, rows: updates } = await ProjectUpdate.findAndCountAll({
    where: whereConditions,
    include: [
      {
        model: User,
        as: 'author',
        attributes: ['id', 'first_name', 'last_name', 'profile_image'],
        required: false,
      }
    ],
    order: [[sortField, sort_order.toUpperCase()]],
    limit: parseInt(limit),
    offset: offset,
  });

  // Process updates for API response format
  const processedUpdates = updates.map(update => {
    const updateData = {
      id: update.id,
      title: update.title,
      content: update.content,
      images: update.images || [],
      created_at: update.published_at || update.created_at
    };
    
    if (update.author) {
      updateData.author = {
        id: update.author.id,
        name: `${update.author.first_name} ${update.author.last_name}`,
        profile_image: update.author.profile_image
      };
    }
    
    return updateData;
  });

  const totalPages = Math.ceil(count / limit);

  res.status(200).json({
    success: true,
    data: {
      updates: processedUpdates,
      pagination: {
        current_page: parseInt(page),
        per_page: parseInt(limit),
        total: count,
        total_pages: totalPages,
        has_next: page < totalPages,
        has_prev: page > 1,
      },
    },
  });
});

/**
 * Get comprehensive project statistics
 */
const getProjectStatistics = catchAsync(async (req, res) => {
  const { period = 30 } = req.query; // Default to last 30 days
  
  // Check cache first
  const cacheKey = `${CACHE_KEYS.PROJECT_STATISTICS || 'project_statistics'}_${period}`;
  const cachedStats = await redisUtils.get(cacheKey);
  
  if (cachedStats) {
    return res.status(200).json(cachedStats);
  }

  try {
    // Calculate date ranges
    const now = new Date();
    const periodStartDate = new Date();
    periodStartDate.setDate(now.getDate() - parseInt(period));

    // Generate last 30 days for timeline
    const last30Days = [];
    for (let i = 29; i >= 0; i--) {
      const date = new Date();
      date.setDate(now.getDate() - i);
      last30Days.push(date.toISOString().split('T')[0]);
    }

    // Execute parallel queries for comprehensive statistics
    const [
      overviewStats,
      avgCompletionTime,
      categoriesCount,
      periodStats,
      categoryBreakdown,
      timelineData,
      budgetUtilizationData
    ] = await Promise.all([
      // Overview statistics
      Project.findOne({
        attributes: [
          [sequelize.fn('COUNT', sequelize.col('*')), 'total_projects'],
          [sequelize.fn('COUNT', sequelize.literal('CASE WHEN status = \'active\' THEN 1 END')), 'active_projects'],
          [sequelize.fn('COUNT', sequelize.literal('CASE WHEN status = \'completed\' THEN 1 END')), 'completed_projects'],
          [sequelize.fn('COUNT', sequelize.literal('CASE WHEN status = \'on-hold\' THEN 1 END')), 'on_hold_projects'],
          [sequelize.fn('SUM', sequelize.col('total_budget')), 'total_budget'],
          [sequelize.fn('SUM', sequelize.col('amount_spent')), 'spent_budget']
        ],
        where: {
          is_public: true
        },
        raw: true
      }).catch(() => ({
        total_projects: 0,
        active_projects: 0,
        completed_projects: 0,
        on_hold_projects: 0,
        total_budget: 0,
        spent_budget: 0
      })),

      // Average completion time for completed projects
      sequelize.query(`
        SELECT AVG(EXTRACT(DAY FROM (actual_completion_date - created_at))) as avg_completion_days
        FROM projects 
        WHERE status = 'completed' 
          AND actual_completion_date IS NOT NULL 
          AND is_public = true
      `, { type: sequelize.QueryTypes.SELECT }).then(result => 
        result[0]?.avg_completion_days ? Math.round(parseFloat(result[0].avg_completion_days)) : 0
      ).catch(() => 0),

      // Categories count
      Project.findOne({
        attributes: [
          [sequelize.fn('COUNT', sequelize.fn('DISTINCT', sequelize.col('category'))), 'categories_count']
        ],
        where: {
          is_public: true
        },
        raw: true
      }).then(result => parseInt(result?.categories_count || 0)).catch(() => 0),

      // Period statistics (last 30 days by default)
      Project.findOne({
        attributes: [
          [sequelize.fn('COUNT', sequelize.literal(`CASE WHEN created_at >= '${periodStartDate.toISOString()}' THEN 1 END`)), 'new_projects'],
          [sequelize.fn('COUNT', sequelize.literal(`CASE WHEN actual_completion_date >= '${periodStartDate.toISOString()}' AND status = 'completed' THEN 1 END`)), 'completed_projects'],
          [sequelize.fn('SUM', sequelize.literal(`CASE WHEN created_at >= '${periodStartDate.toISOString()}' THEN total_budget ELSE 0 END`)), 'budget_allocated'],
          [sequelize.fn('SUM', sequelize.literal(`CASE WHEN updated_at >= '${periodStartDate.toISOString()}' THEN amount_spent ELSE 0 END`)), 'budget_spent']
        ],
        where: {
          is_public: true
        },
        raw: true
      }).catch(() => ({
        new_projects: 0,
        completed_projects: 0,
        budget_allocated: 0,
        budget_spent: 0
      })),

      // Category breakdown
      Project.findAll({
        attributes: [
          'category',
          [sequelize.fn('COUNT', sequelize.col('*')), 'count'],
          [sequelize.fn('SUM', sequelize.col('total_budget')), 'budget'],
          [sequelize.fn('SUM', sequelize.col('amount_spent')), 'spent']
        ],
        where: {
          is_public: true
        },
        group: ['category'],
        order: [[sequelize.fn('COUNT', sequelize.col('*')), 'DESC']],
        raw: true
      }).catch(() => []),

      // Timeline progress data (daily for last 30 days)
      sequelize.query(`
        WITH date_series AS (
          SELECT generate_series(
            CURRENT_DATE - INTERVAL '29 days',
            CURRENT_DATE,
            INTERVAL '1 day'
          )::date as date
        ),
        daily_started AS (
          SELECT 
            DATE(created_at) as date,
            COUNT(*) as projects_started
          FROM projects 
          WHERE is_public = true 
            AND created_at >= CURRENT_DATE - INTERVAL '29 days'
          GROUP BY DATE(created_at)
        ),
        daily_completed AS (
          SELECT 
            DATE(actual_completion_date) as date,
            COUNT(*) as projects_completed
          FROM projects 
          WHERE is_public = true 
            AND actual_completion_date >= CURRENT_DATE - INTERVAL '29 days'
            AND status = 'completed'
          GROUP BY DATE(actual_completion_date)
        ),
        daily_spent AS (
          SELECT 
            DATE(updated_at) as date,
            SUM(amount_spent) as budget_spent
          FROM projects 
          WHERE is_public = true 
            AND updated_at >= CURRENT_DATE - INTERVAL '29 days'
          GROUP BY DATE(updated_at)
        )
        SELECT 
          ds.date,
          COALESCE(dst.projects_started, 0) as projects_started,
          COALESCE(dc.projects_completed, 0) as projects_completed,
          COALESCE(dsp.budget_spent, 0) as budget_spent
        FROM date_series ds
        LEFT JOIN daily_started dst ON ds.date = dst.date
        LEFT JOIN daily_completed dc ON ds.date = dc.date
        LEFT JOIN daily_spent dsp ON ds.date = dsp.date
        ORDER BY ds.date
      `, { type: sequelize.QueryTypes.SELECT }).catch(() => 
        last30Days.map(date => ({
          date,
          projects_started: 0,
          projects_completed: 0,
          budget_spent: 0
        }))
      ),

      // Budget utilization (top 10 projects by budget)
      Project.findAll({
        attributes: [
          'id',
          'title',
          'total_budget',
          'amount_spent',
          [sequelize.literal('CASE WHEN total_budget > 0 THEN ROUND((amount_spent / total_budget * 100)::numeric, 2) ELSE 0 END'), 'utilization_percentage']
        ],
        where: {
          is_public: true,
          total_budget: { [Op.gt]: 0 }
        },
        order: [['total_budget', 'DESC']],
        limit: 10,
        raw: true
      }).catch(() => [])
    ]);

    // Process and format the statistics data
    const statisticsData = {
      overview: {
        total_projects: parseInt(overviewStats?.total_projects || 0),
        active_projects: parseInt(overviewStats?.active_projects || 0),
        completed_projects: parseInt(overviewStats?.completed_projects || 0),
        on_hold_projects: parseInt(overviewStats?.on_hold_projects || 0),
        total_budget: parseFloat(overviewStats?.total_budget || 0),
        spent_budget: parseFloat(overviewStats?.spent_budget || 0),
        avg_completion_time: avgCompletionTime,
        categories_count: categoriesCount
      },
      period_stats: {
        new_projects: parseInt(periodStats?.new_projects || 0),
        completed_projects: parseInt(periodStats?.completed_projects || 0),
        budget_allocated: parseFloat(periodStats?.budget_allocated || 0),
        budget_spent: parseFloat(periodStats?.budget_spent || 0)
      },
      category_breakdown: categoryBreakdown.map(cat => ({
        category: cat.category,
        count: parseInt(cat.count),
        budget: parseFloat(cat.budget || 0),
        spent: parseFloat(cat.spent || 0)
      })),
      timeline_progress: timelineData.map(item => ({
        date: typeof item.date === 'string' ? item.date : item.date.toISOString().split('T')[0],
        projects_started: parseInt(item.projects_started || 0),
        projects_completed: parseInt(item.projects_completed || 0),
        budget_spent: parseFloat(item.budget_spent || 0)
      })),
      budget_utilization: budgetUtilizationData.map(project => ({
        project_id: project.id,
        project_title: project.title,
        budget: parseFloat(project.total_budget || 0),
        spent: parseFloat(project.amount_spent || 0),
        utilization_percentage: parseFloat(project.utilization_percentage || 0)
      }))
    };

    const response = {
      success: true,
      data: statisticsData
    };

    // Cache for 10 minutes (600 seconds)
    await redisUtils.set(cacheKey, response, 600);

    res.status(200).json(response);
    
  } catch (error) {
    logger.error('Error fetching comprehensive project statistics:', error);
    
    // Return fallback data with complete structure
    const fallbackResponse = {
      success: true,
      data: {
        overview: {
          total_projects: 0,
          active_projects: 0,
          completed_projects: 0,
          on_hold_projects: 0,
          total_budget: 0,
          spent_budget: 0,
          avg_completion_time: 0,
          categories_count: 0
        },
        period_stats: {
          new_projects: 0,
          completed_projects: 0,
          budget_allocated: 0,
          budget_spent: 0
        },
        category_breakdown: [],
        timeline_progress: [],
        budget_utilization: []
      }
    };
    
    res.status(200).json(fallbackResponse);
  }
});

/**
 * Get active projects only
 */
const getActiveProjects = catchAsync(async (req, res) => {
  const {
    page = 1,
    limit = 10,
    category,
    search,
    sort_by = 'created_at',
    sort_order = 'desc',
    is_featured
  } = req.query;

  // Check cache for active projects
  const isPublicListing = !req.user;
  const cacheKey = isPublicListing ? `${CACHE_KEYS.PROJECTS_LIST || 'projects_list'}_active_${page}_${limit}_${JSON.stringify(req.query)}` : null;
  
  if (cacheKey) {
    const cachedResult = await redisUtils.get(cacheKey);
    if (cachedResult) {
      return res.status(200).json(cachedResult);
    }
  }

  const offset = (page - 1) * limit;

  // Build where conditions for active projects only
  const whereConditions = { 
    is_public: true,
    status: 'active'  // Only active projects
  };

  if (category) {
    whereConditions.category = category;
  }

  if (is_featured !== undefined) {
    whereConditions.is_featured = is_featured === 'true';
  }

  if (search) {
    whereConditions[Op.or] = [
      { title: { [Op.iLike]: `%${search}%` } },
      { description: { [Op.iLike]: `%${search}%` } },
      { long_description: { [Op.iLike]: `%${search}%` } },
      { location: { [Op.iLike]: `%${search}%` } }
    ];
  }

  // Build sorting options
  const validSortFields = {
    'title': 'title',
    'created_at': 'created_at',
    'start_date': 'start_date',
    'estimated_completion': 'estimated_completion_date',
    'progress_percentage': 'progress_percentage',
    'total_budget': 'total_budget',
    'amount_spent': 'amount_spent',
    'beneficiaries': 'beneficiaries_count'
  };

  const sortField = validSortFields[sort_by] || 'created_at';

  // Get active projects with pagination
  const { count, rows: projects } = await Project.findAndCountAll({
    where: whereConditions,
    include: [
      {
        model: User,
        as: 'creator',
        attributes: ['id', 'first_name', 'last_name', 'email'],
      },
      {
        model: User,
        as: 'manager',
        attributes: ['id', 'first_name', 'last_name', 'email'],
        required: false,
      },
      {
        model: ProjectUpdate,
        as: 'updates',
        where: { status: 'published' },
        attributes: ['id', 'title', 'custom_excerpt', 'published_at'],
        required: false,
        limit: 2, // Latest 2 updates for active projects
        order: [['published_at', 'DESC']]
      }
    ],
    order: [[sortField, sort_order.toUpperCase()]],
    limit: parseInt(limit),
    offset: offset,
  });

  // Process projects with computed fields
  const projectsWithEnhancedData = projects.map(project => {
    return project.getPublicData();
  });

  const totalPages = Math.ceil(count / limit);

  const response = {
    success: true,
    data: {
      projects: projectsWithEnhancedData,
      pagination: {
        current_page: parseInt(page),
        per_page: parseInt(limit),
        total: count,
        total_pages: totalPages,
        has_next: page < totalPages,
        has_prev: page > 1,
      },
    },
  };

  // Cache active project listings for 5 minutes
  if (cacheKey) {
    await redisUtils.set(cacheKey, response, 300);
  }

  res.status(200).json(response);
});

/**
 * Get all project categories
 */
const getProjectCategories = catchAsync(async (_req, res) => {
  // Check cache first
  const cacheKey = CACHE_KEYS.PROJECT_CATEGORIES;
  const cachedCategories = await redisUtils.get(cacheKey);
  
  if (cachedCategories) {
    return res.status(200).json({
      success: true,
      data: cachedCategories,
    });
  }

  // Get distinct categories from database
  const categories = await Project.findAll({
    attributes: [
      [sequelize.fn('DISTINCT', sequelize.col('category')), 'category']
    ],
    where: {
      is_public: true,
      status: { [Op.in]: ['active', 'completed'] }
    },
    order: [['category', 'ASC']],
    raw: true
  });

  // Process categories to add count and metadata
  const categoriesWithCount = await Promise.all(
    categories.map(async (cat) => {
      const count = await Project.count({
        where: {
          category: cat.category,
          is_public: true,
          status: { [Op.in]: ['active', 'completed'] }
        }
      });

      return {
        name: cat.category,
        count: count,
        slug: cat.category.toLowerCase().replace(/\s+/g, '-')
      };
    })
  );

  // Cache the results for 30 minutes
  await redisUtils.setex(cacheKey, 1800, {
    categories: categoriesWithCount,
    total_categories: categoriesWithCount.length
  });

  res.status(200).json({
    success: true,
    data: {
      categories: categoriesWithCount,
      total_categories: categoriesWithCount.length
    }
  });
});

/**
 * Create new project (Admin only)
 */
const createProject = catchAsync(async (req, res) => {
  const {
    title,
    description,
    long_description,
    category,
    status = 'active',
    priority = 'medium',
    location,
    geographic_scope = 'local',
    start_date,
    estimated_completion_date,
    total_budget,
    funding_sources,
    beneficiaries_count,
    progress_percentage = 0,
    implementation_strategy,
    impact_metrics,
    stakeholders,
    risks_and_mitigation,
    sustainability_plan,
    is_featured = false,
    is_public = true,
    tags,
    managed_by
  } = req.body;

  // Handle file uploads if present
  let featured_image = null;
  let images = [];
  
  if (req.files) {
    if (req.files.featured_image) {
      featured_image = req.files.featured_image[0].location || req.files.featured_image[0].path;
    }
    if (req.files.images) {
      images = req.files.images.map(file => file.location || file.path);
    }
  }

  // Create project with transaction for data consistency
  const project = await sequelize.transaction(async (transaction) => {
    const newProject = await Project.create({
      title,
      description,
      long_description,
      category,
      status,
      priority,
      location,
      geographic_scope,
      start_date,
      estimated_completion_date,
      total_budget,
      amount_spent: 0,
      funding_sources: funding_sources || [],
      beneficiaries_count,
      progress_percentage,
      implementation_strategy: implementation_strategy || { phases: [] },
      impact_metrics: impact_metrics || {},
      stakeholders: stakeholders || [],
      risks_and_mitigation: risks_and_mitigation || [],
      sustainability_plan,
      featured_image,
      images,
      is_featured,
      is_public,
      tags: tags || [],
      created_by: req.user.id,
      managed_by: managed_by || req.user.id,
    }, { transaction });

    return newProject;
  });

  // Clear related caches
  await Promise.all([
    redisUtils.del(`${CACHE_KEYS.PROJECTS_LIST || 'projects_list'}*`),
    redisUtils.del(CACHE_KEYS.PROJECT_CATEGORIES),
    redisUtils.del(`${CACHE_KEYS.PROJECT_STATISTICS || 'project_statistics'}*`)
  ]);

  logger.contextLogger.audit('Project created', 'info', {
    projectId: project.id,
    projectTitle: project.title,
    createdBy: req.user.id,
  });

  res.status(201).json({
    success: true,
    message: 'Project created successfully',
    data: {
      project: project.getPublicData()
    }
  });
});

/**
 * Update existing project (Admin only)
 */
const updateProject = catchAsync(async (req, res) => {
  const { id } = req.params;
  
  const project = await Project.findByPk(id);
  if (!project) {
    throw new AppError('Project not found', 404, true, 'PROJECT_NOT_FOUND');
  }

  // Check permissions
  if (!['admin', 'super_admin'].includes(req.user.role) && 
      req.user.id !== project.created_by && 
      req.user.id !== project.managed_by) {
    throw new AppError('You do not have permission to update this project', 403, true, 'INSUFFICIENT_PERMISSIONS');
  }

  // Handle file uploads
  let updateData = { ...req.body };
  
  if (req.files) {
    if (req.files.featured_image) {
      updateData.featured_image = req.files.featured_image[0].location || req.files.featured_image[0].path;
    }
    if (req.files.images) {
      const newImages = req.files.images.map(file => file.location || file.path);
      updateData.images = [...(project.images || []), ...newImages];
    }
  }

  // Update project with transaction
  await sequelize.transaction(async (transaction) => {
    await project.update(updateData, { transaction });
  });

  // Clear related caches
  await Promise.all([
    redisUtils.del(`project:${id}`),
    redisUtils.del(`project:${project.slug}`),
    redisUtils.del(`${CACHE_KEYS.PROJECTS_LIST || 'projects_list'}*`),
    redisUtils.del(`${CACHE_KEYS.PROJECT_STATISTICS || 'project_statistics'}*`)
  ]);

  logger.contextLogger.audit('Project updated', 'info', {
    projectId: project.id,
    projectTitle: project.title,
    updatedBy: req.user.id,
    changes: Object.keys(updateData)
  });

  res.status(200).json({
    success: true,
    message: 'Project updated successfully',
    data: {
      project: project.getPublicData()
    }
  });
});

/**
 * Delete project (Admin only)
 */
const deleteProject = catchAsync(async (req, res) => {
  const { id } = req.params;
  const { permanent = false } = req.query;
  
  const project = await Project.findByPk(id);
  if (!project) {
    throw new AppError('Project not found', 404, true, 'PROJECT_NOT_FOUND');
  }

  // Check permissions
  if (!['admin', 'super_admin'].includes(req.user.role)) {
    throw new AppError('Only administrators can delete projects', 403, true, 'INSUFFICIENT_PERMISSIONS');
  }

  // Only super admins can permanently delete
  if (permanent && req.user.role !== 'super_admin') {
    throw new AppError('Only super administrators can permanently delete projects', 403, true, 'INSUFFICIENT_PERMISSIONS');
  }

  if (permanent) {
    // Hard delete - remove from database completely
    await sequelize.transaction(async (transaction) => {
      // First delete related project updates
      await ProjectUpdate.destroy({
        where: { project_id: id },
        transaction
      });
      
      // Then delete the project
      await project.destroy({ transaction });
    });
    
    logger.contextLogger.audit('Project permanently deleted', 'warn', {
      projectId: project.id,
      projectTitle: project.title,
      deletedBy: req.user.id,
    });
  } else {
    // Soft delete - set status to cancelled and is_public to false
    await project.update({
      status: 'cancelled',
      is_public: false
    });
    
    logger.contextLogger.audit('Project archived', 'info', {
      projectId: project.id,
      projectTitle: project.title,
      archivedBy: req.user.id,
    });
  }

  // Clear related caches
  await Promise.all([
    redisUtils.del(`project:${id}`),
    redisUtils.del(`project:${project.slug}`),
    redisUtils.del(`${CACHE_KEYS.PROJECTS_LIST || 'projects_list'}*`),
    redisUtils.del(`${CACHE_KEYS.PROJECT_STATISTICS || 'project_statistics'}*`)
  ]);

  res.status(200).json({
    success: true,
    message: permanent ? 'Project permanently deleted' : 'Project archived successfully'
  });
});

/**
 * Update project status (Admin only)
 */
const updateProjectStatus = catchAsync(async (req, res) => {
  const { id } = req.params;
  const { status, actual_completion_date, completion_notes } = req.body;
  
  const project = await Project.findByPk(id);
  if (!project) {
    throw new AppError('Project not found', 404, true, 'PROJECT_NOT_FOUND');
  }

  // Check permissions
  if (!['admin', 'super_admin'].includes(req.user.role) && 
      req.user.id !== project.created_by && 
      req.user.id !== project.managed_by) {
    throw new AppError('You do not have permission to update this project status', 403, true, 'INSUFFICIENT_PERMISSIONS');
  }

  const updateData = { status };
  
  // Set completion date if status is completed and date provided
  if (status === 'completed' && actual_completion_date) {
    updateData.actual_completion_date = actual_completion_date;
  }
  
  // Auto-complete progress if status is completed
  if (status === 'completed' && project.progress_percentage < 100) {
    updateData.progress_percentage = 100;
  }

  await project.update(updateData);

  // Create project update entry for status change if completion_notes provided
  if (completion_notes && status === 'completed') {
    await ProjectUpdate.create({
      project_id: id,
      title: 'Project Completed',
      content: completion_notes,
      update_type: 'completion',
      status: 'published',
      published_at: new Date(),
      author_name: `${req.user.first_name} ${req.user.last_name}`,
      created_by: req.user.id
    });
  }

  // Clear related caches
  await Promise.all([
    redisUtils.del(`project:${id}`),
    redisUtils.del(`project:${project.slug}`),
    redisUtils.del(`${CACHE_KEYS.PROJECTS_LIST || 'projects_list'}*`)
  ]);

  logger.contextLogger.audit('Project status updated', 'info', {
    projectId: project.id,
    projectTitle: project.title,
    oldStatus: project.status,
    newStatus: status,
    updatedBy: req.user.id,
  });

  res.status(200).json({
    success: true,
    message: 'Project status updated successfully',
    data: {
      project: project.getPublicData()
    }
  });
});

/**
 * Update project progress (Admin only)
 */
const updateProjectProgress = catchAsync(async (req, res) => {
  const { id } = req.params;
  const { progress_percentage, progress_notes, milestone_reached } = req.body;
  
  const project = await Project.findByPk(id);
  if (!project) {
    throw new AppError('Project not found', 404, true, 'PROJECT_NOT_FOUND');
  }

  // Check permissions
  if (!['admin', 'super_admin'].includes(req.user.role) && 
      req.user.id !== project.created_by && 
      req.user.id !== project.managed_by) {
    throw new AppError('You do not have permission to update this project progress', 403, true, 'INSUFFICIENT_PERMISSIONS');
  }

  await project.updateProgress(progress_percentage);

  // Create project update entry for progress change if notes provided
  if (progress_notes) {
    await ProjectUpdate.create({
      project_id: id,
      title: milestone_reached || `Progress Updated to ${progress_percentage}%`,
      content: progress_notes,
      update_type: milestone_reached ? 'milestone' : 'progress',
      status: 'published',
      published_at: new Date(),
      milestone_reached,
      progress_update: {
        percentage: progress_percentage,
        notes: progress_notes,
        updated_at: new Date()
      },
      author_name: `${req.user.first_name} ${req.user.last_name}`,
      created_by: req.user.id
    });
  }

  // Clear related caches
  await Promise.all([
    redisUtils.del(`project:${id}`),
    redisUtils.del(`project:${project.slug}`),
    redisUtils.del(`${CACHE_KEYS.PROJECTS_LIST || 'projects_list'}*`)
  ]);

  logger.contextLogger.audit('Project progress updated', 'info', {
    projectId: project.id,
    projectTitle: project.title,
    oldProgress: project.progress_percentage,
    newProgress: progress_percentage,
    updatedBy: req.user.id,
  });

  res.status(200).json({
    success: true,
    message: 'Project progress updated successfully',
    data: {
      project: project.getPublicData()
    }
  });
});

module.exports = {
  getProjects,
  getProject,
  getActiveProjects,
  getProjectUpdates,
  getProjectCategories,
  getProjectStatistics,
  // Admin functions
  createProject,
  updateProject,
  deleteProject,
  updateProjectStatus,
  updateProjectProgress,
};