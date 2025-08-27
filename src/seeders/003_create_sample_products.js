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
    
    const products = [
      {
        id: uuidv4(),
        name: 'Rudraksha Mala (108 Beads)',
        slug: 'rudraksha-mala-108-beads',
        description: 'Authentic 5-face Rudraksha mala with 108 beads, perfect for meditation and spiritual practices. Each bead is carefully selected and energized through special rituals.',
        short_description: 'Authentic 5-face Rudraksha mala with 108 beads for meditation and spiritual practices.',
        regular_price: 1299.00,
        sale_price: 999.00,
        cost_price: 600.00,
        sku: 'RUD-MALA-108',
        category: 'spiritual_accessories',
        subcategory: 'malas',
        tags: JSON.stringify(['rudraksha', 'mala', 'meditation', 'spiritual', '108', 'authentic']),
        images: JSON.stringify([
          'https://example.com/images/rudraksha-mala-1.jpg',
          'https://example.com/images/rudraksha-mala-2.jpg',
          'https://example.com/images/rudraksha-mala-detail.jpg'
        ]),
        features: JSON.stringify([
          'Authentic 5-face Rudraksha beads',
          '108 beads for complete japa',
          'Energized through sacred rituals',
          'Natural brown color',
          'Comes with authenticity certificate',
          'Includes storage pouch'
        ]),
        specifications: JSON.stringify({
          'Bead Type': '5-face Rudraksha',
          'Number of Beads': 108,
          'Bead Size': '6-7mm',
          'Thread Type': 'Cotton',
          'Origin': 'Nepal',
          'Weight': '25-30 grams'
        }),
        inventory_quantity: 50,
        low_stock_threshold: 10,
        track_inventory: true,
        show_quantity: false,
        weight: 0.030,
        dimensions: JSON.stringify({ length: 80, width: 5, height: 5 }),
        status: 'active',
        featured: true,
        digital: false,
        virtual: false,
        downloadable: false,
        shipping_required: true,
        tax_class: 'standard',
        total_sales: 45,
        total_rating: 235,
        total_reviews: 47,
        seo_title: 'Authentic Rudraksha Mala 108 Beads - Buy Online | ${PROJECT_NAME}',
        seo_description: 'Buy authentic 5-face Rudraksha mala with 108 beads. Perfect for meditation, japa, and spiritual practices. Energized and certified. Free shipping available.',
        seo_keywords: JSON.stringify(['rudraksha mala', '108 beads', 'meditation mala', 'spiritual accessories', 'authentic rudraksha']),
        metadata: JSON.stringify({
          'care_instructions': 'Keep away from moisture, clean with dry cloth',
          'energization_date': '2024-01-15',
          'authenticity_verified': true
        }),
        created_by: adminId,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        id: uuidv4(),
        name: 'Shiva Linga Crystal Statue (Small)',
        slug: 'shiva-linga-crystal-statue-small',
        description: 'Beautiful crystal Shiva Linga carved from pure quartz crystal. Perfect for home puja and meditation. Brings positive energy and spiritual vibrations to your space.',
        short_description: 'Pure quartz crystal Shiva Linga for home puja and meditation.',
        regular_price: 899.00,
        sale_price: null,
        cost_price: 450.00,
        sku: 'SL-CRYSTAL-S',
        category: 'statues',
        subcategory: 'shiva_lingas',
        tags: JSON.stringify(['shiva linga', 'crystal', 'quartz', 'statue', 'puja', 'meditation']),
        images: JSON.stringify([
          'https://example.com/images/crystal-linga-1.jpg',
          'https://example.com/images/crystal-linga-2.jpg',
          'https://example.com/images/crystal-linga-glow.jpg'
        ]),
        features: JSON.stringify([
          'Pure quartz crystal material',
          'Hand-carved by skilled artisans',
          'Natural healing properties',
          'Perfect size for home altar',
          'Amplifies positive energy',
          'Easy to clean and maintain'
        ]),
        specifications: JSON.stringify({
          'Material': 'Pure Quartz Crystal',
          'Height': '3 inches',
          'Diameter': '2 inches',
          'Weight': '200-250 grams',
          'Finish': 'Polished',
          'Origin': 'India'
        }),
        inventory_quantity: 25,
        low_stock_threshold: 5,
        track_inventory: true,
        show_quantity: false,
        weight: 0.225,
        dimensions: JSON.stringify({ length: 5.08, width: 5.08, height: 7.62 }),
        status: 'active',
        featured: true,
        digital: false,
        virtual: false,
        downloadable: false,
        shipping_required: true,
        tax_class: 'standard',
        total_sales: 23,
        total_rating: 112,
        total_reviews: 23,
        seo_title: 'Crystal Shiva Linga Statue Small Size - Pure Quartz | ${PROJECT_NAME}',
        seo_description: 'Beautiful crystal Shiva Linga made from pure quartz. Perfect for home puja, meditation, and positive energy. Hand-carved by skilled artisans.',
        seo_keywords: JSON.stringify(['crystal shiva linga', 'quartz linga', 'home puja', 'meditation statue']),
        metadata: JSON.stringify({
          'chakra_alignment': 'All chakras',
          'planetary_influence': 'Moon',
          'best_placement': 'East or North direction'
        }),
        created_by: adminId,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        id: uuidv4(),
        name: 'Spiritual Books Set - Vedic Wisdom Collection',
        slug: 'spiritual-books-vedic-wisdom-collection',
        description: 'Complete collection of 5 essential spiritual books including Bhagavad Gita, Yoga Sutras, and Upanishads. Perfect for spiritual seekers and students of Vedic philosophy.',
        short_description: 'Collection of 5 essential spiritual books including Bhagavad Gita and Upanishads.',
        regular_price: 1499.00,
        sale_price: 1199.00,
        cost_price: 750.00,
        sku: 'BOOKS-VED-SET',
        category: 'books',
        subcategory: 'spiritual_literature',
        tags: JSON.stringify(['books', 'bhagavad gita', 'upanishads', 'yoga sutras', 'vedic', 'spiritual']),
        images: JSON.stringify([
          'https://example.com/images/book-collection-1.jpg',
          'https://example.com/images/individual-books.jpg',
          'https://example.com/images/book-contents.jpg'
        ]),
        features: JSON.stringify([
          'Set of 5 sacred texts',
          'English translation with Sanskrit',
          'Commentary by renowned scholars',
          'High-quality paper and binding',
          'Beautiful cover designs',
          'Perfect for gifting'
        ]),
        specifications: JSON.stringify({
          'Books Included': '5 books',
          'Language': 'English with Sanskrit',
          'Total Pages': '2000+',
          'Binding': 'Hardcover',
          'Publisher': 'Sacred Texts Publications',
          'Edition': 'Deluxe Edition'
        }),
        inventory_quantity: 40,
        low_stock_threshold: 8,
        track_inventory: true,
        show_quantity: true,
        weight: 2.5,
        dimensions: JSON.stringify({ length: 25, width: 18, height: 12 }),
        status: 'active',
        featured: false,
        digital: false,
        virtual: false,
        downloadable: false,
        shipping_required: true,
        tax_class: 'standard',
        total_sales: 67,
        total_rating: 325,
        total_reviews: 65,
        seo_title: 'Vedic Wisdom Book Collection - Bhagavad Gita & Upanishads Set',
        seo_description: 'Complete spiritual book collection with Bhagavad Gita, Upanishads, and Yoga Sutras. English translation with Sanskrit. Perfect for spiritual study.',
        seo_keywords: JSON.stringify(['vedic books', 'bhagavad gita', 'upanishads', 'spiritual books', 'yoga sutras']),
        metadata: JSON.stringify({
          'reading_level': 'Intermediate',
          'includes_commentary': true,
          'gift_wrapping_available': true
        }),
        created_by: adminId,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        id: uuidv4(),
        name: 'Sacred Incense Sticks - Temple Blend (Pack of 12)',
        slug: 'sacred-incense-sticks-temple-blend',
        description: 'Premium quality incense sticks made from natural ingredients. Temple blend fragrance perfect for daily puja, meditation, and creating sacred atmosphere.',
        short_description: 'Premium temple blend incense sticks made from natural ingredients.',
        regular_price: 299.00,
        sale_price: 249.00,
        cost_price: 120.00,
        sku: 'INC-TEMPLE-12',
        category: 'puja_items',
        subcategory: 'incense',
        tags: JSON.stringify(['incense', 'agarbatti', 'temple', 'puja', 'meditation', 'natural']),
        images: JSON.stringify([
          'https://example.com/images/incense-pack-1.jpg',
          'https://example.com/images/incense-burning.jpg',
          'https://example.com/images/incense-ingredients.jpg'
        ]),
        features: JSON.stringify([
          '100% natural ingredients',
          'Long-lasting fragrance',
          '12 packs (20 sticks each)',
          'Smokeless burning',
          'Traditional temple blend',
          'Handrolled by artisans'
        ]),
        specifications: JSON.stringify({
          'Quantity': '12 packs of 20 sticks',
          'Burn Time': '45-60 minutes per stick',
          'Ingredients': 'Natural herbs and oils',
          'Length': '8 inches',
          'Fragrance': 'Temple Blend',
          'Origin': 'Mysore, India'
        }),
        inventory_quantity: 100,
        low_stock_threshold: 20,
        track_inventory: true,
        show_quantity: true,
        weight: 0.6,
        dimensions: JSON.stringify({ length: 25, width: 20, height: 5 }),
        status: 'active',
        featured: false,
        digital: false,
        virtual: false,
        downloadable: false,
        shipping_required: true,
        tax_class: 'standard',
        total_sales: 156,
        total_rating: 780,
        total_reviews: 156,
        seo_title: 'Sacred Temple Incense Sticks - Natural Agarbatti Pack of 12',
        seo_description: 'Premium temple blend incense sticks made from natural ingredients. Perfect for puja, meditation, and spiritual practices. Long-lasting fragrance.',
        seo_keywords: JSON.stringify(['temple incense', 'agarbatti', 'natural incense', 'puja items', 'meditation']),
        metadata: JSON.stringify({
          'burn_cleanly': true,
          'suitable_for_daily_use': true,
          'eco_friendly': true
        }),
        created_by: adminId,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        id: uuidv4(),
        name: 'Yoga Mat - Premium Cork Material',
        slug: 'yoga-mat-premium-cork-material',
        description: 'Eco-friendly yoga mat made from premium cork and natural rubber. Non-slip surface perfect for all yoga practices. Antimicrobial and sustainable material.',
        short_description: 'Eco-friendly cork yoga mat with natural rubber base. Non-slip and antimicrobial.',
        regular_price: 2999.00,
        sale_price: 2499.00,
        cost_price: 1500.00,
        sku: 'YOGA-CORK-MAT',
        category: 'yoga_accessories',
        subcategory: 'yoga_mats',
        tags: JSON.stringify(['yoga mat', 'cork', 'eco-friendly', 'non-slip', 'natural rubber', 'premium']),
        images: JSON.stringify([
          'https://example.com/images/cork-yoga-mat-1.jpg',
          'https://example.com/images/yoga-mat-texture.jpg',
          'https://example.com/images/yoga-mat-in-use.jpg'
        ]),
        features: JSON.stringify([
          'Premium Portuguese cork surface',
          'Natural rubber base for stability',
          'Non-slip even when wet',
          'Antimicrobial properties',
          '100% biodegradable materials',
          'Includes carrying strap'
        ]),
        specifications: JSON.stringify({
          'Material': 'Cork top, Natural rubber base',
          'Size': '72" x 24" (183cm x 61cm)',
          'Thickness': '6mm',
          'Weight': '2.2 kg',
          'Texture': 'Natural cork grain',
          'Durability': 'Heavy-duty use'
        }),
        inventory_quantity: 30,
        low_stock_threshold: 5,
        track_inventory: true,
        show_quantity: false,
        weight: 2.2,
        dimensions: JSON.stringify({ length: 183, width: 61, height: 0.6 }),
        status: 'active',
        featured: true,
        digital: false,
        virtual: false,
        downloadable: false,
        shipping_required: true,
        tax_class: 'standard',
        total_sales: 34,
        total_rating: 165,
        total_reviews: 34,
        seo_title: 'Premium Cork Yoga Mat - Eco-Friendly Non-Slip | ${PROJECT_NAME}',
        seo_description: 'Premium eco-friendly yoga mat made from Portuguese cork and natural rubber. Non-slip, antimicrobial, and perfect for all yoga practices.',
        seo_keywords: JSON.stringify(['cork yoga mat', 'eco-friendly yoga mat', 'non-slip yoga mat', 'premium yoga accessories']),
        metadata: JSON.stringify({
          'eco_certifications': ['FSC Certified', 'OEKO-TEX'],
          'suitable_for': 'All yoga styles',
          'care_instructions': 'Wipe with damp cloth'
        }),
        created_by: adminId,
        created_at: new Date(),
        updated_at: new Date()
      }
    ];

    await queryInterface.bulkInsert('products', products);
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.bulkDelete('products', {
      sku: {
        [Sequelize.Op.in]: [
          'RUD-MALA-108',
          'SL-CRYSTAL-S',
          'BOOKS-VED-SET',
          'INC-TEMPLE-12',
          'YOGA-CORK-MAT'
        ]
      }
    });
  }
};