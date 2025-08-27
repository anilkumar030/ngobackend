const { sequelize } = require('../config/database');

// Import all models
const User = require('./User');
const UserAddress = require('./UserAddress');
const Campaign = require('./Campaign');
const Donation = require('./Donation');
const Product = require('./Product');
const Order = require('./Order');
const OrderItem = require('./OrderItem');
const BlogPost = require('./BlogPost');
const Gallery = require('./Gallery');
const ContentSection = require('./ContentSection');
const Event = require('./Event');
const Project = require('./Project');
const Testimonial = require('./Testimonial');
const Statistics = require('./Statistics');
const Certificate = require('./Certificate');
const SavedCampaign = require('./SavedCampaign');
const ProjectUpdate = require('./ProjectUpdate');
const EventRegistration = require('./EventRegistration');
const CampaignUpdate = require('./CampaignUpdate');

// Define associations
const setupAssociations = () => {
  // User associations
  User.hasMany(UserAddress, {
    foreignKey: 'user_id',
    as: 'addresses'
  });
  
  User.hasMany(Campaign, {
    foreignKey: 'created_by',
    as: 'campaigns'
  });
  
  User.hasMany(Donation, {
    foreignKey: 'user_id',
    as: 'donations'
  });
  
  User.hasMany(Order, {
    foreignKey: 'user_id',
    as: 'orders'
  });
  
  User.hasMany(Product, {
    foreignKey: 'created_by',
    as: 'products'
  });
  
  User.hasMany(BlogPost, {
    foreignKey: 'created_by',
    as: 'blogPosts'
  });
  
  User.hasMany(Gallery, {
    foreignKey: 'uploaded_by',
    as: 'galleryImages'
  });
  
  User.hasMany(ContentSection, {
    foreignKey: 'created_by',
    as: 'contentSections'
  });
  
  User.hasMany(ContentSection, {
    foreignKey: 'updated_by',
    as: 'updatedContentSections'
  });
  
  User.hasMany(Event, {
    foreignKey: 'created_by',
    as: 'events'
  });
  
  User.hasMany(Project, {
    foreignKey: 'created_by',
    as: 'projects'
  });
  
  User.hasMany(Project, {
    foreignKey: 'managed_by',
    as: 'managedProjects'
  });
  
  User.hasMany(Testimonial, {
    foreignKey: 'user_id',
    as: 'testimonials'
  });
  
  User.hasMany(Testimonial, {
    foreignKey: 'approved_by',
    as: 'approvedTestimonials'
  });
  
  User.hasMany(Statistics, {
    foreignKey: 'created_by',
    as: 'statistics'
  });
  
  User.hasMany(Statistics, {
    foreignKey: 'updated_by',
    as: 'updatedStatistics'
  });
  
  User.hasMany(Certificate, {
    foreignKey: 'user_id',
    as: 'certificates'
  });
  
  User.hasMany(Certificate, {
    foreignKey: 'issued_by',
    as: 'issuedCertificates'
  });
  
  User.hasMany(SavedCampaign, {
    foreignKey: 'user_id',
    as: 'savedCampaigns'
  });
  
  User.hasMany(ProjectUpdate, {
    foreignKey: 'created_by',
    as: 'projectUpdates'
  });
  
  User.hasMany(EventRegistration, {
    foreignKey: 'user_id',
    as: 'eventRegistrations'
  });
  
  User.hasMany(EventRegistration, {
    foreignKey: 'confirmed_by',
    as: 'confirmedRegistrations'
  });
  
  User.hasMany(EventRegistration, {
    foreignKey: 'cancelled_by',
    as: 'cancelledRegistrations'
  });

  // UserAddress associations
  UserAddress.belongsTo(User, {
    foreignKey: 'user_id',
    as: 'user'
  });

  // Campaign associations
  Campaign.belongsTo(User, {
    foreignKey: 'created_by',
    as: 'creator'
  });
  
  Campaign.hasMany(Donation, {
    foreignKey: 'campaign_id',
    as: 'donations'
  });

  // Donation associations
  Donation.belongsTo(User, {
    foreignKey: 'user_id',
    as: 'user'
  });
  
  Donation.belongsTo(Campaign, {
    foreignKey: 'campaign_id',
    as: 'campaign'
  });

  // Product associations
  Product.belongsTo(User, {
    foreignKey: 'created_by',
    as: 'creator'
  });
  
  Product.hasMany(OrderItem, {
    foreignKey: 'product_id',
    as: 'orderItems'
  });

  // Order associations
  Order.belongsTo(User, {
    foreignKey: 'user_id',
    as: 'user'
  });
  
  Order.hasMany(OrderItem, {
    foreignKey: 'order_id',
    as: 'items'
  });

  // OrderItem associations
  OrderItem.belongsTo(Order, {
    foreignKey: 'order_id',
    as: 'order'
  });
  
  OrderItem.belongsTo(Product, {
    foreignKey: 'product_id',
    as: 'product'
  });

  // BlogPost associations
  BlogPost.belongsTo(User, {
    foreignKey: 'created_by',
    as: 'author'
  });

  // Gallery associations
  Gallery.belongsTo(User, {
    foreignKey: 'uploaded_by',
    as: 'uploader'
  });

  // ContentSection associations
  ContentSection.belongsTo(User, {
    foreignKey: 'created_by',
    as: 'creator'
  });
  
  ContentSection.belongsTo(User, {
    foreignKey: 'updated_by',
    as: 'updater'
  });

  // Event associations
  Event.belongsTo(User, {
    foreignKey: 'created_by',
    as: 'creator'
  });
  
  Event.hasMany(EventRegistration, {
    foreignKey: 'event_id',
    as: 'registrations'
  });
  
  Event.hasMany(Testimonial, {
    foreignKey: 'event_id',
    as: 'testimonials'
  });

  // Project associations
  Project.belongsTo(User, {
    foreignKey: 'created_by',
    as: 'creator'
  });
  
  Project.belongsTo(User, {
    foreignKey: 'managed_by',
    as: 'manager'
  });
  
  Project.hasMany(ProjectUpdate, {
    foreignKey: 'project_id',
    as: 'updates'
  });
  
  Project.hasMany(Testimonial, {
    foreignKey: 'project_id',
    as: 'testimonials'
  });

  // Testimonial associations
  Testimonial.belongsTo(User, {
    foreignKey: 'user_id',
    as: 'user'
  });
  
  Testimonial.belongsTo(User, {
    foreignKey: 'approved_by',
    as: 'approver'
  });
  
  Testimonial.belongsTo(Project, {
    foreignKey: 'project_id',
    as: 'project'
  });
  
  Testimonial.belongsTo(Campaign, {
    foreignKey: 'campaign_id',
    as: 'campaign'
  });
  
  Testimonial.belongsTo(Event, {
    foreignKey: 'event_id',
    as: 'event'
  });

  // Statistics associations
  Statistics.belongsTo(User, {
    foreignKey: 'created_by',
    as: 'creator'
  });
  
  Statistics.belongsTo(User, {
    foreignKey: 'updated_by',
    as: 'updater'
  });

  // Certificate associations
  Certificate.belongsTo(User, {
    foreignKey: 'user_id',
    as: 'user'
  });
  
  Certificate.belongsTo(User, {
    foreignKey: 'issued_by',
    as: 'issuer'
  });

  // SavedCampaign associations
  SavedCampaign.belongsTo(User, {
    foreignKey: 'user_id',
    as: 'user'
  });
  
  SavedCampaign.belongsTo(Campaign, {
    foreignKey: 'campaign_id',
    as: 'campaign'
  });

  // Campaign additional associations
  Campaign.hasMany(SavedCampaign, {
    foreignKey: 'campaign_id',
    as: 'savedByUsers'
  });
  
  Campaign.hasMany(Testimonial, {
    foreignKey: 'campaign_id',
    as: 'testimonials'
  });
  
  Campaign.hasMany(CampaignUpdate, {
    foreignKey: 'campaign_id',
    as: 'updates'
  });

  // ProjectUpdate associations
  ProjectUpdate.belongsTo(Project, {
    foreignKey: 'project_id',
    as: 'project'
  });
  
  ProjectUpdate.belongsTo(User, {
    foreignKey: 'created_by',
    as: 'author'
  });

  // EventRegistration associations
  EventRegistration.belongsTo(Event, {
    foreignKey: 'event_id',
    as: 'event'
  });
  
  EventRegistration.belongsTo(User, {
    foreignKey: 'user_id',
    as: 'user'
  });
  
  EventRegistration.belongsTo(User, {
    foreignKey: 'confirmed_by',
    as: 'confirmer'
  });
  
  EventRegistration.belongsTo(User, {
    foreignKey: 'cancelled_by',
    as: 'canceller'
  });

  // CampaignUpdate associations
  CampaignUpdate.belongsTo(Campaign, {
    foreignKey: 'campaign_id',
    as: 'campaign'
  });
};

// Initialize associations
setupAssociations();

// Model collection
const models = {
  User,
  UserAddress,
  Campaign,
  Donation,
  Product,
  Order,
  OrderItem,
  BlogPost,
  Gallery,
  ContentSection,
  Event,
  Project,
  Testimonial,
  Statistics,
  Certificate,
  SavedCampaign,
  ProjectUpdate,
  EventRegistration,
  CampaignUpdate,
  sequelize
};

// Sync function for development
const syncModels = async (options = {}) => {
  try {
    await sequelize.sync(options);
    console.log('Database models synchronized successfully');
  } catch (error) {
    console.error('Error synchronizing database models:', error);
    throw error;
  }
};

// Close database connection
const closeConnection = async () => {
  try {
    await sequelize.close();
    console.log('Database connection closed successfully');
  } catch (error) {
    console.error('Error closing database connection:', error);
    throw error;
  }
};

module.exports = {
  ...models,
  setupAssociations,
  syncModels,
  closeConnection
};