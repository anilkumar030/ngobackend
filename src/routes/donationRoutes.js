const express = require('express');
const donationController = require('../controllers/donationController');

const router = express.Router();

/**
 * @route POST /api/donations/create-order
 * @desc Create a new donation order with Razorpay
 * @access Public (no authentication required)
 */
router.post('/create-order', donationController.createOrder);

/**
 * @route POST /api/donations/confirm-payment
 * @desc Confirm payment and complete donation
 * @access Public (no authentication required)
 */
router.post('/confirm-payment', donationController.confirmPayment);

/**
 * @route GET /api/donations/campaign/:campaignId
 * @desc Get donations for a specific campaign (public donations only)
 * @access Public
 */
// router.get('/campaign/:campaignId', donationController.getCampaignDonations);

/**
 * @route GET /api/donations/recent
 * @desc Get recent public donations across all campaigns
 * @access Public
 */
// router.get('/recent', donationController.getRecentDonations);

/**
 * @route GET /api/donations/:id/receipt
 * @desc Get donation receipt by ID
 * @access Public (with donation ID)
 */
// router.get('/:id/receipt', donationController.getDonationReceipt);

module.exports = router;