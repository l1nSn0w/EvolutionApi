const express = require('express');
const router = express.Router();
const ReportController = require('../controllers/ReportController');

// Rota para gerar e enviar relatório do dashboard via WhatsApp
router.post('/dashboard-summary', ReportController.generateAndSendDashboardReport);

module.exports = router; 