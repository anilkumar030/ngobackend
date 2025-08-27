const { ContentSection, Gallery, User } = require('../models');
const { catchAsync, AppError } = require('../middleware/errorHandler');
const { redisUtils, CACHE_KEYS } = require('../config/redis');
const fileUploadService = require('../services/fileUploadService');
const logger = require('../utils/logger');
const { Op } = require('sequelize');
const { sequelize } = require('../config/database');

/**
 * Get content section by type
 */
const getContentSection = catchAsync(async (req, res) => {
  const { type } = req.params;

  // Valid content section types
  const validTypes = ['hero', 'sacred-impact', 'main-content', 'footer', 'header'];
  
  if (!validTypes.includes(type)) {
    throw new AppError('Invalid content section type', 400, true, 'INVALID_CONTENT_TYPE');
  }

  // Check cache first
  const cacheKey = CACHE_KEYS.CONTENT_SECTION(type);
  const cachedContent = await redisUtils.get(cacheKey);
  
  if (cachedContent) {
    return res.status(200).json({
      success: true,
      data: {
        content: cachedContent,
      },
    });
  }

  // Get from database
  const content = await ContentSection.findOne({
    where: { 
      section_type: type,
      is_active: true,
    },
    include: [
      {
        model: User,
        as: 'creator',
        attributes: ['id', 'first_name', 'last_name'],
      },
      {
        model: User,
        as: 'updater',
        attributes: ['id', 'first_name', 'last_name'],
      },
    ],
    order: [['updated_at', 'DESC']],
  });

  if (!content) {
    // Return default content structure based on type
    const defaultContent = getDefaultContent(type);
    
    return res.status(200).json({
      success: true,
      data: {
        content: defaultContent,
      },
    });
  }

  // Cache for 1 hour
  await redisUtils.set(cacheKey, content, 3600);

  res.status(200).json({
    success: true,
    data: {
      content,
    },
  });
});

/**
 * Update content section
 */
const updateContentSection = catchAsync(async (req, res) => {
  const { type } = req.params;
  const { content_data, title, description, is_active = true } = req.body;

  // Valid content section types
  const validTypes = ['hero', 'sacred-impact', 'main-content', 'footer', 'header'];
  
  if (!validTypes.includes(type)) {
    throw new AppError('Invalid content section type', 400, true, 'INVALID_CONTENT_TYPE');
  }

  if (!content_data) {
    throw new AppError('Content data is required', 400, true, 'MISSING_CONTENT_DATA');
  }

  // Find existing content section or create new one
  let contentSection = await ContentSection.findOne({
    where: { section_type: type },
  });

  const updateData = {
    section_type: type,
    title: title || `${type.charAt(0).toUpperCase() + type.slice(1)} Section`,
    description,
    content_data,
    is_active,
    updated_by: req.user.id,
  };

  if (contentSection) {
    await contentSection.update(updateData);
  } else {
    updateData.created_by = req.user.id;
    contentSection = await ContentSection.create(updateData);
  }

  // Clear cache
  await redisUtils.del(CACHE_KEYS.CONTENT_SECTION(type));

  logger.contextLogger.database('Content section updated', 'ContentSection', {
    sectionType: type,
    updatedBy: req.user.id,
  });

  res.status(200).json({
    success: true,
    message: 'Content section updated successfully',
    data: {
      content: contentSection,
    },
  });
});

/**
 * Get all content sections (admin)
 */
const getAllContentSections = catchAsync(async (req, res) => {
  const contentSections = await ContentSection.findAll({
    include: [
      {
        model: User,
        as: 'creator',
        attributes: ['id', 'first_name', 'last_name'],
      },
      {
        model: User,
        as: 'updater',
        attributes: ['id', 'first_name', 'last_name'],
      },
    ],
    order: [['section_type', 'ASC'], ['updated_at', 'DESC']],
  });

  res.status(200).json({
    success: true,
    data: {
      content_sections: contentSections,
    },
  });
});

/**
 * Get gallery images
 */
const getGalleryImages = catchAsync(async (req, res) => {
  const { 
    category, 
    page = 1, 
    limit = 20, 
    sort_by = 'created_at', 
    sort_order = 'desc' 
  } = req.query;

  // Check cache first for public gallery requests
  const cacheKey = CACHE_KEYS.GALLERY_IMAGES(category);
  const cachedImages = await redisUtils.get(cacheKey);
  
  if (cachedImages && !req.user) {
    return res.status(200).json(cachedImages);
  }

  const offset = (page - 1) * limit;

  // Build where conditions
  const whereConditions = {
    is_active: true,
  };

  if (category && category !== 'all') {
    whereConditions.category = category;
  }

  // Get images with pagination
  const { count, rows: images } = await Gallery.findAndCountAll({
    where: whereConditions,
    include: [
      {
        model: User,
        as: 'uploader',
        attributes: ['id', 'first_name', 'last_name'],
      },
    ],
    order: [[sort_by, sort_order.toUpperCase()]],
    limit: parseInt(limit),
    offset: offset,
  });

  const totalPages = Math.ceil(count / limit);

  const response = {
    success: true,
    data: {
      images,
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

  // Cache public gallery for 30 minutes
  if (!req.user) {
    await redisUtils.set(cacheKey, response, 1800);
  }

  res.status(200).json(response);
});

/**
 * Upload gallery image
 */
const uploadGalleryImage = catchAsync(async (req, res) => {
  const file = req.file;
  const { category = 'general', title, description, alt_text } = req.body;

  if (!file) {
    throw new AppError('Image file is required', 400, true, 'NO_IMAGE_FILE');
  }

  // Upload image
  const uploadResult = await fileUploadService.uploadGalleryImage(file, category);

  // Save to database
  const galleryImage = await Gallery.create({
    title: title || file.originalname,
    description,
    alt_text: alt_text || title || file.originalname,
    image_url: uploadResult.url,
    image_public_id: uploadResult.publicId,
    category,
    file_size: file.size,
    width: uploadResult.width,
    height: uploadResult.height,
    uploaded_by: req.user.id,
    is_active: true,
  });

  // Clear gallery cache
  await redisUtils.del(CACHE_KEYS.GALLERY_IMAGES(category));
  await redisUtils.del(CACHE_KEYS.GALLERY_IMAGES('all'));

  logger.contextLogger.upload('Gallery image uploaded', file.originalname, file.size, {
    galleryId: galleryImage.id,
    category,
    uploadedBy: req.user.id,
  });

  res.status(201).json({
    success: true,
    message: 'Gallery image uploaded successfully',
    data: {
      image: galleryImage,
    },
  });
});

/**
 * Update gallery image
 */
const updateGalleryImage = catchAsync(async (req, res) => {
  const { id } = req.params;
  const { title, description, alt_text, category, is_active } = req.body;

  const galleryImage = await Gallery.findByPk(id);
  
  if (!galleryImage) {
    throw new AppError('Gallery image not found', 404, true, 'IMAGE_NOT_FOUND');
  }

  // Check permissions
  if (galleryImage.uploaded_by !== req.user.id && 
      !['admin', 'super_admin'].includes(req.user.role)) {
    throw new AppError('Not authorized to update this image', 403, true, 'NOT_AUTHORIZED');
  }

  const oldCategory = galleryImage.category;

  await galleryImage.update({
    title: title || galleryImage.title,
    description: description !== undefined ? description : galleryImage.description,
    alt_text: alt_text || galleryImage.alt_text,
    category: category || galleryImage.category,
    is_active: is_active !== undefined ? is_active : galleryImage.is_active,
  });

  // Clear relevant caches
  await redisUtils.del(CACHE_KEYS.GALLERY_IMAGES(oldCategory));
  if (category && category !== oldCategory) {
    await redisUtils.del(CACHE_KEYS.GALLERY_IMAGES(category));
  }
  await redisUtils.del(CACHE_KEYS.GALLERY_IMAGES('all'));

  res.status(200).json({
    success: true,
    message: 'Gallery image updated successfully',
    data: {
      image: galleryImage,
    },
  });
});

/**
 * Delete gallery image
 */
const deleteGalleryImage = catchAsync(async (req, res) => {
  const { id } = req.params;

  const galleryImage = await Gallery.findByPk(id);
  
  if (!galleryImage) {
    throw new AppError('Gallery image not found', 404, true, 'IMAGE_NOT_FOUND');
  }

  // Check permissions
  if (galleryImage.uploaded_by !== req.user.id && 
      !['admin', 'super_admin'].includes(req.user.role)) {
    throw new AppError('Not authorized to delete this image', 403, true, 'NOT_AUTHORIZED');
  }

  // Delete from Cloudinary
  if (galleryImage.image_public_id) {
    try {
      await fileUploadService.deleteImage(galleryImage.image_public_id);
    } catch (error) {
      logger.logError(error, { 
        context: 'delete_gallery_image_cloudinary',
        publicId: galleryImage.image_public_id,
      });
    }
  }

  await galleryImage.destroy();

  // Clear cache
  await redisUtils.del(CACHE_KEYS.GALLERY_IMAGES(galleryImage.category));
  await redisUtils.del(CACHE_KEYS.GALLERY_IMAGES('all'));

  logger.contextLogger.database('Gallery image deleted', 'Gallery', {
    imageId: id,
    deletedBy: req.user.id,
  });

  res.status(200).json({
    success: true,
    message: 'Gallery image deleted successfully',
  });
});

/**
 * Get default content structure based on type
 */
function getDefaultContent(type) {
  const projectName = process.env.PROJECT_NAME || 'BDRF';
  const defaults = {
    hero: {
      section_type: 'hero',
      title: 'Hero Section',
      content_data: {
        headline: `Welcome to ${projectName}`,
        subheading: 'Making a difference in the world',
        background_image: null,
        call_to_action: {
          text: 'Donate Now',
          url: '/campaigns',
        },
      },
      is_active: true,
    },
    'sacred-impact': {
      section_type: 'sacred-impact',
      title: 'Sacred Impact Section',
      content_data: {
        metrics: [
          { label: 'Lives Touched', value: '0', icon: 'heart' },
          { label: 'Donations Received', value: '0', icon: 'gift' },
          { label: 'Active Campaigns', value: '0', icon: 'campaign' },
          { label: 'Years of Service', value: '1', icon: 'calendar' },
        ],
      },
      is_active: true,
    },
    'main-content': {
      section_type: 'main-content',
      title: 'Main Content Section',
      content_data: {
        sections: [
          {
            type: 'campaigns',
            title: 'Active Campaigns',
            subtitle: 'Support our ongoing initiatives',
          },
          {
            type: 'contribute-cards',
            title: 'Ways to Contribute',
            cards: [
              { title: 'Donate', description: 'Make a monetary contribution', icon: 'donate' },
              { title: 'Volunteer', description: 'Contribute your time and skills', icon: 'volunteer' },
              { title: 'Spread Awareness', description: 'Share our mission', icon: 'share' },
            ],
          },
          {
            type: 'newsletter',
            title: 'Stay Updated',
            subtitle: 'Subscribe to our newsletter for updates',
          },
        ],
      },
      is_active: true,
    },
    header: {
      section_type: 'header',
      title: 'Header Navigation',
      content_data: {
        logo: {
          text: `${projectName}`,
          image: null,
        },
        navigation: [
          { label: 'Home', url: '/', active: true },
          { label: 'Campaigns', url: '/campaigns' },
          { label: 'Store', url: '/store' },
          { label: 'Gallery', url: '/gallery' },
          { label: 'Blog', url: '/blog' },
          { label: 'About', url: '/about' },
          { label: 'Contact', url: '/contact' },
        ],
        cta_button: {
          text: 'Donate Now',
          url: '/campaigns',
        },
      },
      is_active: true,
    },
    footer: {
      section_type: 'footer',
      title: 'Footer Content',
      content_data: {
        about: {
          title: `${projectName}`,
          description: 'Dedicated to making a positive impact in the world through compassion and service.',
        },
        contact: {
          address: 'Foundation Address',
          phone: '+91 XXXXX XXXXX',
          email: `info@${projectName.toLowerCase()}.org`,
        },
        social_links: [
          { platform: 'facebook', url: '#', icon: 'facebook' },
          { platform: 'twitter', url: '#', icon: 'twitter' },
          { platform: 'instagram', url: '#', icon: 'instagram' },
          { platform: 'youtube', url: '#', icon: 'youtube' },
        ],
        quick_links: [
          { label: 'Privacy Policy', url: '/privacy' },
          { label: 'Terms of Service', url: '/terms' },
          { label: 'Refund Policy', url: '/refund' },
          { label: 'Contact Us', url: '/contact' },
        ],
        copyright: `© ${new Date().getFullYear()} ${projectName}. All rights reserved.`,
      },
      is_active: true,
    },
  };

  return defaults[type] || null;
}

/**
 * Get BDRF Info section
 */
const getBdrfInfoSection = catchAsync(async (req, res) => {
  // Check cache first
  const cacheKey = CACHE_KEYS.CONTENT_SECTION('bdrf-info');
  const cachedContent = await redisUtils.get(cacheKey);
  
  if (cachedContent) {
    return res.status(200).json({
      success: true,
      data: {
        section: cachedContent,
      },
    });
  }

  const projectName = process.env.PROJECT_NAME || 'BDRF';
  
  // Get from database
  const content = await ContentSection.findOne({
    where: { 
      key: 'bdrf-info',
      status: 'active',
      visibility: 'public'
    },
    order: [['updated_at', 'DESC']],
  });

  let sectionData;
  if (content) {
    const localizedContent = content.getLocalizedContent(req.query.language || 'en');
    sectionData = {
      title: localizedContent.title,
      description: localizedContent.content,
      button_text: localizedContent.button_text || content.button_text,
      button_url: content.button_url,
      image_url: content.images?.[0]?.url || '/images/bdrf-info-image.png',
      ...content.settings,
      pagination: {
        current_page: 0,
        total_pages: 5
      }
    };
  } else {
    // Return default BDRF info section
    sectionData = {
      title: 'We Unite Communities, Volunteers and Organizations for Rapid and Effective Disaster Response When It Matters Most.',
      description: `${projectName} is a dedicated organization committed to providing immediate and effective disaster response across India. We work tirelessly to unite communities, volunteers, and organizations to create a robust network of support during times of crisis. Our mission is to ensure that no community stands alone when facing natural disasters, emergencies, or humanitarian crises.`,
      button_text: 'Know more',
      button_url: '/about',
      image_url: '/images/bdrf-info-image.png',
      features: [
        'Rapid Response Network',
        'Community Mobilization',
        'Volunteer Coordination',
        'Emergency Relief Distribution',
        'Long-term Recovery Support'
      ],
      stats: {
        communities_served: '500+',
        active_volunteers: '10,000+',
        response_time: '24 hours',
        states_covered: '15+'
      },
      pagination: {
        current_page: 0,
        total_pages: 5
      }
    };
  }

  // Cache for 1 hour
  await redisUtils.set(cacheKey, sectionData, 3600);

  res.status(200).json({
    success: true,
    data: {
      section: sectionData,
    },
  });
});

/**
 * Get Call-to-Action section
 */
const getCallToActionSection = catchAsync(async (req, res) => {
  // Check cache first
  const cacheKey = CACHE_KEYS.CONTENT_SECTION('call-to-action');
  const cachedContent = await redisUtils.get(cacheKey);
  
  if (cachedContent) {
    return res.status(200).json({
      success: true,
      data: {
        cta: cachedContent,
      },
    });
  }

  const projectName = process.env.PROJECT_NAME || 'BDRF';
  
  // Get from database
  const content = await ContentSection.findOne({
    where: { 
      key: 'call-to-action',
      status: 'active',
      visibility: 'public'
    },
    order: [['updated_at', 'DESC']],
  });

  let ctaData;
  if (content) {
    const localizedContent = content.getLocalizedContent(req.query.language || 'en');
    ctaData = {
      title: localizedContent.title,
      description: localizedContent.content,
      primary_button: {
        text: content.button_text || 'Donate Now',
        link: content.button_url || '/campaigns',
        style: content.button_style || 'primary'
      },
      secondary_button: content.links?.[0] ? {
        text: content.links[0].text,
        link: content.links[0].url,
        style: 'secondary'
      } : {
        text: 'Volunteer',
        link: '/volunteer',
        style: 'secondary'
      },
      background_image: content.images?.[0]?.url || '/images/cta-bg.jpg',
      ...content.settings
    };
  } else {
    // Return default call-to-action section
    ctaData = {
      title: 'Ready to Make a Difference?',
      description: 'Join thousands of compassionate individuals who are already making a positive impact. Every contribution, no matter how small, helps us build a better world together.',
      primary_button: {
        text: 'Donate Now',
        link: '/campaigns',
        style: 'primary'
      },
      secondary_button: {
        text: 'Volunteer',
        link: '/volunteer',
        style: 'secondary'
      },
      background_image: '/images/cta-bg.jpg',
      background_overlay: {
        enabled: true,
        color: 'rgba(0, 0, 0, 0.6)'
      },
      testimonial: {
        text: `Being part of ${projectName} has been incredibly rewarding. Together, we're making a real difference in people's lives.`,
        author: 'Priya Sharma',
        role: 'Volunteer'
      },
      urgency_text: 'Emergency situations require immediate action',
      trust_indicators: [
        '80G Tax Exemption Available',
        'Transparent Fund Utilization',
        'Direct Impact Reporting',
        '24/7 Emergency Response'
      ]
    };
  }

  // Cache for 1 hour
  await redisUtils.set(cacheKey, ctaData, 3600);

  res.status(200).json({
    success: true,
    data: {
      cta: ctaData,
    },
  });
});

/**
 * Create a new content section
 */
const createContentSection = catchAsync(async (req, res) => {
  const { 
    key, 
    page, 
    section_type, 
    title, 
    subtitle,
    content,
    images = [],
    videos = [],
    links = [],
    button_text,
    button_url,
    button_style,
    settings = {},
    css_classes,
    inline_styles,
    sort_order = 0,
    status = 'active',
    visibility = 'public',
    device_visibility = { desktop: true, tablet: true, mobile: true },
    start_date,
    end_date,
    scheduled_at,
    localized_content = {},
    seo_title,
    seo_description,
    seo_keywords = [],
    metadata = {}
  } = req.body;

  // Check if content section with same key and page exists
  const existingSection = await ContentSection.findOne({
    where: { key, page }
  });

  if (existingSection) {
    throw new AppError('Content section with this key already exists for this page', 400, true, 'DUPLICATE_CONTENT_SECTION');
  }

  // Create the content section
  const contentSection = await ContentSection.create({
    key,
    page,
    section_type,
    title,
    subtitle,
    content,
    images,
    videos,
    links,
    button_text,
    button_url,
    button_style,
    settings,
    css_classes,
    inline_styles,
    sort_order,
    status,
    visibility,
    device_visibility,
    start_date,
    end_date,
    scheduled_at,
    localized_content,
    seo_title,
    seo_description,
    seo_keywords,
    metadata,
    created_by: req.user.id
  });

  // Clear relevant caches
  await redisUtils.del(CACHE_KEYS.CONTENT_SECTION(key));
  
  logger.contextLogger.database('Content section created', 'ContentSection', {
    key,
    page,
    sectionType: section_type,
    createdBy: req.user.id,
  });

  res.status(201).json({
    success: true,
    message: 'Content section created successfully',
    data: {
      content_section: contentSection.getPublicData()
    },
  });
});

/**
 * Get all content sections with filtering and pagination
 */
const getContentSections = catchAsync(async (req, res) => {
  const {
    page = 1,
    limit = 10,
    page_filter,
    section_type,
    status,
    visibility,
    sort_by = 'sort_order',
    sort_order = 'asc',
    search,
    created_by,
    updated_by,
    start_date_from,
    start_date_to,
    end_date_from,
    end_date_to,
    language = 'en',
    include_expired = false,
    include_scheduled = false
  } = req.query;

  const offset = (page - 1) * limit;

  // Build where conditions
  const whereConditions = {};

  if (page_filter) whereConditions.page = page_filter;
  if (section_type) whereConditions.section_type = section_type;
  if (status) whereConditions.status = status;
  if (visibility) whereConditions.visibility = visibility;
  if (created_by) whereConditions.created_by = created_by;
  if (updated_by) whereConditions.updated_by = updated_by;

  // Date filters
  if (start_date_from || start_date_to) {
    whereConditions.start_date = {};
    if (start_date_from) whereConditions.start_date[Op.gte] = new Date(start_date_from);
    if (start_date_to) whereConditions.start_date[Op.lte] = new Date(start_date_to);
  }

  if (end_date_from || end_date_to) {
    whereConditions.end_date = {};
    if (end_date_from) whereConditions.end_date[Op.gte] = new Date(end_date_from);
    if (end_date_to) whereConditions.end_date[Op.lte] = new Date(end_date_to);
  }

  // Handle expired content
  if (!include_expired) {
    whereConditions[Op.or] = [
      { end_date: null },
      { end_date: { [Op.gt]: new Date() } }
    ];
  }

  // Handle scheduled content
  if (!include_scheduled) {
    whereConditions[Op.and] = [
      {
        [Op.or]: [
          { start_date: null },
          { start_date: { [Op.lte]: new Date() } }
        ]
      },
      {
        [Op.or]: [
          { status: { [Op.ne]: 'scheduled' } },
          {
            [Op.and]: [
              { status: 'scheduled' },
              { scheduled_at: { [Op.lte]: new Date() } }
            ]
          }
        ]
      }
    ];
  }

  // Search functionality
  if (search) {
    whereConditions[Op.or] = [
      { title: { [Op.iLike]: `%${search}%` } },
      { subtitle: { [Op.iLike]: `%${search}%` } },
      { content: { [Op.iLike]: `%${search}%` } },
      { key: { [Op.iLike]: `%${search}%` } }
    ];
  }

  // Only show public content for non-authenticated users
  if (!req.user) {
    whereConditions.status = 'active';
    whereConditions.visibility = 'public';
  }

  // Get content sections with pagination
  const { count, rows: contentSections } = await ContentSection.findAndCountAll({
    where: whereConditions,
    include: [
      {
        model: User,
        as: 'creator',
        attributes: ['id', 'first_name', 'last_name'],
      },
      {
        model: User,
        as: 'updater',
        attributes: ['id', 'first_name', 'last_name'],
      },
    ],
    order: [[sort_by, sort_order.toUpperCase()]],
    limit: parseInt(limit),
    offset: offset,
  });

  const totalPages = Math.ceil(count / limit);

  // Transform content for response
  const transformedSections = contentSections.map(section => {
    if (req.user) {
      return section; // Return full data for authenticated users
    } else {
      return section.getPublicData(language); // Return public data only
    }
  });

  res.status(200).json({
    success: true,
    data: {
      content_sections: transformedSections,
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
 * Get a single content section by key/id
 */
const getContentSectionByKey = catchAsync(async (req, res) => {
  const { key: identifier } = req.params;
  const { page: pageFilter, language = 'en', include_analytics = false } = req.query;

  // Check cache first for public requests
  if (!req.user && !include_analytics) {
    const cacheKey = CACHE_KEYS.CONTENT_SECTION(`${identifier}-${pageFilter || 'any'}-${language}`);
    const cachedContent = await redisUtils.get(cacheKey);
    
    if (cachedContent) {
      return res.status(200).json({
        success: true,
        data: {
          content_section: cachedContent,
        },
      });
    }
  }

  // Build where conditions
  const whereConditions = {
    [Op.or]: [
      { id: identifier },
      { key: identifier },
      { slug: identifier }
    ]
  };

  // Add page filter if provided
  if (pageFilter) {
    whereConditions.page = pageFilter;
  }

  // Only show public active content for non-authenticated users
  if (!req.user) {
    whereConditions.status = 'active';
    whereConditions.visibility = 'public';
    
    // Check if content should be displayed
    const now = new Date();
    whereConditions[Op.or] = [
      { start_date: null },
      { start_date: { [Op.lte]: now } }
    ];
    whereConditions[Op.and] = [
      {
        [Op.or]: [
          { end_date: null },
          { end_date: { [Op.gt]: now } }
        ]
      }
    ];
  }

  const contentSection = await ContentSection.findOne({
    where: whereConditions,
    include: [
      {
        model: User,
        as: 'creator',
        attributes: ['id', 'first_name', 'last_name'],
      },
      {
        model: User,
        as: 'updater',
        attributes: ['id', 'first_name', 'last_name'],
      },
    ],
    order: [['updated_at', 'DESC']],
  });

  if (!contentSection) {
    throw new AppError('Content section not found', 404, true, 'CONTENT_SECTION_NOT_FOUND');
  }

  // Check if content should be displayed
  if (!req.user && !contentSection.shouldDisplay) {
    throw new AppError('Content section not found', 404, true, 'CONTENT_SECTION_NOT_FOUND');
  }

  let responseData;
  if (req.user) {
    responseData = contentSection;
    
    // Include analytics if requested and user is admin
    if (include_analytics && ['admin', 'super_admin'].includes(req.user.role)) {
      responseData = {
        ...contentSection.toJSON(),
        analytics: {
          views: contentSection.view_count,
          clicks: contentSection.click_count,
          conversions: contentSection.conversion_count,
          last_updated: contentSection.updated_at
        }
      };
    }
  } else {
    responseData = contentSection.getPublicData(language);
    
    // Increment view count for public requests
    try {
      await contentSection.increment('view_count');
    } catch (error) {
      logger.logError(error, { context: 'increment_view_count', contentSectionId: contentSection.id });
    }
  }

  // Cache public content for 1 hour
  if (!req.user && !include_analytics) {
    const cacheKey = CACHE_KEYS.CONTENT_SECTION(`${identifier}-${pageFilter || 'any'}-${language}`);
    await redisUtils.set(cacheKey, responseData, 3600);
  }

  res.status(200).json({
    success: true,
    data: {
      content_section: responseData,
    },
  });
});

/**
 * Update a content section
 */
const updateContentSectionById = catchAsync(async (req, res) => {
  const { id } = req.params;
  const updateData = req.body;

  const contentSection = await ContentSection.findByPk(id);

  if (!contentSection) {
    throw new AppError('Content section not found', 404, true, 'CONTENT_SECTION_NOT_FOUND');
  }

  // Check if user can update this content section
  if (contentSection.created_by !== req.user.id && 
      !['admin', 'super_admin'].includes(req.user.role)) {
    throw new AppError('Not authorized to update this content section', 403, true, 'NOT_AUTHORIZED');
  }

  // If key or page is being updated, check for duplicates
  if ((updateData.key && updateData.key !== contentSection.key) || 
      (updateData.page && updateData.page !== contentSection.page)) {
    const duplicateCheck = await ContentSection.findOne({
      where: {
        key: updateData.key || contentSection.key,
        page: updateData.page || contentSection.page,
        id: { [Op.ne]: id }
      }
    });

    if (duplicateCheck) {
      throw new AppError('Content section with this key already exists for this page', 400, true, 'DUPLICATE_CONTENT_SECTION');
    }
  }

  // Set the updated_by field
  updateData.updated_by = req.user.id;

  await contentSection.update(updateData);

  // Clear relevant caches
  await redisUtils.del(CACHE_KEYS.CONTENT_SECTION(contentSection.key));
  await redisUtils.del(CACHE_KEYS.CONTENT_SECTION(`${contentSection.key}-${contentSection.page}-en`));
  
  logger.contextLogger.database('Content section updated', 'ContentSection', {
    id,
    key: contentSection.key,
    updatedBy: req.user.id,
  });

  res.status(200).json({
    success: true,
    message: 'Content section updated successfully',
    data: {
      content_section: contentSection,
    },
  });
});

/**
 * Delete a content section
 */
const deleteContentSection = catchAsync(async (req, res) => {
  const { id } = req.params;

  const contentSection = await ContentSection.findByPk(id);

  if (!contentSection) {
    throw new AppError('Content section not found', 404, true, 'CONTENT_SECTION_NOT_FOUND');
  }

  // Check permissions
  if (contentSection.created_by !== req.user.id && 
      !['admin', 'super_admin'].includes(req.user.role)) {
    throw new AppError('Not authorized to delete this content section', 403, true, 'NOT_AUTHORIZED');
  }

  await contentSection.destroy();

  // Clear caches
  await redisUtils.del(CACHE_KEYS.CONTENT_SECTION(contentSection.key));
  await redisUtils.del(CACHE_KEYS.CONTENT_SECTION(`${contentSection.key}-${contentSection.page}-en`));

  logger.contextLogger.database('Content section deleted', 'ContentSection', {
    id,
    key: contentSection.key,
    deletedBy: req.user.id,
  });

  res.status(200).json({
    success: true,
    message: 'Content section deleted successfully',
  });
});

/**
 * Get all content sections for a specific page
 */
const getPageContent = catchAsync(async (req, res) => {
  const { page: pageParam } = req.params;
  const { 
    language = 'en', 
    status = 'active', 
    visibility = 'public',
    include_scheduled = false,
    include_expired = false
  } = req.query;

  // Check cache first for public requests
  if (!req.user && status === 'active' && visibility === 'public') {
    const cacheKey = CACHE_KEYS.CONTENT_SECTION(`page-${pageParam}-${language}`);
    const cachedContent = await redisUtils.get(cacheKey);
    
    if (cachedContent) {
      return res.status(200).json({
        success: true,
        data: {
          page: pageParam,
          sections: cachedContent,
        },
      });
    }
  }

  const whereConditions = {
    page: pageParam
  };

  // Only show public content for non-authenticated users
  if (!req.user) {
    whereConditions.status = 'active';
    whereConditions.visibility = 'public';
  } else {
    if (status) whereConditions.status = status;
    if (visibility) whereConditions.visibility = visibility;
  }

  // Handle expired content
  if (!include_expired) {
    whereConditions[Op.or] = [
      { end_date: null },
      { end_date: { [Op.gt]: new Date() } }
    ];
  }

  // Handle scheduled content
  if (!include_scheduled && !req.user) {
    whereConditions[Op.and] = [
      {
        [Op.or]: [
          { start_date: null },
          { start_date: { [Op.lte]: new Date() } }
        ]
      }
    ];
  }

  const contentSections = await ContentSection.findAll({
    where: whereConditions,
    include: req.user ? [
      {
        model: User,
        as: 'creator',
        attributes: ['id', 'first_name', 'last_name'],
      },
      {
        model: User,
        as: 'updater',
        attributes: ['id', 'first_name', 'last_name'],
      },
    ] : [],
    order: [['sort_order', 'ASC'], ['created_at', 'ASC']],
  });

  // Transform sections for response
  const transformedSections = contentSections
    .filter(section => req.user || section.shouldDisplay)
    .map(section => req.user ? section : section.getPublicData(language));

  // Cache public content for 30 minutes
  if (!req.user && status === 'active' && visibility === 'public') {
    const cacheKey = CACHE_KEYS.CONTENT_SECTION(`page-${pageParam}-${language}`);
    await redisUtils.set(cacheKey, transformedSections, 1800);
  }

  res.status(200).json({
    success: true,
    data: {
      page: pageParam,
      sections: transformedSections,
    },
  });
});

/**
 * Bulk update content sections
 */
const bulkUpdateContentSections = catchAsync(async (req, res) => {
  const { ids, updates } = req.body;

  // Verify user has permission for bulk operations
  if (!['admin', 'super_admin'].includes(req.user.role)) {
    throw new AppError('Not authorized to perform bulk operations', 403, true, 'NOT_AUTHORIZED');
  }

  const transaction = await sequelize.transaction();

  try {
    const result = await ContentSection.update(
      { ...updates, updated_by: req.user.id },
      {
        where: {
          id: { [Op.in]: ids }
        },
        transaction
      }
    );

    await transaction.commit();

    // Clear relevant caches
    for (const id of ids) {
      const section = await ContentSection.findByPk(id, { attributes: ['key', 'page'] });
      if (section) {
        await redisUtils.del(CACHE_KEYS.CONTENT_SECTION(section.key));
        await redisUtils.del(CACHE_KEYS.CONTENT_SECTION(`${section.key}-${section.page}-en`));
      }
    }

    logger.contextLogger.database('Bulk content sections update', 'ContentSection', {
      idsCount: ids.length,
      updates,
      updatedBy: req.user.id,
    });

    res.status(200).json({
      success: true,
      message: `${result[0]} content sections updated successfully`,
      data: {
        updated_count: result[0]
      }
    });

  } catch (error) {
    await transaction.rollback();
    throw error;
  }
});

/**
 * Reorder content sections
 */
const reorderContentSections = catchAsync(async (req, res) => {
  const { sections } = req.body;

  const transaction = await sequelize.transaction();

  try {
    for (const section of sections) {
      await ContentSection.update(
        { 
          sort_order: section.sort_order,
          updated_by: req.user.id 
        },
        { 
          where: { id: section.id },
          transaction 
        }
      );
    }

    await transaction.commit();

    // Clear all content caches as order has changed
    const keys = await redisUtils.keys('content:*');
    for (const key of keys) {
      await redisUtils.del(key);
    }

    logger.contextLogger.database('Content sections reordered', 'ContentSection', {
      sectionsCount: sections.length,
      reorderedBy: req.user.id,
    });

    res.status(200).json({
      success: true,
      message: 'Content sections reordered successfully',
    });

  } catch (error) {
    await transaction.rollback();
    throw error;
  }
});

/**
 * Get content section analytics
 */
const getContentAnalytics = catchAsync(async (req, res) => {
  const { id } = req.params;
  const { period = '30d', metrics = ['views', 'clicks'] } = req.query;

  // Only allow admin users to access analytics
  if (!['admin', 'super_admin'].includes(req.user.role)) {
    throw new AppError('Not authorized to view analytics', 403, true, 'NOT_AUTHORIZED');
  }

  const contentSection = await ContentSection.findByPk(id);

  if (!contentSection) {
    throw new AppError('Content section not found', 404, true, 'CONTENT_SECTION_NOT_FOUND');
  }

  // For now, return basic analytics from the model
  // In a real implementation, you'd query a separate analytics table
  const analytics = {
    section_id: id,
    period,
    data: {
      views: contentSection.view_count || 0,
      clicks: contentSection.click_count || 0,
      conversions: contentSection.conversion_count || 0,
    },
    summary: {
      total_views: contentSection.view_count || 0,
      total_clicks: contentSection.click_count || 0,
      total_conversions: contentSection.conversion_count || 0,
      click_through_rate: contentSection.view_count > 0 
        ? ((contentSection.click_count || 0) / contentSection.view_count * 100).toFixed(2) + '%'
        : '0%',
      conversion_rate: contentSection.click_count > 0
        ? ((contentSection.conversion_count || 0) / contentSection.click_count * 100).toFixed(2) + '%'
        : '0%'
    }
  };

  res.status(200).json({
    success: true,
    data: {
      analytics
    },
  });
});

module.exports = {
  getContentSection,
  updateContentSection,
  getAllContentSections,
  getGalleryImages,
  uploadGalleryImage,
  updateGalleryImage,
  deleteGalleryImage,
  getBdrfInfoSection,
  getCallToActionSection,
  // New flexible content section methods
  createContentSection,
  getContentSections,
  getContentSectionByKey,
  updateContentSectionById,
  deleteContentSection,
  getPageContent,
  bulkUpdateContentSections,
  reorderContentSections,
  getContentAnalytics,
};