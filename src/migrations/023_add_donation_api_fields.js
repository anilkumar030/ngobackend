'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Add new fields required for donation API without authentication
    await queryInterface.addColumn('donations', 'donation_amount', {
      type: Sequelize.INTEGER,
      allowNull: true, // Initially nullable for existing records
      comment: 'Base donation amount in paise'
    });

    await queryInterface.addColumn('donations', 'tip_amount', {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 0,
      comment: 'Tip amount in paise'
    });

    await queryInterface.addColumn('donations', 'total_amount', {
      type: Sequelize.INTEGER,
      allowNull: true, // Initially nullable for existing records
      comment: 'Total amount (donation + tip) in paise'
    });

    await queryInterface.addColumn('donations', 'donation_towards', {
      type: Sequelize.STRING(255),
      allowNull: true, // Initially nullable for existing records
      comment: 'What the donation is for (e.g., "Sadhu Welfare Seva")'
    });

    await queryInterface.addColumn('donations', 'donor_pan', {
      type: Sequelize.STRING(10),
      allowNull: true,
      comment: 'PAN number for 80G tax certificate'
    });

    await queryInterface.addColumn('donations', 'donor_address', {
      type: Sequelize.TEXT,
      allowNull: true,
      comment: 'Donor address for 80G certificate and receipts'
    });

    await queryInterface.addColumn('donations', 'show_name_publicly', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      comment: 'Whether to display donor name publicly on campaign'
    });

    await queryInterface.addColumn('donations', 'receive_whatsapp_updates', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      comment: 'Whether to receive WhatsApp notifications and updates'
    });

    await queryInterface.addColumn('donations', 'razorpay_order_id', {
      type: Sequelize.STRING(255),
      allowNull: true,
      comment: 'Razorpay order ID'
    });

    await queryInterface.addColumn('donations', 'razorpay_payment_id', {
      type: Sequelize.STRING(255),
      allowNull: true,
      comment: 'Razorpay payment ID (after payment)'
    });

    // Add indexes for new fields
    await queryInterface.addIndex('donations', ['razorpay_order_id'], {
      name: 'donations_razorpay_order_id_idx'
    });

    await queryInterface.addIndex('donations', ['razorpay_payment_id'], {
      name: 'donations_razorpay_payment_id_idx'
    });

    await queryInterface.addIndex('donations', ['donor_phone'], {
      name: 'donations_donor_phone_idx'
    });

    await queryInterface.addIndex('donations', ['donation_towards'], {
      name: 'donations_donation_towards_idx'
    });

    await queryInterface.addIndex('donations', ['show_name_publicly'], {
      name: 'donations_show_name_publicly_idx'
    });

    await queryInterface.addIndex('donations', ['receive_whatsapp_updates'], {
      name: 'donations_receive_whatsapp_updates_idx'
    });

    // Migrate existing data
    // Update existing donations to have proper amount values in paise
    await queryInterface.sequelize.query(`
      UPDATE donations 
      SET 
        donation_amount = CAST(amount * 100 AS INTEGER),
        total_amount = CAST(amount * 100 AS INTEGER),
        donation_towards = COALESCE(donation_towards, 'General Donation'),
        razorpay_order_id = payment_gateway_order_id,
        razorpay_payment_id = payment_gateway_payment_id
      WHERE donation_amount IS NULL;
    `);

    // Now make donation_amount and total_amount NOT NULL after migrating data
    await queryInterface.changeColumn('donations', 'donation_amount', {
      type: Sequelize.INTEGER,
      allowNull: false,
      comment: 'Base donation amount in paise'
    });

    await queryInterface.changeColumn('donations', 'total_amount', {
      type: Sequelize.INTEGER,
      allowNull: false,
      comment: 'Total amount (donation + tip) in paise'
    });

    await queryInterface.changeColumn('donations', 'donation_towards', {
      type: Sequelize.STRING(255),
      allowNull: false,
      comment: 'What the donation is for (e.g., "Sadhu Welfare Seva")'
    });

    console.log('✅ Migration completed: Added donation API fields');
  },

  down: async (queryInterface, Sequelize) => {
    // Remove indexes
    await queryInterface.removeIndex('donations', 'donations_razorpay_order_id_idx');
    await queryInterface.removeIndex('donations', 'donations_razorpay_payment_id_idx');
    await queryInterface.removeIndex('donations', 'donations_donor_phone_idx');
    await queryInterface.removeIndex('donations', 'donations_donation_towards_idx');
    await queryInterface.removeIndex('donations', 'donations_show_name_publicly_idx');
    await queryInterface.removeIndex('donations', 'donations_receive_whatsapp_updates_idx');

    // Remove columns
    await queryInterface.removeColumn('donations', 'donation_amount');
    await queryInterface.removeColumn('donations', 'tip_amount');
    await queryInterface.removeColumn('donations', 'total_amount');
    await queryInterface.removeColumn('donations', 'donation_towards');
    await queryInterface.removeColumn('donations', 'donor_pan');
    await queryInterface.removeColumn('donations', 'donor_address');
    await queryInterface.removeColumn('donations', 'show_name_publicly');
    await queryInterface.removeColumn('donations', 'receive_whatsapp_updates');
    await queryInterface.removeColumn('donations', 'razorpay_order_id');
    await queryInterface.removeColumn('donations', 'razorpay_payment_id');
  }
};