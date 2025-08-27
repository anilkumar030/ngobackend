const express = require('express');
const statisticsController = require('../controllers/statisticsController');
const { optionalAuth } = require('../middleware/auth');
const { validate } = require('../middleware/validation');
const {
  getDetailedStatisticsValidation,
} = require('../validators/statisticsValidators');

const router = express.Router();

/**
 * @route GET /api/statistics
 * @desc Get public impact statistics for homepage display
 * @access Public
 * @returns {Object} response - Success response with statistics array
 * @returns {Array} response.data.statistics - Array of statistic objects
 * @returns {string} response.data.statistics[].label - Display label
 * @returns {string} response.data.statistics[].value - Formatted value (e.g., "5,00,000+")
 * @returns {string} response.data.statistics[].icon - Icon identifier
 * @returns {string} response.data.statistics[].description - Description text
 * @returns {string} response.data.last_updated - ISO timestamp of last update
 * @returns {string} response.data.project_name - Project name from environment
 */
router.get('/', optionalAuth, statisticsController.getPublicStatistics);

/**
 * @route GET /api/statistics/detailed
 * @desc Get detailed statistics with optional filtering and comprehensive breakdown
 * @access Public
 * @param {string} [start_date] - ISO date string for filtering start date (YYYY-MM-DD)
 * @param {string} [end_date] - ISO date string for filtering end date (YYYY-MM-DD)
 * @param {string} [category] - Category filter (projects/campaigns/events/donations)
 * @returns {Object} response - Success response with detailed statistics
 * @returns {Object} response.data.overview - Overall counts and totals
 * @returns {Object} response.data.category_breakdown - Statistics grouped by category
 * @returns {Object} response.data.time_series - Monthly time series data
 * @returns {Object} response.data.impact_metrics - Impact measurement data
 * @returns {Object} response.data.filters_applied - Applied filter values
 * @returns {string} response.data.last_updated - ISO timestamp of last update
 * @returns {string} response.data.project_name - Project name from environment
 * 
 * @example
 * GET /api/statistics/detailed
 * GET /api/statistics/detailed?category=projects
 * GET /api/statistics/detailed?start_date=2024-01-01&end_date=2024-12-31
 * GET /api/statistics/detailed?start_date=2024-01-01&end_date=2024-06-30&category=donations
 */
router.get('/detailed', 
  optionalAuth, 
  validate(getDetailedStatisticsValidation), 
  statisticsController.getDetailedStatistics
);

module.exports = router;