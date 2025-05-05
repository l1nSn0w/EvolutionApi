const express = require('express');
const router = express.Router();
const WebhookMessage = require('../models/WebhookMessage');
const axios = require('axios');
const { MAKE_WEBHOOK_URL, FB_ACCESS_TOKEN } = require('../config/kommo');
   // @ts-ignore
const WebhookController = require('../controllers/WebhookController');


// Rota para receber webhooks da Evolution API
router.post('/evolution', WebhookController.handleWebhook);

// Rota para buscar mensagens
router.get('/messages', WebhookController.getMessages);

module.exports = router; 