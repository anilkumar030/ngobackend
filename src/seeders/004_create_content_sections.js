'use strict';

const { v4: uuidv4 } = require('uuid');

// Get project name from environment variable with fallback
const PROJECT_NAME = process.env.PROJECT_NAME || '${PROJECT_NAME}';
const PROJECT_DOMAIN = (process.env.PROJECT_DOMAIN || 'shivdhaam.org').toLowerCase();
const PROJECT_SLUG = PROJECT_NAME.toLowerCase().replace(/\s+/g, '');

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
    
    const contentSections = [
      // Homepage sections
      {
        id: uuidv4(),
        key: 'hero_section',
        slug: 'hero-section',
        page: 'home',
        section_type: 'hero',
        title: `Welcome to ${PROJECT_NAME}`,
        subtitle: 'Preserving Sacred Traditions, Building Spiritual Communities',
        content: 'Join us in our mission to preserve ancient wisdom, support spiritual growth, and serve humanity through sacred temple projects, educational initiatives, and community service.',
        images: JSON.stringify([
          {
            url: 'https://example.com/images/hero-temple.jpg',
            alt: 'Beautiful temple at sunrise',
            caption: 'Sacred temple in the Himalayas'
          }
        ]),
        button_text: 'Start Your Journey',
        button_url: '/campaigns',
        button_style: 'primary',
        settings: JSON.stringify({
          background_style: 'image',
          text_color: 'white',
          overlay_opacity: 0.4,
          animation: 'fade-in'
        }),
        sort_order: 1,
        status: 'active',
        visibility: 'public',
        created_by: adminId,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        id: uuidv4(),
        key: 'mission_statement',
        slug: 'mission-statement',
        page: 'home',
        section_type: 'text',
        title: 'Our Sacred Mission',
        subtitle: 'Bridging Ancient Wisdom with Modern Service',
        content: '<p>The ${PROJECT_NAME} is dedicated to preserving and promoting the timeless spiritual traditions of Sanatana Dharma. Through temple construction, educational programs, and community service, we create spaces where seekers can connect with divine consciousness and ancient wisdom.</p><p>Our work spans across temple restoration, spiritual education, healthcare for pilgrims, and food service for the needy. Every project is undertaken with devotion, integrity, and the highest spiritual principles.</p>',
        settings: JSON.stringify({
          text_align: 'center',
          max_width: 800,
          background_color: '#f8f9fa'
        }),
        sort_order: 2,
        status: 'active',
        visibility: 'public',
        created_by: adminId,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        id: uuidv4(),
        key: 'featured_campaigns',
        slug: 'featured-campaigns',
        page: 'home',
        section_type: 'feature',
        title: 'Support Our Sacred Causes',
        subtitle: 'Your contribution helps preserve spiritual heritage and serve humanity',
        content: 'Explore our active campaigns and choose how you would like to contribute to our sacred mission. Every donation, no matter the size, makes a meaningful difference.',
        button_text: 'View All Campaigns',
        button_url: '/campaigns',
        button_style: 'outline',
        settings: JSON.stringify({
          display_count: 3,
          layout: 'grid',
          show_progress: true,
          auto_refresh: true
        }),
        sort_order: 3,
        status: 'active',
        visibility: 'public',
        created_by: adminId,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        id: uuidv4(),
        key: 'impact_stats',
        slug: 'impact-stats',
        page: 'home',
        section_type: 'stats',
        title: 'Our Impact in Numbers',
        subtitle: 'Together, we are making a difference',
        content: 'See the tangible impact of our collective efforts in preserving spiritual heritage and serving the community.',
        settings: JSON.stringify({
          stats: [
            { number: '15+', label: 'Temples Restored', icon: 'temple' },
            { number: '50,000+', label: 'Lives Touched', icon: 'heart' },
            { number: '₹2.5 Cr+', label: 'Funds Raised', icon: 'rupee' },
            { number: '1,000+', label: 'Daily Meals Served', icon: 'food' }
          ],
          background_color: '#2d3748',
          text_color: 'white',
          counter_animation: true
        }),
        sort_order: 4,
        status: 'active',
        visibility: 'public',
        created_by: adminId,
        created_at: new Date(),
        updated_at: new Date()
      },
      
      // About page sections
      {
        id: uuidv4(),
        key: 'about_introduction',
        slug: 'about-introduction',
        page: 'about',
        section_type: 'text',
        title: `About ${PROJECT_NAME}`,
        subtitle: 'Preserving the Sacred, Serving Humanity',
        content: '<p>Founded with the divine mission to preserve and promote the eternal values of Sanatana Dharma, the ${PROJECT_NAME} stands as a beacon of spiritual service and cultural preservation.</p><p>Our foundation was established by devoted souls who recognized the urgent need to protect ancient temples, promote spiritual education, and serve humanity through various charitable activities. We believe that by preserving our sacred heritage, we create a pathway for future generations to connect with the divine.</p><p>Every project we undertake is guided by the principles of dharma, seva (service), and bhakti (devotion), ensuring that our work contributes to both material and spiritual well-being of all beings.</p>',
        images: JSON.stringify([
          {
            url: 'https://example.com/images/foundation-story.jpg',
            alt: 'Foundation establishment ceremony',
            caption: 'The blessing ceremony for our foundation'
          }
        ]),
        sort_order: 1,
        status: 'active',
        visibility: 'public',
        created_by: adminId,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        id: uuidv4(),
        key: 'our_values',
        slug: 'our-values',
        page: 'about',
        section_type: 'feature',
        title: 'Our Core Values',
        subtitle: 'The principles that guide everything we do',
        content: 'These eternal values form the foundation of our work and inspire us to serve with devotion and integrity.',
        settings: JSON.stringify({
          values: [
            {
              title: 'Dharma',
              description: 'Living and acting in accordance with universal principles of righteousness',
              icon: 'dharma-wheel'
            },
            {
              title: 'Seva',
              description: 'Selfless service to humanity without expectation of reward',
              icon: 'helping-hand'
            },
            {
              title: 'Bhakti',
              description: 'Devotional service and surrender to the divine will',
              icon: 'lotus'
            },
            {
              title: 'Ahimsa',
              description: 'Non-violence in thought, word, and deed towards all beings',
              icon: 'peace'
            }
          ],
          layout: 'grid-2x2',
          background_style: 'gradient'
        }),
        sort_order: 2,
        status: 'active',
        visibility: 'public',
        created_by: adminId,
        created_at: new Date(),
        updated_at: new Date()
      },

      // Contact page sections
      {
        id: uuidv4(),
        key: 'contact_info',
        slug: 'contact-info',
        page: 'contact',
        section_type: 'contact',
        title: 'Get in Touch',
        subtitle: 'We would love to hear from you',
        content: 'Whether you have questions about our projects, want to volunteer, or need spiritual guidance, we are here to help. Reach out to us through any of the methods below.',
        settings: JSON.stringify({
          contact_details: {
            address: `${PROJECT_NAME}\nTemple Complex, Main Road\nHaridwar, Uttarakhand 249401\nIndia`,
            phone: '+91 98765 43210',
            email: `contact@${PROJECT_DOMAIN}`,
            website: `www.${PROJECT_DOMAIN}`
          },
          office_hours: {
            weekdays: '9:00 AM - 6:00 PM',
            weekends: '10:00 AM - 4:00 PM',
            temple_hours: '5:00 AM - 9:00 PM (Daily)'
          },
          show_map: true,
          map_coordinates: { lat: 29.9457, lng: 78.1642 }
        }),
        sort_order: 1,
        status: 'active',
        visibility: 'public',
        created_by: adminId,
        created_at: new Date(),
        updated_at: new Date()
      },

      // Footer section
      {
        id: uuidv4(),
        key: 'footer_main',
        slug: 'footer-main',
        page: 'global',
        section_type: 'footer',
        title: PROJECT_NAME,
        subtitle: 'Serving humanity through spiritual dedication',
        content: 'Join us in our mission to preserve sacred traditions, support spiritual growth, and serve humanity with love and devotion.',
        links: JSON.stringify([
          { text: 'About Us', url: '/about', type: 'internal' },
          { text: 'Campaigns', url: '/campaigns', type: 'internal' },
          { text: 'Gallery', url: '/gallery', type: 'internal' },
          { text: 'Blog', url: '/blog', type: 'internal' },
          { text: 'Contact', url: '/contact', type: 'internal' },
          { text: 'Privacy Policy', url: '/privacy', type: 'internal' },
          { text: 'Terms of Service', url: '/terms', type: 'internal' }
        ]),
        settings: JSON.stringify({
          social_media: {
            facebook: `https://facebook.com/${PROJECT_SLUG}foundation`,
            twitter: `https://twitter.com/${PROJECT_SLUG}`,
            instagram: `https://instagram.com/${PROJECT_SLUG}foundation`,
            youtube: `https://youtube.com/${PROJECT_SLUG}foundation`
          },
          newsletter_signup: true,
          copyright_text: `© 2024 ${PROJECT_NAME}. All rights reserved.`,
          trust_badges: ['SSL Secure', 'Registered NGO', 'Tax Exempt']
        }),
        sort_order: 1,
        status: 'active',
        visibility: 'public',
        created_by: adminId,
        created_at: new Date(),
        updated_at: new Date()
      }
    ];

    await queryInterface.bulkInsert('content_sections', contentSections);
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.bulkDelete('content_sections', {
      key: {
        [Sequelize.Op.in]: [
          'hero_section',
          'mission_statement',
          'featured_campaigns',
          'impact_stats',
          'about_introduction',
          'our_values',
          'contact_info',
          'footer_main'
        ]
      }
    });
  }
};