const { Op } = require('sequelize');
const { BlogPost, User } = require('../models');
const { catchAsync, AppError, createNotFoundError, createValidationError } = require('../middleware/errorHandler');
const { getPaginationOffset, getPaginationMeta, isValidUUID, sanitizeHtml } = require('../utils/helpers');
const fileUploadService = require('../services/fileUploadService');
const logger = require('../utils/logger');

/**
 * Admin Blog Controller
 * 
 * Provides comprehensive admin CRUD operations for blog posts with the following features:
 * - Full blog post management (create, read, update, delete)
 * - Advanced filtering and pagination
 * - Image upload handling (featured image and gallery)
 * - Status management (draft, published, archived, scheduled)
 * - SEO and social media optimization fields
 * - Bulk operations for managing multiple posts
 * - Author management and association
 * - Rich content handling with sanitization
 * - Analytics and metadata support
 * 
 * API Endpoints:
 * GET    /admin/blogs                    - Get all blog posts with filters and pagination
 * GET    /admin/blogs/metadata           - Get categories, tags, and authors for dropdowns
 * GET    /admin/blogs/:id                - Get single blog post by ID for editing
 * POST   /admin/blogs                    - Create new blog post (with image upload)
 * PUT    /admin/blogs/:id                - Update existing blog post (with image upload)
 * DELETE /admin/blogs/:id                - Delete/Archive blog post
 * PATCH  /admin/blogs/:id/status         - Toggle blog post status
 * PATCH  /admin/blogs/:id/featured       - Toggle featured status
 * POST   /admin/blogs/bulk               - Perform bulk operations on multiple posts
 * 
 * Features:
 * - Automatic slug generation and uniqueness check
 * - Content sanitization for security
 * - Rich SEO meta fields (title, description, keywords, canonical URL)
 * - Open Graph and Twitter Card support for social sharing
 * - Image optimization and cloud storage via Cloudinary
 * - Advanced search and filtering capabilities
 * - Comprehensive logging and error handling
 * - Role-based access control (admin/super_admin)
 */

/**
 * Create a new blog post
 */
const createBlogPost = catchAsync(async (req, res) => {
  const {
    title,
    content,
    custom_excerpt,
    category,
    tags,
    author_name,
    status = 'draft',
    is_featured = false,
    allow_comments = true,
    published_at,
    seo_title,
    seo_description,
    seo_keywords,
    canonical_url,
    og_title,
    og_description,
    og_image,
    twitter_title,
    twitter_description,
    twitter_image,
    metadata
  } = req.body;

  // Validate required fields
  if (!title) {
    throw createValidationError('Title is required');
  }

  // Sanitize content if provided
  const sanitizedContent = content ? sanitizeHtml(content) : null;

  // Prepare blog post data
  const blogPostData = {
    title: title.trim(),
    content: sanitizedContent,
    custom_excerpt: custom_excerpt?.trim() || null,
    category: category?.trim() || null,
    tags: Array.isArray(tags) ? tags.filter(tag => tag && tag.trim()) : [],
    author_name: author_name?.trim() || req.user.first_name + ' ' + req.user.last_name,
    status,
    is_featured,
    allow_comments,
    published_at: status === 'published' && published_at ? new Date(published_at) : null,
    seo_title: seo_title?.trim() || null,
    seo_description: seo_description?.trim() || null,
    seo_keywords: Array.isArray(seo_keywords) ? seo_keywords.filter(keyword => keyword && keyword.trim()) : [],
    canonical_url: canonical_url?.trim() || null,
    og_title: og_title?.trim() || null,
    og_description: og_description?.trim() || null,
    og_image: og_image?.trim() || null,
    twitter_title: twitter_title?.trim() || null,
    twitter_description: twitter_description?.trim() || null,
    twitter_image: twitter_image?.trim() || null,
    metadata: metadata || {},
    created_by: req.user.id
  };

  // Create blog post
  const blogPost = await BlogPost.create(blogPostData);

  // Handle featured image upload if provided
  if (req.files && req.files.featured_image && req.files.featured_image[0]) {
    try {
      const uploadResult = await fileUploadService.uploadBlogImage(req.files.featured_image[0], blogPost.id);
      blogPost.featured_image = uploadResult.url;
      await blogPost.save();
    } catch (uploadError) {
      logger.logError(uploadError, {
        context: 'blog_featured_image_upload',
        blogPostId: blogPost.id,
        userId: req.user.id
      });
      // Continue without failing the entire operation
    }
  }

  // Handle gallery images if provided
  if (req.files && req.files.gallery_images && req.files.gallery_images.length > 0) {
    try {
      const galleryUploadResult = await fileUploadService.uploadMultipleImages(
        req.files.gallery_images,
        {
          folder: `blog/${blogPost.id}/gallery`,
          width: 800,
          height: 600,
          crop: 'fill'
        }
      );
      
      if (galleryUploadResult.images && galleryUploadResult.images.length > 0) {
        blogPost.gallery_images = galleryUploadResult.images.map(img => img.url);
        await blogPost.save();
      }
    } catch (uploadError) {
      logger.logError(uploadError, {
        context: 'blog_gallery_upload',
        blogPostId: blogPost.id,
        userId: req.user.id
      });
    }
  }

  // Fetch the created post with author info
  const createdPost = await BlogPost.findByPk(blogPost.id, {
    include: [
      {
        model: User,
        as: 'author',
        attributes: ['id', 'first_name', 'last_name', 'email', 'role']
      }
    ]
  });

  if (!createdPost) {
    throw new AppError('Failed to retrieve created blog post', 500, true, 'CREATE_RETRIEVAL_ERROR');
  }

  logger.contextLogger.admin('Blog post created', 'info', {
    blogPostId: createdPost.id,
    title: createdPost.title,
    status: createdPost.status,
    adminId: req.user.id
  });

  res.status(201).json({
    success: true,
    message: 'Blog post created successfully',
    data: {
      blog_post: createdPost.getAdminData()
    }
  });
});

/**
 * Update an existing blog post
 */
const updateBlogPost = catchAsync(async (req, res) => {
  const { id } = req.params;
  const {
    title,
    content,
    custom_excerpt,
    category,
    tags,
    author_name,
    status,
    is_featured,
    allow_comments,
    published_at,
    seo_title,
    seo_description,
    seo_keywords,
    canonical_url,
    og_title,
    og_description,
    og_image,
    twitter_title,
    twitter_description,
    twitter_image,
    metadata
  } = req.body;

  // Find the blog post
  const blogPost = await BlogPost.findByPk(id);
  if (!blogPost) {
    throw createNotFoundError('Blog post');
  }

  // Prepare update data (only include provided fields)
  const updateData = {};
  
  if (title !== undefined) {
    updateData.title = title.trim();
  }
  
  if (content !== undefined) {
    updateData.content = content ? sanitizeHtml(content) : null;
  }
  
  if (custom_excerpt !== undefined) {
    updateData.custom_excerpt = custom_excerpt?.trim() || null;
  }
  
  if (category !== undefined) {
    updateData.category = category?.trim() || null;
  }
  
  if (tags !== undefined) {
    updateData.tags = Array.isArray(tags) ? tags.filter(tag => tag && tag.trim()) : [];
  }
  
  if (author_name !== undefined) {
    updateData.author_name = author_name?.trim() || null;
  }
  
  if (status !== undefined) {
    updateData.status = status;
    // Handle published_at when status changes to published
    if (status === 'published' && !blogPost.published_at) {
      updateData.published_at = published_at ? new Date(published_at) : new Date();
    }
  }
  
  if (is_featured !== undefined) {
    updateData.is_featured = is_featured;
  }
  
  if (allow_comments !== undefined) {
    updateData.allow_comments = allow_comments;
  }
  
  if (published_at !== undefined) {
    updateData.published_at = published_at ? new Date(published_at) : null;
  }
  
  // SEO fields
  if (seo_title !== undefined) {
    updateData.seo_title = seo_title?.trim() || null;
  }
  
  if (seo_description !== undefined) {
    updateData.seo_description = seo_description?.trim() || null;
  }
  
  if (seo_keywords !== undefined) {
    updateData.seo_keywords = Array.isArray(seo_keywords) ? seo_keywords.filter(keyword => keyword && keyword.trim()) : [];
  }
  
  if (canonical_url !== undefined) {
    updateData.canonical_url = canonical_url?.trim() || null;
  }
  
  // Open Graph fields
  if (og_title !== undefined) {
    updateData.og_title = og_title?.trim() || null;
  }
  
  if (og_description !== undefined) {
    updateData.og_description = og_description?.trim() || null;
  }
  
  if (og_image !== undefined) {
    updateData.og_image = og_image?.trim() || null;
  }
  
  // Twitter Card fields
  if (twitter_title !== undefined) {
    updateData.twitter_title = twitter_title?.trim() || null;
  }
  
  if (twitter_description !== undefined) {
    updateData.twitter_description = twitter_description?.trim() || null;
  }
  
  if (twitter_image !== undefined) {
    updateData.twitter_image = twitter_image?.trim() || null;
  }
  
  if (metadata !== undefined) {
    updateData.metadata = metadata || {};
  }

  // Update the blog post
  await blogPost.update(updateData);

  // Handle new featured image upload
  if (req.files && req.files.featured_image && req.files.featured_image[0]) {
    try {
      const uploadResult = await fileUploadService.uploadBlogImage(req.files.featured_image[0], blogPost.id);
      await blogPost.update({ featured_image: uploadResult.url });
    } catch (uploadError) {
      logger.logError(uploadError, {
        context: 'blog_featured_image_update',
        blogPostId: blogPost.id,
        userId: req.user.id
      });
    }
  }

  // Handle gallery images update
  if (req.files && req.files.gallery_images && req.files.gallery_images.length > 0) {
    try {
      const galleryUploadResult = await fileUploadService.uploadMultipleImages(
        req.files.gallery_images,
        {
          folder: `blog/${blogPost.id}/gallery`,
          width: 800,
          height: 600,
          crop: 'fill'
        }
      );
      
      if (galleryUploadResult.images && galleryUploadResult.images.length > 0) {
        const existingImages = blogPost.gallery_images || [];
        const newImages = galleryUploadResult.images.map(img => img.url);
        await blogPost.update({
          gallery_images: [...existingImages, ...newImages]
        });
      }
    } catch (uploadError) {
      logger.logError(uploadError, {
        context: 'blog_gallery_update',
        blogPostId: blogPost.id,
        userId: req.user.id
      });
    }
  }

  // Fetch updated post with author info
  const updatedPost = await BlogPost.findByPk(id, {
    include: [
      {
        model: User,
        as: 'author',
        attributes: ['id', 'first_name', 'last_name', 'email', 'role']
      }
    ]
  });

  logger.contextLogger.admin('Blog post updated', 'info', {
    blogPostId: updatedPost.id,
    title: updatedPost.title,
    status: updatedPost.status,
    adminId: req.user.id,
    updatedFields: Object.keys(updateData)
  });

  res.status(200).json({
    success: true,
    message: 'Blog post updated successfully',
    data: {
      blog_post: updatedPost.getAdminData()
    }
  });
});

/**
 * Delete a blog post (soft delete preferred)
 */
const deleteBlogPost = catchAsync(async (req, res) => {
  const { id } = req.params;
  const { permanent = false } = req.query;

  // Find the blog post
  const blogPost = await BlogPost.findByPk(id);
  if (!blogPost) {
    throw createNotFoundError('Blog post');
  }

  if (permanent && req.user.role === 'super_admin') {
    // Hard delete for super admins
    await blogPost.destroy();
    
    logger.contextLogger.admin('Blog post permanently deleted', 'warn', {
      blogPostId: id,
      title: blogPost.title,
      adminId: req.user.id
    });

    res.status(200).json({
      success: true,
      message: 'Blog post permanently deleted'
    });
  } else {
    // Soft delete - set status to archived
    await blogPost.update({ status: 'archived' });
    
    logger.contextLogger.admin('Blog post archived', 'info', {
      blogPostId: id,
      title: blogPost.title,
      adminId: req.user.id
    });

    res.status(200).json({
      success: true,
      message: 'Blog post archived successfully'
    });
  }
});

/**
 * Get all blogs for admin with pagination and filters
 */
const getAllBlogsAdmin = catchAsync(async (req, res) => {
  const {
    page = 1,
    limit = 10,
    status,
    category,
    is_featured,
    author_id,
    search,
    sort_by = 'created_at',
    sort_order = 'desc',
    date_from,
    date_to
  } = req.query;

  const offset = getPaginationOffset(page, limit);
  const limitNum = parseInt(limit);

  // Build where conditions
  const whereConditions = {};

  if (status) {
    whereConditions.status = status;
  }

  if (category) {
    whereConditions.category = category;
  }

  if (is_featured !== undefined) {
    whereConditions.is_featured = is_featured === 'true';
  }

  if (author_id) {
    whereConditions.created_by = author_id;
  }

  if (search) {
    whereConditions[Op.or] = [
      { title: { [Op.iLike]: `%${search}%` } },
      { content: { [Op.iLike]: `%${search}%` } },
      { custom_excerpt: { [Op.iLike]: `%${search}%` } }
    ];
  }

  if (date_from || date_to) {
    whereConditions.created_at = {};
    if (date_from) {
      whereConditions.created_at[Op.gte] = new Date(date_from);
    }
    if (date_to) {
      whereConditions.created_at[Op.lte] = new Date(date_to);
    }
  }

  // Validate sort_by field
  const allowedSortFields = ['created_at', 'updated_at', 'title', 'status', 'view_count', 'like_count', 'published_at'];
  const sortBy = allowedSortFields.includes(sort_by) ? sort_by : 'created_at';
  const sortOrder = sort_order.toLowerCase() === 'asc' ? 'ASC' : 'DESC';

  // Fetch blog posts
  const { count, rows: blogPosts } = await BlogPost.findAndCountAll({
    where: whereConditions,
    include: [
      {
        model: User,
        as: 'author',
        attributes: ['id', 'first_name', 'last_name', 'email', 'role']
      }
    ],
    order: [[sortBy, sortOrder]],
    limit: limitNum,
    offset: offset
  });

  // Get pagination metadata
  const paginationMeta = getPaginationMeta(page, limit, count);

  // Get statistics for the current filter
  const stats = await BlogPost.findAll({
    where: whereConditions,
    attributes: [
      [BlogPost.sequelize.fn('COUNT', '*'), 'total'],
      [BlogPost.sequelize.fn('COUNT', BlogPost.sequelize.literal('CASE WHEN status = \'published\' THEN 1 END')), 'published'],
      [BlogPost.sequelize.fn('COUNT', BlogPost.sequelize.literal('CASE WHEN status = \'draft\' THEN 1 END')), 'drafts'],
      [BlogPost.sequelize.fn('COUNT', BlogPost.sequelize.literal('CASE WHEN status = \'archived\' THEN 1 END')), 'archived'],
      [BlogPost.sequelize.fn('COUNT', BlogPost.sequelize.literal('CASE WHEN is_featured = true THEN 1 END')), 'featured']
    ],
    raw: true
  });

  const formattedPosts = blogPosts.map(post => post.getAdminData());

  res.status(200).json({
    success: true,
    data: {
      blog_posts: formattedPosts,
      pagination: paginationMeta,
      statistics: stats[0] || {
        total: 0,
        published: 0,
        drafts: 0,
        archived: 0,
        featured: 0
      },
      filters: {
        status,
        category,
        is_featured,
        author_id,
        search,
        date_from,
        date_to
      }
    }
  });
});

/**
 * Get single blog post by ID for admin editing
 */
const getBlogByIdAdmin = catchAsync(async (req, res) => {
  const { id } = req.params;

  // Validate ID format
  if (!isValidUUID(id)) {
    throw createValidationError('Invalid blog post ID format');
  }

  // Find the blog post with author info
  const blogPost = await BlogPost.findByPk(id, {
    include: [
      {
        model: User,
        as: 'author',
        attributes: ['id', 'first_name', 'last_name', 'email', 'role']
      }
    ]
  });

  if (!blogPost) {
    throw createNotFoundError('Blog post');
  }

  res.status(200).json({
    success: true,
    data: {
      blog_post: blogPost.getAdminData(),
      author: blogPost.author
    }
  });
});

/**
 * Toggle blog post status (draft/published/archived)
 */
const toggleBlogStatus = catchAsync(async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  // Validate status
  const validStatuses = ['draft', 'published', 'archived', 'scheduled'];
  if (!validStatuses.includes(status)) {
    throw createValidationError('Invalid status. Must be one of: ' + validStatuses.join(', '));
  }

  // Find the blog post
  const blogPost = await BlogPost.findByPk(id);
  if (!blogPost) {
    throw createNotFoundError('Blog post');
  }

  const oldStatus = blogPost.status;
  const updateData = { status };

  // Set published_at when changing to published
  if (status === 'published' && !blogPost.published_at) {
    updateData.published_at = new Date();
  }

  // Update the status
  await blogPost.update(updateData);

  logger.contextLogger.admin('Blog post status changed', 'info', {
    blogPostId: id,
    title: blogPost.title,
    oldStatus,
    newStatus: status,
    adminId: req.user.id
  });

  res.status(200).json({
    success: true,
    message: `Blog post status changed from ${oldStatus} to ${status}`,
    data: {
      id: blogPost.id,
      status: blogPost.status,
      published_at: blogPost.published_at
    }
  });
});

/**
 * Toggle featured status
 */
const toggleFeatured = catchAsync(async (req, res) => {
  const { id } = req.params;

  // Find the blog post
  const blogPost = await BlogPost.findByPk(id);
  if (!blogPost) {
    throw createNotFoundError('Blog post');
  }

  const newFeaturedStatus = !blogPost.is_featured;
  
  // Update featured status
  await blogPost.update({ is_featured: newFeaturedStatus });

  logger.contextLogger.admin('Blog post featured status toggled', 'info', {
    blogPostId: id,
    title: blogPost.title,
    is_featured: newFeaturedStatus,
    adminId: req.user.id
  });

  res.status(200).json({
    success: true,
    message: `Blog post ${newFeaturedStatus ? 'marked as featured' : 'removed from featured'}`,
    data: {
      id: blogPost.id,
      is_featured: newFeaturedStatus
    }
  });
});

/**
 * Get blog categories and tags for admin dropdown
 */
const getBlogMetadata = catchAsync(async (req, res) => {
  // Get distinct categories
  const categories = await BlogPost.findAll({
    attributes: [[BlogPost.sequelize.fn('DISTINCT', BlogPost.sequelize.col('category')), 'category']],
    where: {
      category: { [Op.ne]: null }
    },
    raw: true
  });

  // Get all tags
  const tagResults = await BlogPost.findAll({
    attributes: ['tags'],
    where: {
      tags: { [Op.ne]: [] }
    },
    raw: true
  });

  // Extract unique tags
  const allTags = [];
  tagResults.forEach(result => {
    if (result.tags && Array.isArray(result.tags)) {
      allTags.push(...result.tags);
    }
  });
  const uniqueTags = [...new Set(allTags.filter(tag => tag && tag.trim()))];

  // Get authors who have created blog posts
  const authors = await User.findAll({
    attributes: ['id', 'first_name', 'last_name', 'email'],
    include: [
      {
        model: BlogPost,
        as: 'blogPosts',
        attributes: [],
        required: true
      }
    ],
    group: ['User.id']
  });

  res.status(200).json({
    success: true,
    data: {
      categories: categories.map(cat => cat.category).filter(Boolean),
      tags: uniqueTags.sort(),
      authors: authors.map(author => ({
        id: author.id,
        name: `${author.first_name} ${author.last_name}`,
        email: author.email
      }))
    }
  });
});

/**
 * Bulk operations for blog posts
 */
const bulkOperations = catchAsync(async (req, res) => {
  const { operation, post_ids, data } = req.body;

  if (!Array.isArray(post_ids) || post_ids.length === 0) {
    throw createValidationError('post_ids must be a non-empty array');
  }

  const validOperations = ['delete', 'archive', 'publish', 'feature', 'unfeature', 'update_category'];
  if (!validOperations.includes(operation)) {
    throw createValidationError('Invalid operation. Must be one of: ' + validOperations.join(', '));
  }

  let updateData = {};
  let message = '';

  switch (operation) {
    case 'delete':
      if (req.user.role !== 'super_admin') {
        throw new AppError('Only super admins can permanently delete blog posts', 403, true, 'INSUFFICIENT_PERMISSIONS');
      }
      await BlogPost.destroy({
        where: { id: { [Op.in]: post_ids } }
      });
      message = `${post_ids.length} blog posts deleted permanently`;
      break;

    case 'archive':
      updateData = { status: 'archived' };
      message = `${post_ids.length} blog posts archived`;
      break;

    case 'publish':
      updateData = { 
        status: 'published',
        published_at: new Date()
      };
      message = `${post_ids.length} blog posts published`;
      break;

    case 'feature':
      updateData = { is_featured: true };
      message = `${post_ids.length} blog posts marked as featured`;
      break;

    case 'unfeature':
      updateData = { is_featured: false };
      message = `${post_ids.length} blog posts removed from featured`;
      break;

    case 'update_category':
      if (!data || !data.category) {
        throw createValidationError('Category is required for category update operation');
      }
      updateData = { category: data.category };
      message = `${post_ids.length} blog posts updated to category: ${data.category}`;
      break;
  }

  if (Object.keys(updateData).length > 0) {
    await BlogPost.update(updateData, {
      where: { id: { [Op.in]: post_ids } }
    });
  }

  logger.contextLogger.admin('Blog posts bulk operation', 'info', {
    operation,
    postIds: post_ids,
    data,
    adminId: req.user.id
  });

  res.status(200).json({
    success: true,
    message,
    data: {
      operation,
      affected_posts: post_ids.length
    }
  });
});

module.exports = {
  createBlogPost,
  updateBlogPost,
  deleteBlogPost,
  getAllBlogsAdmin,
  getBlogByIdAdmin,
  toggleBlogStatus,
  toggleFeatured,
  getBlogMetadata,
  bulkOperations
};