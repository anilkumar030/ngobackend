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
    
    const projects = [
      {
        id: uuidv4(),
        title: 'Ganga Water Purification System',
        slug: 'ganga-water-purification-system',
        description: 'Advanced water purification system to provide clean drinking water from the sacred Ganga river to local communities and pilgrims.',
        long_description: 'The Ganga Water Purification System project aims to provide clean, safe drinking water to thousands of pilgrims and local residents while respecting the sacred nature of the holy river.\n\nProject Objectives:\n• Install state-of-the-art water purification technology\n• Provide safe drinking water to 10,000+ people daily\n• Maintain the spiritual sanctity of Ganga water\n• Create sustainable water distribution network\n• Train local staff for maintenance and operations\n\nThe system will use advanced filtration and UV sterilization technology to ensure the water meets all health standards while preserving its spiritual essence.',
        category: 'Water Projects',
        status: 'active',
        priority: 'high',
        location: 'Rishikesh, Uttarakhand',
        geographic_scope: 'district',
        start_date: new Date('2024-02-01'),
        estimated_completion_date: new Date('2024-08-31'),
        actual_completion_date: null,
        total_budget: 2500000.00,
        amount_spent: 875000.00,
        funding_sources: JSON.stringify([
          { source: 'Government Grant', amount: 1000000, status: 'approved' },
          { source: 'Private Donations', amount: 1500000, status: 'ongoing' }
        ]),
        beneficiaries_count: 10000,
        progress_percentage: 35.00,
        implementation_strategy: JSON.stringify({
          phases: [
            'Site preparation and permissions',
            'Equipment procurement and installation',
            'Testing and quality assurance',
            'Staff training and operations setup',
            'Community outreach and launch'
          ],
          methodology: 'Phased implementation with community involvement',
          timeline: {
            'Phase 1': 'Feb-Mar 2024',
            'Phase 2': 'Apr-May 2024',
            'Phase 3': 'Jun-Jul 2024',
            'Phase 4': 'Aug 2024',
            'Phase 5': 'Aug-Sep 2024'
          },
          resources: ['Technical team', 'Local contractors', 'Community volunteers']
        }),
        impact_metrics: JSON.stringify({
          daily_water_production: '50000 liters',
          people_served_monthly: 10000,
          reduction_in_waterborne_diseases: '60%',
          carbon_footprint_reduction: '15 tons CO2/year'
        }),
        stakeholders: JSON.stringify([
          { name: 'Local Municipal Corporation', role: 'Permits and Approvals', contact: 'municipal@rishikesh.gov.in' },
          { name: 'Uttarakhand Pollution Control Board', role: 'Environmental Clearance', contact: 'pcb@uk.gov.in' },
          { name: 'Community Representatives', role: 'Local Coordination', contact: '+91 98765 43220' },
          { name: 'Technical Partners', role: 'Equipment Supply and Installation', contact: 'tech@waterpure.com' }
        ]),
        risks_and_mitigation: JSON.stringify([
          { risk: 'Seasonal water level variations', mitigation: 'Multiple intake points at different levels', probability: 'medium' },
          { risk: 'Equipment failure', mitigation: 'Redundant systems and regular maintenance', probability: 'low' },
          { risk: 'Community acceptance', mitigation: 'Extensive outreach and education programs', probability: 'low' }
        ]),
        sustainability_plan: 'The project includes training local technicians for maintenance, establishing a community management committee, and creating a revenue model through nominal service fees for non-pilgrim users to ensure long-term sustainability.',
        featured_image: 'https://example.com/images/water-purification-system.jpg',
        images: JSON.stringify([
          'https://example.com/images/water-project-site.jpg',
          'https://example.com/images/purification-equipment.jpg',
          'https://example.com/images/community-meeting.jpg',
          'https://example.com/images/water-testing.jpg'
        ]),
        documents: JSON.stringify([
          { name: 'Project Proposal', url: 'https://example.com/docs/water-project-proposal.pdf', type: 'pdf' },
          { name: 'Environmental Impact Assessment', url: 'https://example.com/docs/eia-report.pdf', type: 'pdf' },
          { name: 'Technical Specifications', url: 'https://example.com/docs/tech-specs.pdf', type: 'pdf' }
        ]),
        is_featured: true,
        is_public: true,
        tags: JSON.stringify(['water', 'purification', 'ganga', 'technology', 'health', 'community']),
        metadata: JSON.stringify({
          certifications_required: ['ISO 9001', 'WHO Standards', 'BIS Certification'],
          technology_partner: 'AquaTech Solutions Pvt. Ltd.',
          monitoring_frequency: 'Daily quality checks',
          community_involvement: 'High - local committee formed'
        }),
        created_by: adminId,
        managed_by: adminId,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        id: uuidv4(),
        title: 'Pilgrim Rest House Construction',
        slug: 'pilgrim-rest-house-construction',
        description: 'Construction of modern rest house facility with 100 rooms to provide affordable accommodation for pilgrims visiting our temples.',
        long_description: 'The Pilgrim Rest House project addresses the critical need for clean, affordable accommodation for devotees visiting our temple complex. Many pilgrims travel from far distances and need safe, comfortable lodging.\n\nProject Features:\n• 100 well-ventilated rooms with attached bathrooms\n• Central dining hall for community meals\n• Prayer and meditation areas\n• Garden spaces for peaceful contemplation\n• Modern amenities while maintaining traditional architecture\n• Solar power system for sustainable energy\n• Rainwater harvesting system\n\nThis facility will serve thousands of pilgrims annually and generate sustainable revenue for temple maintenance.',
        category: 'Housing',
        status: 'active',
        priority: 'medium',
        location: 'Haridwar, Uttarakhand',
        geographic_scope: 'state',
        start_date: new Date('2024-01-15'),
        estimated_completion_date: new Date('2025-06-30'),
        actual_completion_date: null,
        total_budget: 8500000.00,
        amount_spent: 2125000.00,
        funding_sources: JSON.stringify([
          { source: 'Temple Funds', amount: 3500000, status: 'allocated' },
          { source: 'Donor Contributions', amount: 5000000, status: 'fundraising' }
        ]),
        beneficiaries_count: 15000,
        progress_percentage: 25.00,
        implementation_strategy: JSON.stringify({
          phases: [
            'Architectural design and approvals',
            'Foundation and structural work',
            'Electrical and plumbing installation',
            'Interior finishing and furnishing',
            'Landscaping and final touches'
          ],
          methodology: 'Traditional construction with modern amenities',
          timeline: {
            'Design Phase': 'Jan-Feb 2024',
            'Foundation': 'Mar-May 2024',
            'Structure': 'Jun-Dec 2024',
            'Interiors': 'Jan-Apr 2025',
            'Completion': 'May-Jun 2025'
          },
          resources: ['Architect team', 'Construction contractors', 'Local craftsmen']
        }),
        impact_metrics: JSON.stringify({
          rooms_available: 100,
          annual_pilgrim_capacity: 15000,
          revenue_generation: '2000000 INR/year',
          employment_created: 25
        }),
        stakeholders: JSON.stringify([
          { name: 'Haridwar Development Authority', role: 'Building Permissions', contact: 'hda@haridwar.gov.in' },
          { name: 'Local Contractors Association', role: 'Construction Work', contact: '+91 98765 43221' },
          { name: 'Pilgrim Welfare Committee', role: 'User Requirements', contact: 'pilgrim@shivdhaam.org' }
        ]),
        risks_and_mitigation: JSON.stringify([
          { risk: 'Construction delays due to weather', mitigation: 'Weather contingency planning', probability: 'medium' },
          { risk: 'Cost overruns', mitigation: 'Fixed-price contracts and regular monitoring', probability: 'medium' },
          { risk: 'Quality issues', mitigation: 'Regular quality inspections and supervision', probability: 'low' }
        ]),
        sustainability_plan: 'Revenue from room bookings will support ongoing maintenance. Local staff will be trained for housekeeping and management. Solar power and rainwater harvesting will reduce operational costs.',
        featured_image: 'https://example.com/images/rest-house-design.jpg',
        images: JSON.stringify([
          'https://example.com/images/construction-site.jpg',
          'https://example.com/images/architectural-plan.jpg',
          'https://example.com/images/room-design.jpg',
          'https://example.com/images/dining-hall-plan.jpg'
        ]),
        documents: JSON.stringify([
          { name: 'Architectural Plans', url: 'https://example.com/docs/architectural-plans.pdf', type: 'pdf' },
          { name: 'Building Permits', url: 'https://example.com/docs/building-permits.pdf', type: 'pdf' },
          { name: 'Contractor Agreements', url: 'https://example.com/docs/contractor-agreements.pdf', type: 'pdf' }
        ]),
        is_featured: true,
        is_public: true,
        tags: JSON.stringify(['housing', 'pilgrims', 'accommodation', 'construction', 'tourism', 'facility']),
        metadata: JSON.stringify({
          building_type: 'G+2 Structure',
          total_area: '25000 sq ft',
          green_building_features: ['Solar panels', 'Rainwater harvesting', 'Energy-efficient lighting'],
          accessibility_features: ['Ramps', 'Wheelchair accessible rooms', 'Braille signage']
        }),
        created_by: adminId,
        managed_by: adminId,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        id: uuidv4(),
        title: 'Emergency Medical Response Unit',
        slug: 'emergency-medical-response-unit',
        description: 'Establishment of 24/7 emergency medical response unit with ambulance services for pilgrims and local community during festivals and regular times.',
        long_description: 'During large religious gatherings and festivals, medical emergencies are common due to crowd density, weather conditions, and the physical demands of pilgrimage. Our Emergency Medical Response Unit will provide immediate medical assistance.\n\nProject Components:\n• Fully equipped ambulance with life support systems\n• Mobile medical unit for on-site treatment\n• 24/7 emergency response team\n• Communication system for quick response\n• First aid training for local volunteers\n• Coordination with nearby hospitals\n• Medicine stock for common ailments\n\nThis unit will significantly reduce response time and potentially save lives during critical situations.',
        category: 'Healthcare',
        status: 'upcoming',
        priority: 'critical',
        location: 'Haridwar and Rishikesh Circuit',
        geographic_scope: 'local',
        start_date: new Date('2024-04-01'),
        estimated_completion_date: new Date('2024-07-31'),
        actual_completion_date: null,
        total_budget: 1500000.00,
        amount_spent: 0.00,
        funding_sources: JSON.stringify([
          { source: 'Medical Aid Fund', amount: 800000, status: 'approved' },
          { source: 'Emergency Donors', amount: 700000, status: 'pending' }
        ]),
        beneficiaries_count: 50000,
        progress_percentage: 5.00,
        implementation_strategy: JSON.stringify({
          phases: [
            'Equipment procurement and customization',
            'Staff recruitment and training',
            'Communication system setup',
            'Trial operations and testing',
            'Full deployment and launch'
          ],
          methodology: 'Rapid deployment with phased rollout',
          timeline: {
            'Procurement': 'Apr 2024',
            'Setup': 'May 2024',
            'Training': 'Jun 2024',
            'Testing': 'Jul 2024',
            'Launch': 'Aug 2024'
          },
          resources: ['Medical equipment suppliers', 'Trained paramedics', 'Communication specialists']
        }),
        impact_metrics: JSON.stringify({
          response_time_target: '5 minutes in temple complex',
          expected_emergencies_handled: '500 per year',
          lives_potentially_saved: '50+ per year',
          volunteers_trained: 100
        }),
        stakeholders: JSON.stringify([
          { name: 'District Hospital Haridwar', role: 'Medical Backup and Coordination', contact: 'hospital@haridwar.gov.in' },
          { name: 'Local Police', role: 'Traffic Clearance for Emergency', contact: 'police@haridwar.gov.in' },
          { name: 'Red Cross Society', role: 'Training and Volunteers', contact: 'redcross@uttarakhand.org' }
        ]),
        risks_and_mitigation: JSON.stringify([
          { risk: 'Equipment malfunction during emergencies', mitigation: 'Regular maintenance and backup equipment', probability: 'low' },
          { risk: 'Staff unavailability', mitigation: 'Multiple trained teams and on-call system', probability: 'medium' },
          { risk: 'Traffic congestion affecting response time', mitigation: 'Coordination with traffic police', probability: 'medium' }
        ]),
        sustainability_plan: 'Partnership with local hospitals for staff training and equipment maintenance. Community donations and nominal fees from non-emergency medical services will support operations.',
        featured_image: 'https://example.com/images/emergency-ambulance.jpg',
        images: JSON.stringify([
          'https://example.com/images/medical-equipment.jpg',
          'https://example.com/images/emergency-training.jpg',
          'https://example.com/images/response-team.jpg'
        ]),
        documents: JSON.stringify([
          { name: 'Medical Equipment Specifications', url: 'https://example.com/docs/medical-specs.pdf', type: 'pdf' },
          { name: 'Partnership MOU with Hospitals', url: 'https://example.com/docs/hospital-mou.pdf', type: 'pdf' }
        ]),
        is_featured: false,
        is_public: true,
        tags: JSON.stringify(['emergency', 'medical', 'ambulance', 'healthcare', 'response', 'safety']),
        metadata: JSON.stringify({
          ambulance_type: 'Advanced Life Support (ALS)',
          coverage_area: '20 km radius',
          staff_requirements: '6 paramedics, 2 drivers, 1 coordinator',
          equipment_list: ['Defibrillator', 'Oxygen support', 'Emergency medicines', 'Stretcher', 'First aid kit']
        }),
        created_by: adminId,
        managed_by: adminId,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        id: uuidv4(),
        title: 'Digital Library and Archive Project',
        slug: 'digital-library-archive-project',
        description: 'Digitization of ancient manuscripts, creation of digital library, and online access to spiritual texts and temple archives for global devotees.',
        long_description: 'Preserving ancient spiritual texts and making them accessible to devotees worldwide is crucial for continuing our spiritual heritage. This project will digitize rare manuscripts and create a comprehensive online library.\n\nProject Scope:\n• Digitization of 10,000+ manuscripts and texts\n• Creation of searchable online database\n• Multi-language support (Sanskrit, Hindi, English)\n• Audio recordings of chants and prayers\n• Virtual museum of temple artifacts\n• Educational mobile application\n• Global accessibility through cloud hosting\n\nThis digital archive will serve researchers, students, and devotees globally while preserving precious texts for future generations.',
        category: 'Education',
        status: 'active',
        priority: 'medium',
        location: 'Multiple Temple Libraries',
        geographic_scope: 'international',
        start_date: new Date('2024-03-01'),
        estimated_completion_date: new Date('2025-12-31'),
        actual_completion_date: null,
        total_budget: 3200000.00,
        amount_spent: 480000.00,
        funding_sources: JSON.stringify([
          { source: 'Technology Grants', amount: 1500000, status: 'approved' },
          { source: 'Cultural Preservation Fund', amount: 1000000, status: 'approved' },
          { source: 'International Donors', amount: 700000, status: 'ongoing' }
        ]),
        beneficiaries_count: 100000,
        progress_percentage: 15.00,
        implementation_strategy: JSON.stringify({
          phases: [
            'Technology infrastructure setup',
            'Manuscript cataloging and assessment',
            'High-resolution scanning and digitization',
            'Text recognition and metadata creation',
            'Platform development and testing',
            'Launch and user training'
          ],
          methodology: 'Systematic digitization with quality control',
          timeline: {
            'Infrastructure': 'Mar-May 2024',
            'Cataloging': 'Jun-Aug 2024',
            'Digitization': 'Sep 2024-Jun 2025',
            'Platform Development': 'Jan-Sep 2025',
            'Testing': 'Oct-Nov 2025',
            'Launch': 'Dec 2025'
          },
          resources: ['IT specialists', 'Sanskrit scholars', 'Digital archivists', 'Software developers']
        }),
        impact_metrics: JSON.stringify({
          manuscripts_digitized: 10000,
          global_users_expected: 100000,
          languages_supported: 5,
          mobile_app_downloads: 50000
        }),
        stakeholders: JSON.stringify([
          { name: 'Sanskrit Universities', role: 'Academic Partnership', contact: 'sanskrit@university.edu' },
          { name: 'Digital India Initiative', role: 'Technical Support', contact: 'digital@india.gov.in' },
          { name: 'International Sanskrit Association', role: 'Global Outreach', contact: 'isa@sanskrit.org' }
        ]),
        risks_and_mitigation: JSON.stringify([
          { risk: 'Manuscript damage during handling', mitigation: 'Professional conservation and careful handling protocols', probability: 'low' },
          { risk: 'Technology obsolescence', mitigation: 'Use of standard formats and regular platform updates', probability: 'medium' },
          { risk: 'Copyright and intellectual property issues', mitigation: 'Clear ownership documentation and legal review', probability: 'low' }
        ]),
        sustainability_plan: 'Revenue from premium subscriptions and institutional licenses will support ongoing maintenance. Partnerships with universities will provide academic oversight and content updates.',
        featured_image: 'https://example.com/images/digital-library.jpg',
        images: JSON.stringify([
          'https://example.com/images/ancient-manuscripts.jpg',
          'https://example.com/images/scanning-equipment.jpg',
          'https://example.com/images/digital-interface.jpg'
        ]),
        documents: JSON.stringify([
          { name: 'Technology Architecture', url: 'https://example.com/docs/tech-architecture.pdf', type: 'pdf' },
          { name: 'Conservation Guidelines', url: 'https://example.com/docs/conservation-guide.pdf', type: 'pdf' }
        ]),
        is_featured: true,
        is_public: true,
        tags: JSON.stringify(['digital', 'library', 'manuscripts', 'education', 'technology', 'preservation']),
        metadata: JSON.stringify({
          scanning_resolution: '600 DPI minimum',
          storage_capacity: '10 TB cloud storage',
          security_features: ['User authentication', 'Digital watermarks', 'Access logging'],
          accessibility_features: ['Screen reader support', 'Text-to-speech', 'Multiple font sizes']
        }),
        created_by: adminId,
        managed_by: adminId,
        created_at: new Date(),
        updated_at: new Date()
      }
    ];

    await queryInterface.bulkInsert('projects', projects);
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.bulkDelete('projects', {
      slug: {
        [Sequelize.Op.in]: [
          'ganga-water-purification-system',
          'pilgrim-rest-house-construction',
          'emergency-medical-response-unit',
          'digital-library-archive-project'
        ]
      }
    });
  }
};