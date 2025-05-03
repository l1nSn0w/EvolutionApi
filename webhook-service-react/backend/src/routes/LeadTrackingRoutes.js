const express = require('express');
const router = express.Router();
const LeadTrackingController = require('../controllers/LeadTrackingController');

// Rota original para obter eventos de rastreamento
router.get('/lead-tracking', LeadTrackingController.getLeadTracking);

// Rota alternativa/nova para obter eventos de rastreamento
router.get('/', LeadTrackingController.getLeadTracking);

// Listar todos os rastreamentos
router.get('/all', LeadTrackingController.getTrackings);

// Criar rastreamento manualmente
router.post('/create-manual', LeadTrackingController.createManualTracking);

module.exports = router; 