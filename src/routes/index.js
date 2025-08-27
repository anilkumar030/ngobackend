const express = require('express');
const authRoutes = require('./authRoutes');
const campaignRoutes = require('./campaignRoutes');
const campaignUpdateRoutes = require('./campaignUpdateRoutes');
const paymentRoutes = require('./paymentRoutes');
const donationRoutes = require('./donationRoutes');
const contentRoutes = require('./contentRoutes');
const eventRoutes = require('./eventRoutes');
const projectRoutes = require('./projectRoutes');
const testimonialRoutes = require('./testimonialRoutes');
const statisticsRoutes = require('./statisticsRoutes');
const certificateRoutes = require('./certificateRoutes');
const galleryRoutes = require('./galleryRoutes');
const contactRoutes = require('./contactRoutes');
const { getHomeData } = require('../controllers/homeController');

const router = express.Router();

// Get project name from environment variable with fallback
const PROJECT_NAME = process.env.PROJECT_NAME || 'Shiv Dhaam Foundation';

// API documentation endpoint
router.get('/', (req, res) => {
  res.status(200).json({
    success: true,
    message: `${PROJECT_NAME} API`,
    version: '1.0.0',
    endpoints: {
      home: '/api/home',
      auth: '/api/auth',
      campaigns: '/api/campaigns',
      'campaign-updates': '/api/campaign-updates',
      events: '/api/events',
      projects: '/api/projects',
      testimonials: '/api/testimonials',
      statistics: '/api/statistics',
      certificates: '/api/certificates',
      payments: '/api/payment',
      donations: '/api/donations',
      content: '/api/content',
      contact: '/api/contact',
      profile: '/api/profile',
      store: '/api/store',
      blog: '/api/blog',
      gallery: '/api/gallery',
      admin: '/api/admin',
    },
    documentation: {
      swagger: '/api/docs',
      postman: '/api/docs/postman',
    },
    status: {
      server: 'running',
      database: 'connected',
      cache: 'connected',
      timestamp: new Date().toISOString(),
    },
  });
});

// Home page data endpoint
router.get('/home', getHomeData);

// Mount route modules
router.use('/auth', authRoutes);
router.use('/', campaignUpdateRoutes); // Mount campaign update routes FIRST for /api/campaigns/:id/updates and /api/campaign-updates/:id
router.use('/campaigns', campaignRoutes);
router.use('/events', eventRoutes);
router.use('/projects', projectRoutes);
router.use('/testimonials', testimonialRoutes);
router.use('/statistics', statisticsRoutes);
router.use('/certificates', certificateRoutes);
router.use('/payment', paymentRoutes);
router.use('/donations', donationRoutes);
// Receipt endpoints
router.get('/receipts/:campaignId.pdf', require('../controllers/donationController').downloadReceipt);
router.post('/receipts/email', require('../controllers/donationController').emailReceipt);
router.use('/content', contentRoutes);
router.use('/contact', contactRoutes);

// Profile routes (user-specific data)
router.use('/profile', require('./profileRoutes'));

// Store/e-commerce routes
router.use('/store', require('./storeRoutes'));

// Blog routes
router.use('/blog', require('./blogRoutes'));

// Gallery routes
router.use('/gallery', galleryRoutes);

// Admin routes
router.use('/admin', require('./adminRoutes'));

// API health check
router.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    environment: process.env.NODE_ENV || 'development',
  });
});

// API statistics (public)
router.get('/stats', async (req, res) => {
  try {
    const { Campaign, Donation, User, Order, Gallery } = require('../models');
    const { Op } = require('sequelize');

    // Get basic statistics
    const [
      totalCampaigns,
      activeCampaigns,
      totalDonations,
      totalDonationAmount,
      totalUsers,
      totalOrders,
      totalGalleryItems,
      featuredGalleryItems,
    ] = await Promise.all([
      Campaign.count(),
      Campaign.count({ where: { status: 'active' } }),
      Donation.count({ where: { payment_status: 'completed' } }),
      Donation.sum('amount', { where: { payment_status: 'completed' } }) || 0,
      User.count({ where: { is_active: true } }),
      Order.count({ where: { payment_status: 'paid' } }),
      Gallery.count({ where: { status: 'active' } }),
      Gallery.count({ where: { status: 'active', featured: true } }),
    ]);

    res.status(200).json({
      success: true,
      data: {
        campaigns: {
          total: totalCampaigns,
          active: activeCampaigns,
        },
        donations: {
          count: totalDonations,
          total_amount: totalDonationAmount,
        },
        users: {
          total: totalUsers,
        },
        orders: {
          total: totalOrders,
        },
        gallery: {
          total: totalGalleryItems,
          featured: featuredGalleryItems,
        },
        last_updated: new Date().toISOString(),
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch statistics',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
});

module.exports = router;