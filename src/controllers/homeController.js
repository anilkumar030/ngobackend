const { Project, Campaign, Event } = require('../models');
const { catchAsync, AppError } = require('../middleware/errorHandler');
const { redisUtils, CACHE_KEYS } = require('../config/redis');
const logger = require('../utils/logger');
const { Op } = require('sequelize');

/**
 * Get home page data - latest projects, campaigns, and events
 * Returns 5 latest items from each category optimized for home page display
 */
const getHomeData = catchAsync(async (req, res) => {
  // Check cache first
  const cacheKey = CACHE_KEYS.HOME_DATA;
  const cachedResult = await redisUtils.get(cacheKey);
  
  if (cachedResult) {
    return res.status(200).json(cachedResult);
  }

  try {
    // Fetch data in parallel for better performance
    const [latestProjects, latestCampaigns, latestEvents] = await Promise.all([
      // Get 5 latest projects (public, active or completed)
      Project.findAll({
        where: {
          is_public: true,
          status: { [Op.in]: ['active', 'completed'] }
        },
        order: [['created_at', 'DESC']],
        limit: 5,
        attributes: [
          'id',
          'title',
          'slug',
          'description',
          'category',
          'status',
          'featured_image',
          'location',
          'start_date',
          'estimated_completion_date',
          'total_budget',
          'amount_spent',
          'beneficiaries_count',
          'progress_percentage',
          'is_featured',
          'created_at'
        ]
      }),

      // Get 5 latest campaigns (active and verified)
      Campaign.findAll({
        where: {
          status: 'active',
          verified: true,
          visibility: 'public'
        },
        order: [['created_at', 'DESC']],
        limit: 5,
        attributes: [
          'id',
          'title',
          'slug',
          'short_description',
          'location',
          'target_amount',
          'raised_amount',
          'donor_count',
          'status',
          'featured',
          'category',
          'start_date',
          'end_date',
          'images',
          'created_at'
        ]
      }),

      // Get 5 latest events (active or upcoming)
      Event.findAll({
        where: {
          status: 'active',
          [Op.or]: [
            // Upcoming events
            { start_date: { [Op.gt]: new Date() } },
            // Ongoing events
            {
              start_date: { [Op.lte]: new Date() },
              end_date: { [Op.gte]: new Date() }
            }
          ]
        },
        order: [['start_date', 'ASC']], // Show earliest upcoming events first
        limit: 5,
        attributes: [
          'id',
          'title',
          'slug',
          'description',
          'start_date',
          'end_date',
          'location',
          'featured_image',
          'category',
          'max_participants',
          'registered_participants',
          'registration_fee',
          'registration_end_date',
          'is_featured',
          'organizer',
          'created_at'
        ]
      })
    ]);

    // Process the data using the model's getPublicData method
    const processedProjects = latestProjects.map(project => {
      const publicData = project.getPublicData();
      // Return only essential fields for home page
      return {
        id: publicData.id,
        title: publicData.title,
        slug: publicData.slug,
        description: publicData.description,
        category: publicData.category,
        status: publicData.status,
        featured_image: publicData.featured_image,
        location: publicData.location,
        budget: publicData.budget,
        spent: publicData.spent,
        budget_utilization: publicData.budget_utilization,
        beneficiaries: publicData.beneficiaries,
        progress_percentage: publicData.progress_percentage,
        is_featured: publicData.is_featured,
        created_at: publicData.created_at
      };
    });

    const processedCampaigns = latestCampaigns.map(campaign => {
      const publicData = campaign.getPublicData();
      // Return only essential fields for home page
      return {
        id: publicData.id,
        title: publicData.title,
        slug: publicData.slug,
        description: publicData.short_description,
        location: publicData.location,
        target_amount: publicData.target_amount,
        raised_amount: publicData.raised_amount,
        donor_count: publicData.donor_count,
        progress_percentage: publicData.progress_percentage,
        remaining_amount: publicData.remaining_amount,
        status: publicData.status,
        featured: publicData.featured,
        category: publicData.category,
        images: publicData.images?.[0] ? [publicData.images[0]] : [], // Only first image
        created_at: publicData.created_at
      };
    });

    const processedEvents = latestEvents.map(event => {
      const publicData = event.getPublicData();
      // Return only essential fields for home page
      return {
        id: publicData.id,
        title: publicData.title,
        slug: publicData.slug,
        description: publicData.description,
        start_date: publicData.start_date,
        end_date: publicData.end_date,
        location: publicData.location,
        featured_image: publicData.featured_image,
        category: publicData.category,
        max_participants: publicData.max_participants,
        registered_participants: publicData.registered_participants,
        registration_progress: publicData.registration_progress,
        remaining_slots: publicData.remaining_slots,
        registration_fee: publicData.registration_fee,
        registration_end_date: publicData.registration_end_date,
        status: publicData.status,
        is_featured: publicData.is_featured,
        organizer: publicData.organizer,
        created_at: publicData.created_at
      };
    });

    const responseData = {
      success: true,
      message: 'Home page data retrieved successfully',
      data: {
        projects: processedProjects,
        campaigns: processedCampaigns,
        events: processedEvents,
        meta: {
          projects_count: processedProjects.length,
          campaigns_count: processedCampaigns.length,
          events_count: processedEvents.length,
          last_updated: new Date().toISOString()
        }
      }
    };

    // Cache the result for 5 minutes
    await redisUtils.set(cacheKey, responseData, 300);

    logger.info('Home page data retrieved successfully', {
      projects_count: processedProjects.length,
      campaigns_count: processedCampaigns.length,
      events_count: processedEvents.length
    });

    res.status(200).json(responseData);

  } catch (error) {
    logger.error('Error fetching home page data:', {
      error: error.message,
      stack: error.stack
    });

    throw new AppError('Failed to fetch home page data', 500);
  }
});

module.exports = {
  getHomeData
};