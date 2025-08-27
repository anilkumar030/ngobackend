'use strict';

const { v4: uuidv4 } = require('uuid');

// Get project name from environment variable with fallback
const PROJECT_NAME = process.env.PROJECT_NAME || 'Shiv Dhaam Foundation';

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
    
    const events = [
      {
        id: uuidv4(),
        title: 'Maha Shivratri Celebration 2024',
        slug: 'maha-shivratri-celebration-2024',
        description: 'Join us for the grand Maha Shivratri celebration with special pujas, cultural programs, and community feast.',
        long_description: 'Experience the divine energy of Maha Shivratri at our temple complex. The celebration includes:\n\n• Special abhishekam ceremonies throughout the night\n• Devotional singing and bhajan sessions\n• Cultural performances by local artists\n• Spiritual discourses by renowned saints\n• Community feast (prasadam) for all attendees\n• Meditation and yoga sessions\n\nThis is a perfect opportunity to immerse yourself in devotion and connect with the divine energy of Lord Shiva.',
        category: 'awareness',
        status: 'active',
        start_date: new Date('2024-03-08T18:00:00'),
        end_date: new Date('2024-03-09T06:00:00'),
        location: `${PROJECT_NAME} Temple Complex, Haridwar`,
        venue_details: JSON.stringify({
          capacity: 1000,
          facilities: ['Parking', 'Restrooms', 'Food Area', 'Medical Aid'],
          accessibility: 'Wheelchair accessible',
          contact_person: 'Temple Coordinator',
          contact_phone: '+91 98765 43210'
        }),
        max_participants: 1000,
        registered_participants: 0,
        registration_fee: 0.00,
        registration_start_date: new Date('2024-02-01'),
        registration_end_date: new Date('2024-03-07'),
        featured_image: 'https://example.com/images/maha-shivratri-2024.jpg',
        images: JSON.stringify([
          'https://example.com/images/shivratri-celebration-1.jpg',
          'https://example.com/images/temple-night-view.jpg',
          'https://example.com/images/devotees-prayer.jpg'
        ]),
        is_featured: true,
        organizer: JSON.stringify({
          name: PROJECT_NAME,
          email: 'events@shivdhaam.org',
          phone: '+91 98765 43210',
          website: 'www.shivdhaam.org'
        }),
        requirements: JSON.stringify([
          'Comfortable clothing suitable for long sitting',
          'Personal water bottle',
          'Small cushion or mat for sitting',
          'Respect for temple traditions and customs'
        ]),
        agenda: JSON.stringify([
          { time: '18:00', activity: 'Registration and Welcome' },
          { time: '19:00', activity: 'Evening Aarti' },
          { time: '20:00', activity: 'Spiritual Discourse' },
          { time: '21:00', activity: 'Cultural Performances' },
          { time: '22:00', activity: 'Community Dinner' },
          { time: '23:00', activity: 'Night-long Bhajan Session' },
          { time: '00:00', activity: 'Midnight Special Abhishekam' },
          { time: '03:00', activity: 'Meditation and Yoga' },
          { time: '05:30', activity: 'Morning Aarti' },
          { time: '06:00', activity: 'Breakfast Prasadam' }
        ]),
        speakers: JSON.stringify([
          {
            name: 'Swami Vedananda',
            title: 'Spiritual Teacher',
            topic: 'The Significance of Shivratri',
            bio: 'Renowned spiritual teacher with 30 years of experience'
          },
          {
            name: 'Dr. Kavita Sharma',
            title: 'Sanskrit Scholar',
            topic: 'Ancient Vedic Traditions',
            bio: 'PhD in Sanskrit and Vedic Studies from BHU'
          }
        ]),
        certificates: true,
        tags: JSON.stringify(['shivratri', 'festival', 'spiritual', 'community', 'temple', 'celebration']),
        metadata: JSON.stringify({
          special_arrangements: ['Free parking', 'Medical aid', 'Lost and found'],
          photography_allowed: true,
          live_streaming: true,
          language: 'Hindi/English'
        }),
        created_by: adminId,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        id: uuidv4(),
        title: 'Yoga and Meditation Workshop',
        slug: 'yoga-meditation-workshop-march-2024',
        description: 'Learn authentic yoga and meditation techniques from experienced teachers. Suitable for beginners and intermediate practitioners.',
        long_description: 'Join our comprehensive yoga and meditation workshop designed to introduce you to the authentic practices of Hatha Yoga and Dhyana meditation.\n\nWorkshop Highlights:\n• Fundamentals of Hatha Yoga postures\n• Breathing techniques (Pranayama)\n• Meditation practices for beginners\n• Philosophy behind yoga and its spiritual benefits\n• Practical tips for daily practice\n• Q&A sessions with experienced teachers\n\nThis workshop is perfect for those seeking to establish a regular spiritual practice or deepen their existing knowledge.',
        category: 'workshop',
        status: 'active',
        start_date: new Date('2024-03-15T09:00:00'),
        end_date: new Date('2024-03-15T17:00:00'),
        location: 'Vedic Education Center, Rishikesh',
        venue_details: JSON.stringify({
          capacity: 50,
          facilities: ['Yoga mats provided', 'Changing rooms', 'Water facility'],
          indoor: true,
          air_conditioned: true
        }),
        max_participants: 50,
        registered_participants: 0,
        registration_fee: 500.00,
        registration_start_date: new Date('2024-02-15'),
        registration_end_date: new Date('2024-03-13'),
        featured_image: 'https://example.com/images/yoga-workshop.jpg',
        images: JSON.stringify([
          'https://example.com/images/yoga-session-1.jpg',
          'https://example.com/images/meditation-hall.jpg',
          'https://example.com/images/yoga-instructor.jpg'
        ]),
        is_featured: true,
        organizer: JSON.stringify({
          name: 'Vedic Education Center',
          email: 'education@shivdhaam.org',
          phone: '+91 98765 43211'
        }),
        requirements: JSON.stringify([
          'Comfortable, stretchy clothing',
          'Empty stomach (3 hours before workshop)',
          'Open mind and willingness to learn',
          'Basic physical fitness'
        ]),
        agenda: JSON.stringify([
          { time: '09:00', activity: 'Registration and Introduction' },
          { time: '09:30', activity: 'Yoga Philosophy Overview' },
          { time: '10:30', activity: 'Basic Yoga Postures (Asanas)' },
          { time: '12:00', activity: 'Healthy Refreshments' },
          { time: '13:00', activity: 'Breathing Techniques (Pranayama)' },
          { time: '14:30', activity: 'Meditation Practices' },
          { time: '15:30', activity: 'Creating a Daily Practice' },
          { time: '16:30', activity: 'Q&A and Closing' }
        ]),
        speakers: JSON.stringify([
          {
            name: 'Guru Ramesh Patel',
            title: 'Senior Yoga Teacher',
            experience: '25 years',
            specialization: 'Hatha Yoga and Pranayama'
          },
          {
            name: 'Sister Priya',
            title: 'Meditation Guide',
            experience: '15 years',
            specialization: 'Dhyana and Mindfulness'
          }
        ]),
        certificates: true,
        tags: JSON.stringify(['yoga', 'meditation', 'workshop', 'wellness', 'spiritual', 'learning']),
        metadata: JSON.stringify({
          materials_provided: ['Yoga mats', 'Instruction booklet', 'Certificate'],
          follow_up: 'Monthly practice sessions available',
          prerequisites: 'None - suitable for beginners'
        }),
        created_by: adminId,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        id: uuidv4(),
        title: 'Medical Camp - Free Health Checkup',
        slug: 'medical-camp-free-health-checkup-march',
        description: 'Free medical checkup and consultation for pilgrims, elderly, and underprivileged community members.',
        long_description: 'Our monthly medical camp provides free healthcare services to those in need. This initiative is part of our commitment to serve humanity beyond spiritual guidance.\n\nServices Available:\n• General health checkup\n• Blood pressure and sugar testing\n• Eye examination\n• Dental consultation\n• Ayurvedic consultation\n• Free medicines for common ailments\n• Health education and awareness\n• Referral services for specialist care\n\nAll services are provided free of cost by qualified medical professionals.',
        category: 'healthcare',
        status: 'active',
        start_date: new Date('2024-03-20T08:00:00'),
        end_date: new Date('2024-03-20T16:00:00'),
        location: 'Community Health Center, Temple Complex',
        venue_details: JSON.stringify({
          capacity: 200,
          facilities: ['Medical equipment', 'Pharmacy', 'Waiting area'],
          doctors_available: 8,
          services: ['General', 'Dental', 'Eye', 'Ayurvedic']
        }),
        max_participants: 200,
        registered_participants: 0,
        registration_fee: 0.00,
        registration_start_date: new Date('2024-03-01'),
        registration_end_date: new Date('2024-03-19'),
        featured_image: 'https://example.com/images/medical-camp.jpg',
        images: JSON.stringify([
          'https://example.com/images/doctors-team.jpg',
          'https://example.com/images/health-checkup.jpg',
          'https://example.com/images/medical-facility.jpg'
        ]),
        is_featured: false,
        organizer: JSON.stringify({
          name: `${PROJECT_NAME} Medical Aid Program`,
          email: 'medical@shivdhaam.org',
          phone: '+91 98765 43212',
          coordinator: 'Dr. Rajesh Kumar'
        }),
        requirements: JSON.stringify([
          'Bring previous medical reports if any',
          'Carry identification document',
          'Wear comfortable clothing',
          'Bring a family member if elderly'
        ]),
        agenda: JSON.stringify([
          { time: '08:00', activity: 'Registration and Token Distribution' },
          { time: '08:30', activity: 'General Health Checkup Begins' },
          { time: '10:00', activity: 'Specialist Consultations Available' },
          { time: '12:00', activity: 'Free Lunch Break' },
          { time: '13:00', activity: 'Afternoon Sessions Continue' },
          { time: '15:00', activity: 'Health Education Session' },
          { time: '16:00', activity: 'Camp Concludes' }
        ]),
        speakers: JSON.stringify([
          {
            name: 'Dr. Rajesh Kumar',
            title: 'General Physician',
            qualification: 'MBBS, MD',
            experience: '20 years'
          },
          {
            name: 'Dr. Priya Singh',
            title: 'Dentist',
            qualification: 'BDS, MDS',
            experience: '15 years'
          }
        ]),
        certificates: false,
        tags: JSON.stringify(['medical', 'healthcare', 'free', 'community', 'service', 'checkup']),
        metadata: JSON.stringify({
          target_audience: ['Pilgrims', 'Elderly', 'Underprivileged', 'Local community'],
          languages: ['Hindi', 'English', 'Local dialect'],
          partnership: 'Local Government Health Department'
        }),
        created_by: adminId,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        id: uuidv4(),
        title: 'Environmental Awareness Campaign',
        slug: 'environmental-awareness-campaign-april',
        description: 'Community awareness program on environmental protection, tree plantation, and sustainable living practices.',
        long_description: 'Join our environmental awareness campaign to learn about sustainable living and contribute to protecting Mother Earth. This program combines spiritual values with environmental consciousness.\n\nProgram Includes:\n• Tree plantation drive along the river\n• Workshop on organic farming\n• Waste reduction and recycling techniques\n• Traditional eco-friendly practices\n• Community cleanup activities\n• Pledge for environmental protection\n\nTogether, we can make a difference for future generations while honoring our spiritual duty to protect nature.',
        category: 'awareness',
        status: 'active',
        start_date: new Date('2024-04-22T07:00:00'),
        end_date: new Date('2024-04-22T17:00:00'),
        location: 'River Bank and Temple Grounds',
        venue_details: JSON.stringify({
          outdoor_venue: true,
          weather_contingency: 'Indoor hall available',
          transport: 'Bus service from temple to river bank',
          safety_measures: 'First aid team available'
        }),
        max_participants: 300,
        registered_participants: 0,
        registration_fee: 0.00,
        registration_start_date: new Date('2024-04-01'),
        registration_end_date: new Date('2024-04-20'),
        featured_image: 'https://example.com/images/tree-plantation.jpg',
        images: JSON.stringify([
          'https://example.com/images/environmental-camp.jpg',
          'https://example.com/images/river-cleanup.jpg',
          'https://example.com/images/organic-farming.jpg'
        ]),
        is_featured: true,
        organizer: JSON.stringify({
          name: 'Green Initiative Committee',
          email: 'green@shivdhaam.org',
          phone: '+91 98765 43213',
          partners: ['Local Forest Department', 'Environmental NGOs']
        }),
        requirements: JSON.stringify([
          'Comfortable outdoor clothing',
          'Sun hat and water bottle',
          'Gloves for plantation (optional)',
          'Enthusiasm for environmental protection'
        ]),
        agenda: JSON.stringify([
          { time: '07:00', activity: 'Gathering and Breakfast' },
          { time: '08:00', activity: 'Opening Ceremony and Earth Prayer' },
          { time: '08:30', activity: 'Tree Plantation Drive' },
          { time: '10:30', activity: 'River Cleanup Activity' },
          { time: '12:00', activity: 'Community Lunch' },
          { time: '13:00', activity: 'Organic Farming Workshop' },
          { time: '15:00', activity: 'Sustainable Living Practices' },
          { time: '16:00', activity: 'Environmental Pledge Ceremony' },
          { time: '17:00', activity: 'Closing and Distribution of Plants' }
        ]),
        speakers: JSON.stringify([
          {
            name: 'Dr. Sunita Verma',
            title: 'Environmental Scientist',
            topic: 'Climate Change and Spiritual Responsibility',
            qualification: 'PhD Environmental Science'
          },
          {
            name: 'Shri Mohan Das',
            title: 'Organic Farmer',
            topic: 'Traditional Farming Techniques',
            experience: '30 years in organic farming'
          }
        ]),
        certificates: true,
        tags: JSON.stringify(['environment', 'tree plantation', 'awareness', 'sustainability', 'community', 'cleanup']),
        metadata: JSON.stringify({
          saplings_to_plant: 500,
          expected_cleanup_area: '2 km river stretch',
          follow_up: 'Monthly monitoring of planted trees',
          impact_measurement: 'Carbon footprint reduction tracking'
        }),
        created_by: adminId,
        created_at: new Date(),
        updated_at: new Date()
      }
    ];

    await queryInterface.bulkInsert('events', events);
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.bulkDelete('events', {
      slug: {
        [Sequelize.Op.in]: [
          'maha-shivratri-celebration-2024',
          'yoga-meditation-workshop-march-2024',
          'medical-camp-free-health-checkup-march',
          'environmental-awareness-campaign-april'
        ]
      }
    });
  }
};