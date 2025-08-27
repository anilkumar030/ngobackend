const { Event, EventRegistration, User } = require('../models');
const { catchAsync, AppError } = require('../middleware/errorHandler');
const { redisUtils, CACHE_KEYS } = require('../config/redis');
const logger = require('../utils/logger');
const { Op } = require('sequelize');

/**
 * Get all events with filters and pagination
 */
const getEvents = catchAsync(async (req, res) => {
  const {
    page = 1,
    limit = 10,
    status,
    category,
    search,
    sort_by = 'start_date',
    sort_order = 'asc',
    is_featured
  } = req.query;

  // Check cache for public event listings
  const isPublicListing = !req.user;
  const cacheKey = isPublicListing ? CACHE_KEYS.EVENTS_LIST(page, limit, req.query) : null;
  
  if (cacheKey) {
    const cachedResult = await redisUtils.get(cacheKey);
    if (cachedResult) {
      return res.status(200).json(cachedResult);
    }
  }

  const offset = (page - 1) * limit;
  const now = new Date();

  // Build where conditions
  let whereConditions = {};

  // Only show active events for non-authenticated users
  if (!req.user || req.user.role === 'user') {
    whereConditions.status = 'active';
  } else if (status && ['draft', 'active', 'cancelled', 'completed'].includes(status)) {
    whereConditions.status = status;
  }

  // Handle status filtering by upcoming/ongoing/completed for active events
  if (status && ['upcoming', 'ongoing', 'completed'].includes(status)) {
    whereConditions.status = 'active';
    
    if (status === 'upcoming') {
      whereConditions.start_date = { [Op.gt]: now };
    } else if (status === 'ongoing') {
      whereConditions.start_date = { [Op.lte]: now };
      whereConditions.end_date = { [Op.gte]: now };
    } else if (status === 'completed') {
      whereConditions.end_date = { [Op.lt]: now };
    }
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

  // Get events count for pagination
  const totalCount = await Event.count({ where: whereConditions });

  // Get events with registrations count
  const events = await Event.findAll({
    where: whereConditions,
    include: [
      {
        model: User,
        as: 'creator',
        attributes: ['id', 'first_name', 'last_name', 'email'],
      },
      {
        model: EventRegistration,
        as: 'registrations',
        where: { status: ['confirmed', 'pending'] },
        attributes: ['id', 'participant_count'],
        required: false,
      }
    ],
    order: [[sort_by, sort_order.toUpperCase()]],
    limit: parseInt(limit),
    offset: offset,
  });

  // Process events with computed fields
  const eventsWithStatus = events.map(event => {
    const eventData = event.toJSON();
    
    // Calculate registered participants from registrations
    const registrations = eventData.registrations || [];
    const registeredCount = registrations.reduce((sum, reg) => sum + (reg.participant_count || 0), 0);
    eventData.registered_participants = registeredCount;
    
    // Remove registrations array from response (we only needed it for calculation)
    delete eventData.registrations;
    
    // Determine actual status based on dates
    if (eventData.status === 'active') {
      if (now < new Date(eventData.start_date)) {
        eventData.status = 'upcoming';
      } else if (now >= new Date(eventData.start_date) && now <= new Date(eventData.end_date)) {
        eventData.status = 'ongoing';
      } else {
        eventData.status = 'completed';
      }
    }

    // Set organizer data
    if (!eventData.organizer || Object.keys(eventData.organizer).length === 0) {
      eventData.organizer = {
        name: `${process.env.PROJECT_NAME || 'BDRF'} Team`,
        contact: `events@${(process.env.PROJECT_NAME || 'BDRF').toLowerCase()}.org`
      };
    }

    return {
      id: eventData.id,
      title: eventData.title,
      slug: eventData.slug,
      description: eventData.description,
      long_description: eventData.long_description,
      start_date: eventData.start_date,
      end_date: eventData.end_date,
      location: eventData.location,
      featured_image: eventData.featured_image,
      images: eventData.images,
      category: eventData.category,
      max_participants: eventData.max_participants,
      registered_participants: eventData.registered_participants,
      status: eventData.status,
      is_featured: eventData.is_featured,
      organizer: eventData.organizer
    };
  });

  const totalPages = Math.ceil(totalCount / limit);

  const response = {
    success: true,
    data: {
      events: eventsWithStatus,
      pagination: {
        current_page: parseInt(page),
        per_page: parseInt(limit),
        total: totalCount,
        total_pages: totalPages,
        has_next: parseInt(page) < totalPages,
        has_prev: parseInt(page) > 1,
      },
    },
  };

  // Cache public event listings for 5 minutes
  if (cacheKey) {
    await redisUtils.set(cacheKey, response, 300);
  }

  res.status(200).json(response);
});

/**
 * Get single event by ID or slug
 */
const getEvent = catchAsync(async (req, res) => {
  const { identifier } = req.params;
  
  // Check if identifier is UUID (ID) or slug
  const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(identifier);
  const whereCondition = isUUID 
    ? { id: identifier }
    : { slug: identifier };

  // Check cache first
  const cacheKey = `event:${identifier}`;
  const cachedEvent = await redisUtils.get(cacheKey);
  
  if (cachedEvent) {
    return res.status(200).json({
      success: true,
      data: {
        event: cachedEvent,
      },
    });
  }

  const event = await Event.findOne({
    where: whereCondition,
    include: [
      {
        model: User,
        as: 'creator',
        attributes: ['id', 'first_name', 'last_name', 'email', 'profile_image'],
      },
      {
        model: EventRegistration,
        as: 'registrations',
        where: { status: ['confirmed', 'pending'] },
        required: false,
        attributes: ['id', 'participant_count', 'status'],
      },
    ],
  });

  if (!event) {
    throw new AppError('Event not found', 404, true, 'EVENT_NOT_FOUND');
  }

  // Check if user can view this event
  if (event.status !== 'active' && 
      (!req.user || 
       (req.user.id !== event.created_by && 
        !['admin', 'super_admin'].includes(req.user.role)))) {
    throw new AppError('Event not found', 404, true, 'EVENT_NOT_FOUND');
  }

  const eventData = event.toJSON();
  const now = new Date();
  
  // Calculate registered participants from registrations
  const registrations = eventData.registrations || [];
  const registeredCount = registrations.reduce((sum, reg) => sum + (reg.participant_count || 0), 0);
  eventData.registered_participants = registeredCount;
  
  // Remove registrations array from response (we only needed it for calculation)
  delete eventData.registrations;

  // Determine actual status based on dates
  if (eventData.status === 'active') {
    if (now < new Date(eventData.start_date)) {
      eventData.status = 'upcoming';
    } else if (now >= new Date(eventData.start_date) && now <= new Date(eventData.end_date)) {
      eventData.status = 'ongoing';
    } else {
      eventData.status = 'completed';
    }
  }

  // Set organizer data
  if (!eventData.organizer || Object.keys(eventData.organizer).length === 0) {
    eventData.organizer = {
      name: `${process.env.PROJECT_NAME || 'BDRF'} Team`,
      contact: `events@${(process.env.PROJECT_NAME || 'BDRF').toLowerCase()}.org`
    };
  }

  // Format the response according to requirements
  const responseData = {
    id: eventData.id,
    title: eventData.title,
    slug: eventData.slug,
    description: eventData.description,
    long_description: eventData.long_description,
    start_date: eventData.start_date,
    end_date: eventData.end_date,
    location: eventData.location,
    featured_image: eventData.featured_image,
    images: eventData.images,
    category: eventData.category,
    max_participants: eventData.max_participants,
    registered_participants: eventData.registered_participants,
    status: eventData.status,
    is_featured: eventData.is_featured,
    organizer: eventData.organizer
  };

  // Cache the event data for 10 minutes
  await redisUtils.set(cacheKey, responseData, 600);

  res.status(200).json({
    success: true,
    data: {
      event: responseData,
    },
  });
});

/**
 * Register for event
 */
const registerForEvent = catchAsync(async (req, res) => {
  const { id } = req.params;
  const { participant_count = 1, contact_phone, special_requirements } = req.body;
  const userId = req.user.id;

  // Find the event
  const event = await Event.findByPk(id);
  
  if (!event) {
    throw new AppError('Event not found', 404, true, 'EVENT_NOT_FOUND');
  }

  // Check if event is available for registration
  if (event.status !== 'active') {
    throw new AppError('Event is not available for registration', 400, true, 'EVENT_NOT_AVAILABLE');
  }

  const now = new Date();

  // Check registration dates
  if (event.registration_start_date && now < event.registration_start_date) {
    throw new AppError('Registration has not started yet', 400, true, 'REGISTRATION_NOT_STARTED');
  }

  if (event.registration_end_date && now > event.registration_end_date) {
    throw new AppError('Registration deadline has passed', 400, true, 'REGISTRATION_CLOSED');
  }

  // Check if event has already started
  if (now >= event.start_date) {
    throw new AppError('Event has already started', 400, true, 'EVENT_STARTED');
  }

  // Check if user is already registered
  const existingRegistration = await EventRegistration.findOne({
    where: {
      event_id: id,
      user_id: userId,
      status: { [Op.in]: ['pending', 'confirmed'] }
    }
  });

  if (existingRegistration) {
    throw new AppError('You are already registered for this event', 400, true, 'ALREADY_REGISTERED');
  }

  // Check participant count limit
  if (participant_count < 1 || participant_count > 10) {
    throw new AppError('Participant count must be between 1 and 10', 400, true, 'INVALID_PARTICIPANT_COUNT');
  }

  // Check available slots
  if (event.max_participants) {
    const currentRegistrations = await EventRegistration.sum('participant_count', {
      where: {
        event_id: id,
        status: { [Op.in]: ['pending', 'confirmed'] }
      }
    }) || 0;

    const remainingSlots = event.max_participants - currentRegistrations;
    
    if (remainingSlots < participant_count) {
      throw new AppError(
        `Only ${remainingSlots} slots remaining. Cannot register ${participant_count} participants.`,
        400,
        true,
        'INSUFFICIENT_SLOTS'
      );
    }
  }

  // Calculate registration amount
  const registrationAmount = parseFloat(event.registration_fee || 0) * participant_count;

  // Create registration
  const registration = await EventRegistration.create({
    event_id: id,
    user_id: userId,
    participant_count,
    contact_phone,
    special_requirements,
    registration_amount: registrationAmount,
    status: 'confirmed', // Auto-confirm for now
    payment_status: registrationAmount > 0 ? 'pending' : 'completed'
  });

  // Clear event cache
  await redisUtils.del(`event:${id}`);
  await redisUtils.del(`event:${event.slug}`);
  
  // Clear events list cache (get all keys matching pattern and delete them)
  const eventListKeys = await redisUtils.keys('events:list:*');
  if (eventListKeys.length > 0) {
    for (const key of eventListKeys) {
      await redisUtils.del(key);
    }
  }

  logger.contextLogger.database('Event registration created', 'EventRegistration', {
    eventId: id,
    userId: userId,
    participantCount: participant_count,
    registrationId: registration.id
  });

  // Prepare response data matching requirements
  const responseData = {
    id: registration.id,
    registration_number: registration.registration_number,
    participant_count: registration.participant_count,
    contact_phone: registration.contact_phone,
    special_requirements: registration.special_requirements,
    status: registration.status,
    payment_status: registration.payment_status,
    registration_amount: parseFloat(registration.registration_amount),
    registered_at: registration.created_at,
    event: {
      id: event.id,
      title: event.title,
      slug: event.slug,
      start_date: event.start_date,
      end_date: event.end_date,
      location: event.location,
      featured_image: event.featured_image
    }
  };

  res.status(201).json({
    success: true,
    message: 'Registration successful',
    data: {
      registration: responseData
    },
  });
});

module.exports = {
  getEvents,
  getEvent,
  registerForEvent,
};