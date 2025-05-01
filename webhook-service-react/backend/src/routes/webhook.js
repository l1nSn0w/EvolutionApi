const express = require('express');
const router = express.Router();
const WebhookMessage = require('../models/WebhookMessage');
const axios = require('axios');
const { MAKE_WEBHOOK_URL, FB_ACCESS_TOKEN } = require('../config/kommo');
const WebhookController = require('../controllers/WebhookController');

// Função para obter dados do anúncio do Facebook
async function getFacebookAdData(sourceId) {
  try {
    const response = await axios.get(
      `https://graph.facebook.com/v18.0/${sourceId}`,
      {
        params: {
          access_token: FB_ACCESS_TOKEN,
          fields: 'name,adset{name,id,campaign{name,id}}'
        }
      }
    );
    return response.data;
  } catch (error) {
    console.error('Error fetching Facebook ad data:', error);
    return null;
  }
}

// Função para enviar dados para o Make
async function sendToMake(webhookData) {
  try {
    await axios.post(MAKE_WEBHOOK_URL, webhookData);
    return true;
  } catch (error) {
    console.error('Error sending data to Make:', error);
    return false;
  }
}

// Rota principal do webhook
router.post('/', async (req, res) => {
  try {
    const data = req.body;
    console.log('Received webhook data:', data);

    // Processar a mensagem
    const message = await WebhookMessage.create({
      telefone: data.telefone,
      nome: data.nome,
      dispositivo: data.dispositivo,
      mensagem: data.mensagem,
      source_id: data.source_id,
      title: data.title,
      url: data.url,
      date_time: data.date_time
    });

    // Se tiver source_id, buscar dados do Facebook
    if (data.source_id) {
      const fbData = await getFacebookAdData(data.source_id);
      if (fbData) {
        await message.update({
          ad_name: fbData.name,
          adset_name: fbData.adset?.name,
          adset_id: fbData.adset?.id,
          campaign_name: fbData.adset?.campaign?.name,
          campaign_id: fbData.adset?.campaign?.id
        });
      }
    }

    // Enviar para o Make
    const makeData = {
      ...data,
      message_id: message.id
    };
    await sendToMake(makeData);

    res.status(200).json({ success: true, message: 'Webhook processed successfully' });
  } catch (error) {
    console.error('Error processing webhook:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Rota para receber webhooks da Evolution API
router.post('/evolution', WebhookController.handleWebhook);

// Rota para receber webhooks da Evolution API (rota alternativa)
router.post('/', WebhookController.handleWebhook);

// Rota para buscar mensagens
router.get('/messages', WebhookController.getMessages);

module.exports = router; 