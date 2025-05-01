const express = require('express');
const router = express.Router();
const KommoController = require('../controllers/KommoController');

// Rota para verificar o status de autenticação
router.get('/status', KommoController.checkStatus);

// Rota para buscar os pipelines
router.get('/pipelines', KommoController.getPipelines);

// Rota para buscar os estágios de um pipeline específico
router.get('/pipelines/:pipelineId/stages', KommoController.getPipelineStages);

// Rota para buscar os leads de um pipeline específico
router.get('/pipelines/:pipelineId/leads', KommoController.getPipelineLeads);

// Rota para buscar os leads de um estágio específico
router.get('/pipelines/:pipelineId/stages/:stageId/leads', KommoController.getStageLeads);

// Rota para buscar os leads de um pipeline específico da tabela leadTracking
router.get('/pipelines/:pipelineId/tracking-leads', KommoController.getPipelineLeadsFromTracking);

// Rota para receber webhooks do Kommo
router.post('/webhook', KommoController.handleKommoWebhook);

module.exports = router; 