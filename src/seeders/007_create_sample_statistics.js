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
    
    const statistics = [
      // Impact Statistics
      {
        id: uuidv4(),
        label: 'Temples Restored',
        key: 'temples_restored',
        value: '15',
        category: 'impact',
        icon: 'temple',
        description: 'Ancient temples reconstructed and restored to their original glory',
        display_format: 'number',
        value_suffix: '+',
        display_order: 1,
        is_active: true,
        is_featured: true,
        is_real_time: false,
        update_frequency: 'monthly',
        data_source: 'Project Management System',
        calculation_method: 'Count of completed temple restoration projects',
        target_value: '25',
        baseline_value: '5',
        color_scheme: 'primary',
        tags: JSON.stringify(['temples', 'restoration', 'heritage', 'spiritual']),
        metadata: JSON.stringify({
          includes: ['Major renovations', 'Complete reconstructions', 'Heritage preservation'],
          excludes: ['Minor repairs', 'Maintenance work'],
          measurement_criteria: 'Projects with budget > 500,000 INR'
        }),
        created_by: adminId,
        updated_by: adminId,
        created_at: new Date(),
        updated_at: new Date(),
        last_updated: new Date()
      },
      {
        id: uuidv4(),
        label: 'Lives Transformed',
        key: 'lives_transformed',
        value: '75000',
        category: 'impact',
        icon: 'heart',
        description: 'Number of people who have benefited from our various projects and services',
        display_format: 'compact',
        value_suffix: '+',
        display_order: 2,
        is_active: true,
        is_featured: true,
        is_real_time: false,
        update_frequency: 'weekly',
        data_source: 'Beneficiary Registration System',
        calculation_method: 'Unique individuals served across all projects',
        target_value: '100000',
        baseline_value: '10000',
        color_scheme: 'success',
        tags: JSON.stringify(['beneficiaries', 'impact', 'community', 'service']),
        metadata: JSON.stringify({
          includes: ['Medical aid recipients', 'Education program attendees', 'Food service beneficiaries', 'Spiritual guidance seekers'],
          tracking_method: 'Registration database with unique IDs',
          verification: 'Annual third-party audit'
        }),
        created_by: adminId,
        updated_by: adminId,
        created_at: new Date(),
        updated_at: new Date(),
        last_updated: new Date()
      },
      {
        id: uuidv4(),
        label: 'Daily Meals Served',
        key: 'daily_meals_served',
        value: '1200',
        category: 'impact',
        icon: 'food',
        description: 'Free meals provided daily through our Anna Daan (food donation) program',
        display_format: 'number',
        value_suffix: '',
        display_order: 3,
        is_active: true,
        is_featured: true,
        is_real_time: true,
        update_frequency: 'daily',
        data_source: 'Kitchen Management System',
        calculation_method: 'Average meals served per day over last 30 days',
        target_value: '1500',
        baseline_value: '500',
        color_scheme: 'warning',
        tags: JSON.stringify(['food', 'anna-daan', 'service', 'daily']),
        metadata: JSON.stringify({
          meal_types: ['Breakfast', 'Lunch', 'Dinner'],
          locations: ['Main temple complex', 'Riverside ghat', 'Community centers'],
          nutritional_standards: 'Balanced vegetarian meals as per nutritionist guidelines'
        }),
        created_by: adminId,
        updated_by: adminId,
        created_at: new Date(),
        updated_at: new Date(),
        last_updated: new Date()
      },

      // Financial Statistics
      {
        id: uuidv4(),
        label: 'Total Funds Raised',
        key: 'total_funds_raised',
        value: '25000000',
        category: 'financial',
        icon: 'rupee',
        description: 'Total amount raised through donations and campaigns since foundation inception',
        display_format: 'currency',
        value_suffix: '',
        display_order: 4,
        is_active: true,
        is_featured: true,
        is_real_time: true,
        update_frequency: 'real-time',
        data_source: 'Donation Management System',
        calculation_method: 'Sum of all successful donations',
        target_value: '50000000',
        baseline_value: '1000000',
        color_scheme: 'info',
        tags: JSON.stringify(['donations', 'fundraising', 'financial', 'campaigns']),
        metadata: JSON.stringify({
          currency: 'INR',
          includes: ['Online donations', 'Cash donations', 'Bank transfers', 'Campaign contributions'],
          transparency_report_frequency: 'Quarterly',
          audit_status: 'Annual CA audit completed'
        }),
        created_by: adminId,
        updated_by: adminId,
        created_at: new Date(),
        updated_at: new Date(),
        last_updated: new Date()
      },
      {
        id: uuidv4(),
        label: 'Active Donors',
        key: 'active_donors',
        value: '2500',
        category: 'financial',
        icon: 'users',
        description: 'Number of regular donors who have contributed in the last 12 months',
        display_format: 'number',
        value_suffix: '+',
        display_order: 5,
        is_active: true,
        is_featured: false,
        is_real_time: false,
        update_frequency: 'monthly',
        data_source: 'Donor Management System',
        calculation_method: 'Unique donors with donations in last 12 months',
        target_value: '5000',
        baseline_value: '100',
        color_scheme: 'secondary',
        tags: JSON.stringify(['donors', 'community', 'supporters', 'regular']),
        metadata: JSON.stringify({
          definition: 'Donors with at least one donation in last 12 months',
          segments: ['Monthly donors', 'Quarterly donors', 'Annual donors', 'Occasional donors'],
          retention_rate: '75%'
        }),
        created_by: adminId,
        updated_by: adminId,
        created_at: new Date(),
        updated_at: new Date(),
        last_updated: new Date()
      },

      // Project Statistics
      {
        id: uuidv4(),
        label: 'Active Projects',
        key: 'active_projects',
        value: '12',
        category: 'projects',
        icon: 'project',
        description: 'Number of projects currently in progress across all categories',
        display_format: 'number',
        value_suffix: '',
        display_order: 6,
        is_active: true,
        is_featured: false,
        is_real_time: true,
        update_frequency: 'daily',
        data_source: 'Project Management System',
        calculation_method: 'Count of projects with status = active',
        target_value: '20',
        baseline_value: '5',
        color_scheme: 'primary',
        tags: JSON.stringify(['projects', 'active', 'development', 'ongoing']),
        metadata: JSON.stringify({
          categories: ['Temple Construction', 'Community Development', 'Healthcare', 'Education', 'Infrastructure'],
          average_duration: '18 months',
          completion_rate: '95%'
        }),
        created_by: adminId,
        updated_by: adminId,
        created_at: new Date(),
        updated_at: new Date(),
        last_updated: new Date()
      },
      {
        id: uuidv4(),
        label: 'Completed Projects',
        key: 'completed_projects',
        value: '45',
        category: 'projects',
        icon: 'completed',
        description: 'Total number of successfully completed projects since foundation inception',
        display_format: 'number',
        value_suffix: '',
        display_order: 7,
        is_active: true,
        is_featured: false,
        is_real_time: false,
        update_frequency: 'monthly',
        data_source: 'Project Management System',
        calculation_method: 'Count of projects with status = completed',
        target_value: '100',
        baseline_value: '10',
        color_scheme: 'success',
        tags: JSON.stringify(['projects', 'completed', 'success', 'achievement']),
        metadata: JSON.stringify({
          success_rate: '95%',
          average_completion_time: '16 months',
          budget_adherence: '98%'
        }),
        created_by: adminId,
        updated_by: adminId,
        created_at: new Date(),
        updated_at: new Date(),
        last_updated: new Date()
      },

      // Event Statistics
      {
        id: uuidv4(),
        label: 'Annual Events Organized',
        key: 'annual_events',
        value: '24',
        category: 'events',
        icon: 'calendar',
        description: 'Number of spiritual and community events organized each year',
        display_format: 'number',
        value_suffix: '',
        display_order: 8,
        is_active: true,
        is_featured: false,
        is_real_time: false,
        update_frequency: 'monthly',
        data_source: 'Event Management System',
        calculation_method: 'Count of events organized in current calendar year',
        target_value: '36',
        baseline_value: '12',
        color_scheme: 'info',
        tags: JSON.stringify(['events', 'annual', 'community', 'spiritual']),
        metadata: JSON.stringify({
          types: ['Festivals', 'Workshops', 'Health Camps', 'Educational Programs', 'Community Service'],
          average_attendance: '350 people per event',
          satisfaction_rate: '92%'
        }),
        created_by: adminId,
        updated_by: adminId,
        created_at: new Date(),
        updated_at: new Date(),
        last_updated: new Date()
      },

      // Volunteer Statistics
      {
        id: uuidv4(),
        label: 'Active Volunteers',
        key: 'active_volunteers',
        value: '450',
        category: 'volunteers',
        icon: 'volunteer',
        description: 'Number of dedicated volunteers actively participating in our activities',
        display_format: 'number',
        value_suffix: '+',
        display_order: 9,
        is_active: true,
        is_featured: true,
        is_real_time: false,
        update_frequency: 'monthly',
        data_source: 'Volunteer Management System',
        calculation_method: 'Volunteers with activity in last 3 months',
        target_value: '750',
        baseline_value: '50',
        color_scheme: 'warning',
        tags: JSON.stringify(['volunteers', 'community', 'service', 'dedication']),
        metadata: JSON.stringify({
          categories: ['Event coordination', 'Teaching', 'Medical assistance', 'Food service', 'Maintenance'],
          average_hours_monthly: '15 hours per volunteer',
          retention_rate: '85%'
        }),
        created_by: adminId,
        updated_by: adminId,
        created_at: new Date(),
        updated_at: new Date(),
        last_updated: new Date()
      },

      // Healthcare Statistics
      {
        id: uuidv4(),
        label: 'Medical Consultations',
        key: 'medical_consultations',
        value: '5600',
        category: 'healthcare',
        icon: 'medical',
        description: 'Free medical consultations provided annually through our health camps',
        display_format: 'number',
        value_suffix: '/year',
        display_order: 10,
        is_active: true,
        is_featured: false,
        is_real_time: false,
        update_frequency: 'monthly',
        data_source: 'Medical Camp Records',
        calculation_method: 'Annual count of medical consultations provided',
        target_value: '8000',
        baseline_value: '2000',
        color_scheme: 'danger',
        tags: JSON.stringify(['medical', 'healthcare', 'consultations', 'free']),
        metadata: JSON.stringify({
          specialties: ['General medicine', 'Dental care', 'Eye care', 'Ayurveda', 'Physiotherapy'],
          camp_frequency: '4 times per month',
          doctors_involved: '15 volunteer doctors'
        }),
        created_by: adminId,
        updated_by: adminId,
        created_at: new Date(),
        updated_at: new Date(),
        last_updated: new Date()
      },

      // Education Statistics
      {
        id: uuidv4(),
        label: 'Students Educated',
        key: 'students_educated',
        value: '1200',
        category: 'education',
        icon: 'education',
        description: 'Number of students benefiting from our educational programs and scholarships',
        display_format: 'number',
        value_suffix: '',
        display_order: 11,
        is_active: true,
        is_featured: false,
        is_real_time: false,
        update_frequency: 'monthly',
        data_source: 'Education Program Database',
        calculation_method: 'Active students in all education programs',
        target_value: '2000',
        baseline_value: '200',
        color_scheme: 'info',
        tags: JSON.stringify(['education', 'students', 'learning', 'scholarships']),
        metadata: JSON.stringify({
          programs: ['Sanskrit classes', 'Computer literacy', 'Vocational training', 'Spiritual education'],
          scholarship_recipients: '300 students',
          success_rate: '88%'
        }),
        created_by: adminId,
        updated_by: adminId,
        created_at: new Date(),
        updated_at: new Date(),
        last_updated: new Date()
      },

      // Environment Statistics
      {
        id: uuidv4(),
        label: 'Trees Planted',
        key: 'trees_planted',
        value: '15000',
        category: 'environment',
        icon: 'tree',
        description: 'Trees planted through our environmental conservation initiatives',
        display_format: 'compact',
        value_suffix: '+',
        display_order: 12,
        is_active: true,
        is_featured: true,
        is_real_time: false,
        update_frequency: 'monthly',
        data_source: 'Environmental Initiative Records',
        calculation_method: 'Cumulative count of trees planted in all campaigns',
        target_value: '25000',
        baseline_value: '1000',
        color_scheme: 'success',
        tags: JSON.stringify(['environment', 'trees', 'conservation', 'green']),
        metadata: JSON.stringify({
          species: ['Neem', 'Banyan', 'Peepal', 'Mango', 'Teak'],
          survival_rate: '82%',
          carbon_offset: '500 tons CO2/year',
          locations: ['Temple grounds', 'Riverbank', 'Community areas']
        }),
        created_by: adminId,
        updated_by: adminId,
        created_at: new Date(),
        updated_at: new Date(),
        last_updated: new Date()
      }
    ];

    await queryInterface.bulkInsert('statistics', statistics);
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.bulkDelete('statistics', {
      key: {
        [Sequelize.Op.in]: [
          'temples_restored',
          'lives_transformed',
          'daily_meals_served',
          'total_funds_raised',
          'active_donors',
          'active_projects',
          'completed_projects',
          'annual_events',
          'active_volunteers',
          'medical_consultations',
          'students_educated',
          'trees_planted'
        ]
      }
    });
  }
};