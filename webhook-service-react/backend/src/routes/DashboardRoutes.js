const express = require('express');
const router = express.Router();
// @ts-ignore
const dashboardService = require('../services/DashboardService');

// Rota para obter métricas de campanhas
router.get('/campaign-metrics', async (req, res) => {
  try {
    const metrics = await dashboardService.getCampaignMetrics();
    res.json(metrics);
  } catch (error) {
    console.error('Error fetching campaign metrics:', error);
    res.status(500).json({ error: error.message });
  }
});

// Nova rota para obter apenas métricas de campanhas detalhadas
router.get('/campaign-only-metrics', async (req, res) => {
  try {
    const metrics = await dashboardService.getCampaignOnlyMetrics();
    res.json(metrics);
  } catch (error) {
    console.error('Error fetching campaign-only metrics:', error);
    res.status(500).json({ error: error.message });
  }
});

// Nova rota para obter métricas básicas de campanhas 
router.get('/campaign-basic-metrics', async (req, res) => {
  try {
    const metrics = await dashboardService.getCampaignBasicMetrics();
    res.json(metrics);
  } catch (error) {
    console.error('Error fetching basic campaign metrics:', error);
    res.status(500).json({ error: error.message });
  }
});

// Nova rota para obter leads agrupados por telefone
router.get('/leads-by-phone', async (req, res) => {
  try {
    const result = await dashboardService.getLeadsByPhone();
    res.json(result);
  } catch (error) {
    console.error('Error fetching leads by phone:', error);
    res.status(500).json({ error: error.message });
  }
});

// Nova rota para obter análise detalhada de campanhas
router.get('/campaign-analytics', async (req, res) => {
  try {
    const analytics = await dashboardService.getCampaignAnalytics();
    res.json(analytics);
  } catch (error) {
    console.error('Error fetching campaign analytics:', error);
    res.status(500).json({ error: error.message });
  }
});

// Rota para obter campanhas por situação
router.get('/campaigns-by-situation', async (req, res) => {
  try {
    const campaigns = await dashboardService.getCampaignsBySituation();
    res.json(campaigns);
  } catch (error) {
    console.error('Error fetching campaigns by situation:', error);
    res.status(500).json({ error: error.message });
  }
});

// Rota para obter mensagens
router.get('/messages', async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const messages = await dashboardService.getMessages({ page, limit });
    res.json(messages);
  } catch (error) {
    console.error('Error fetching messages:', error);
    res.status(500).json({ error: error.message });
  }
});

// Rota para obter rastreamento de leads
router.get('/lead-tracking', async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const tracking = await dashboardService.getLeadTracking({ page, limit });
    res.json(tracking);
  } catch (error) {
    console.error('Error fetching lead tracking:', error);
    res.status(500).json({ error: error.message });
  }
});

// Rota para obter métricas de anúncios
router.get('/ad-metrics', async (req, res) => {
  try {
    const metrics = await dashboardService.getAdMetrics();
    res.json(metrics);
  } catch (error) {
    console.error('Error fetching ad metrics:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router; 