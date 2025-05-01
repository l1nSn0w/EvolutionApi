const express = require('express');
const router = express.Router();
const LeadTrackingController = require('../controllers/LeadTrackingController');

router.get('/lead-tracking', LeadTrackingController.getLeadTracking);

module.exports = router; 