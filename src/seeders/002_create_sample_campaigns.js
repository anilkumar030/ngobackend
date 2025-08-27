'use strict';

const { v4: uuidv4 } = require('uuid');

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Get admin user ID
    const [adminUsers] = await queryInterface.sequelize.query(
      `SELECT id FROM users WHERE email = '${process.env.ADMIN_EMAIL || 'admin@shivdhaam.org'}' LIMIT 1`
    );
    
    if (adminUsers.length === 0) {
      throw new Error('Admin user not found. Please run admin user seeder first.');
    }
    
    const adminId = adminUsers[0].id;
    
    const campaigns = [
      {
        id: uuidv4(),
        title: 'Shiv Temple Reconstruction - Haridwar',
        slug: 'shiv-temple-reconstruction-haridwar',
        description: 'Help us rebuild the ancient Shiv temple in Haridwar that was damaged during recent floods. Your contribution will help restore this sacred place of worship for future generations.',
        short_description: 'Rebuild the ancient Shiv temple in Haridwar damaged by floods - restore this sacred place of worship.',
        long_description: 'The ancient Shiv temple in Haridwar, which has been a beacon of spirituality for over 500 years, suffered significant damage during the recent monsoon floods. The temple structure, prayer halls, and surrounding facilities need complete reconstruction to restore this sacred place to its former glory.\n\nThis temple serves thousands of devotees daily and plays a crucial role in the spiritual life of the community. Your generous donations will help us rebuild not just the physical structure, but also restore the spiritual center that brings peace and solace to countless souls.\n\nThe reconstruction includes:\n- Main temple structure and sanctum sanctorum\n- Prayer halls and meditation spaces\n- Devotee facilities and rest areas\n- Proper drainage and flood protection systems\n- Sacred garden and landscaping',
        location: 'Haridwar, Uttarakhand',
        target_amount: 5000000.00,
        raised_amount: 1250000.00,
        donor_count: 245,
        status: 'active',
        featured: true,
        verified: true,
        category: 'temple_construction',
        start_date: new Date('2024-01-01'),
        end_date: new Date('2025-12-31'),
        images: JSON.stringify([
          'https://example.com/images/temple-before-1.jpg',
          'https://example.com/images/temple-damage-1.jpg',
          'https://example.com/images/temple-plan-1.jpg'
        ]),
        metadata: JSON.stringify({
          location_coordinates: { lat: 29.9457, lng: 78.1642 },
          estimated_completion: '2025-10-31',
          contractor: 'Sacred Architecture Ltd.',
          permits_approved: true
        }),
        created_by: adminId,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        id: uuidv4(),
        title: 'Ganga Aarti Platform Enhancement',
        slug: 'ganga-aarti-platform-enhancement',
        description: 'Support the enhancement of our Ganga Aarti platform to accommodate more devotees and provide better facilities for the daily evening prayers.',
        short_description: 'Enhance the Ganga Aarti platform to accommodate more devotees with better facilities for evening prayers.',
        long_description: 'The daily Ganga Aarti at our ghat is a spiritually enriching experience that attracts thousands of devotees. However, our current platform can only accommodate a limited number of people, and many devotees have to stand far away or cannot participate fully in this sacred ceremony.\n\nWe are planning to expand and enhance the Aarti platform with:\n- Expanded seating capacity for 500+ devotees\n- Proper lighting and sound system\n- Weather protection canopies\n- Improved accessibility for elderly and disabled devotees\n- Enhanced safety railings and emergency exits\n- Sacred flame protection systems',
        location: 'Rishikesh, Uttarakhand',
        target_amount: 2500000.00,
        raised_amount: 875000.00,
        donor_count: 156,
        status: 'active',
        featured: true,
        verified: true,
        category: 'infrastructure',
        start_date: new Date('2024-02-01'),
        end_date: new Date('2024-12-31'),
        images: JSON.stringify([
          'https://example.com/images/aarti-current-1.jpg',
          'https://example.com/images/aarti-plan-1.jpg',
          'https://example.com/images/aarti-crowd-1.jpg'
        ]),
        metadata: JSON.stringify({
          location_coordinates: { lat: 30.0869, lng: 78.2676 },
          daily_attendees: 300,
          peak_season_attendees: 800,
          completion_target: '2024-11-30'
        }),
        created_by: adminId,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        id: uuidv4(),
        title: 'Anna Daan - Free Meal Service',
        slug: 'anna-daan-free-meal-service',
        description: 'Support our daily free meal service (Anna Daan) that provides nutritious food to pilgrims, saints, and needy individuals visiting the temple.',
        short_description: 'Support daily free meals (Anna Daan) for pilgrims, saints, and needy individuals visiting temples.',
        long_description: 'Anna Daan (food donation) is one of the most sacred services in Hindu tradition. Our temple has been providing free nutritious meals to pilgrims, saints, and needy individuals for many years. We serve over 1000 people daily with fresh, sattvic food prepared with love and devotion.\n\nYour contribution helps us:\n- Purchase quality ingredients and provisions\n- Maintain our community kitchen facilities\n- Pay for cooking gas, electricity, and water\n- Support our dedicated cooking staff\n- Provide serving utensils and plates\n- Maintain cleanliness and hygiene standards\n\nEvery donation, no matter how small, helps us serve more people and spread the message of love and compassion through food service.',
        location: 'Multiple Temple Locations',
        target_amount: 1200000.00,
        raised_amount: 720000.00,
        donor_count: 892,
        status: 'active',
        featured: false,
        verified: true,
        category: 'food_service',
        start_date: new Date('2024-01-01'),
        end_date: new Date('2024-12-31'),
        images: JSON.stringify([
          'https://example.com/images/anna-daan-1.jpg',
          'https://example.com/images/kitchen-1.jpg',
          'https://example.com/images/serving-1.jpg'
        ]),
        metadata: JSON.stringify({
          daily_meals: 1000,
          monthly_cost: 100000,
          beneficiaries: ['pilgrims', 'saints', 'poor', 'students'],
          meal_times: ['breakfast', 'lunch', 'dinner']
        }),
        created_by: adminId,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        id: uuidv4(),
        title: 'Vedic Education Center',
        slug: 'vedic-education-center',
        description: 'Establish a modern Vedic education center to preserve and teach ancient Sanskrit scriptures, yoga, and spiritual practices to future generations.',
        short_description: 'Establish a Vedic education center to preserve ancient Sanskrit scriptures and spiritual practices.',
        long_description: 'In today\'s fast-paced world, ancient Vedic knowledge and traditions are at risk of being lost. We are establishing a comprehensive Vedic Education Center that will serve as a beacon of traditional learning combined with modern teaching methods.\n\nThe center will offer:\n- Sanskrit language courses for all levels\n- Vedic philosophy and scripture studies\n- Traditional yoga and meditation practices\n- Spiritual counseling and guidance\n- Cultural programs and festivals\n- Library with rare manuscripts and texts\n- Digital archives of ancient knowledge\n\nThis center will not only preserve our ancient wisdom but also make it accessible to modern seekers, bridging the gap between tradition and contemporary life.',
        location: 'Rishikesh, Uttarakhand',
        target_amount: 8000000.00,
        raised_amount: 2100000.00,
        donor_count: 178,
        status: 'active',
        featured: true,
        verified: true,
        category: 'education',
        start_date: new Date('2024-03-01'),
        end_date: new Date('2026-03-31'),
        images: JSON.stringify([
          'https://example.com/images/education-plan-1.jpg',
          'https://example.com/images/library-design-1.jpg',
          'https://example.com/images/classroom-1.jpg'
        ]),
        metadata: JSON.stringify({
          expected_students: 500,
          courses_offered: 12,
          faculty_positions: 15,
          library_capacity: 10000
        }),
        created_by: adminId,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        id: uuidv4(),
        title: 'Medical Aid for Saints and Pilgrims',
        slug: 'medical-aid-saints-pilgrims',
        description: 'Provide free medical care and medicines to saints, elderly pilgrims, and underprivileged visitors who need healthcare support during their spiritual journey.',
        short_description: 'Free medical care and medicines for saints, elderly pilgrims, and underprivileged visitors.',
        long_description: 'Many saints and elderly pilgrims visit our temples seeking spiritual solace, but often lack access to proper medical care. Our medical aid program ensures that no one is denied healthcare due to financial constraints.\n\nOur services include:\n- Free medical consultations\n- Essential medicines and treatments\n- Emergency medical care\n- Health check-up camps\n- Specialized care for elderly\n- First aid during large gatherings\n- Ambulance services for emergencies\n\nThis program has already helped thousands of people receive necessary medical attention while on their spiritual journey. Your support helps us continue this vital service.',
        location: 'Various Temple Locations',
        target_amount: 3000000.00,
        raised_amount: 450000.00,
        donor_count: 267,
        status: 'active',
        featured: false,
        verified: true,
        category: 'healthcare',
        start_date: new Date('2024-01-15'),
        end_date: new Date('2024-12-31'),
        images: JSON.stringify([
          'https://example.com/images/medical-camp-1.jpg',
          'https://example.com/images/medicine-distribution-1.jpg',
          'https://example.com/images/health-checkup-1.jpg'
        ]),
        metadata: JSON.stringify({
          monthly_patients: 200,
          medical_camps_per_month: 4,
          medicines_distributed: 5000,
          doctors_involved: 8
        }),
        created_by: adminId,
        created_at: new Date(),
        updated_at: new Date()
      }
    ];

    await queryInterface.bulkInsert('campaigns', campaigns);
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.bulkDelete('campaigns', {
      slug: {
        [Sequelize.Op.in]: [
          'shiv-temple-reconstruction-haridwar',
          'ganga-aarti-platform-enhancement',
          'anna-daan-free-meal-service',
          'vedic-education-center',
          'medical-aid-saints-pilgrims'
        ]
      }
    });
  }
};