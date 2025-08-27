'use strict';

/**
 * Migration: Add missing columns to fix schema mismatch
 * 
 * This migration adds:
 * - is_active column to gallery table 
 * - is_available column to products table
 * 
 * These columns are referenced in application code but missing from the database schema.
 */

module.exports = {
  async up(queryInterface, Sequelize) {
    try {
      // Add is_active column to gallery table
      await queryInterface.addColumn('gallery', 'is_active', {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
        comment: 'Whether the gallery item is active and visible'
      });

      // Add is_available column to products table  
      await queryInterface.addColumn('products', 'is_available', {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
        comment: 'Whether the product is available for purchase'
      });

      // Add indexes for better query performance
      await queryInterface.addIndex('gallery', ['is_active'], {
        name: 'gallery_is_active_idx'
      });

      await queryInterface.addIndex('products', ['is_available'], {
        name: 'products_is_available_idx'
      });

      // Add composite indexes for commonly used queries
      await queryInterface.addIndex('gallery', ['status', 'is_active'], {
        name: 'gallery_status_is_active_idx'
      });

      await queryInterface.addIndex('products', ['status', 'is_available'], {
        name: 'products_status_is_available_idx'
      });

      console.log('✓ Successfully added missing columns: gallery.is_active, products.is_available');
      
    } catch (error) {
      console.error('✗ Error in migration 019_add_missing_columns:', error);
      throw error;
    }
  },

  async down(queryInterface, Sequelize) {
    try {
      // Remove indexes first
      await queryInterface.removeIndex('gallery', 'gallery_is_active_idx');
      await queryInterface.removeIndex('products', 'products_is_available_idx');
      await queryInterface.removeIndex('gallery', 'gallery_status_is_active_idx');
      await queryInterface.removeIndex('products', 'products_status_is_available_idx');

      // Remove columns
      await queryInterface.removeColumn('gallery', 'is_active');
      await queryInterface.removeColumn('products', 'is_available');

      console.log('✓ Successfully removed columns: gallery.is_active, products.is_available');
      
    } catch (error) {
      console.error('✗ Error rolling back migration 019_add_missing_columns:', error);
      throw error;
    }
  }
};