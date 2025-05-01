const WebhookService = require('../services/webhookService');

/**
 * Controlador para processar webhooks
 */
const WebhookController = {
  async handleWebhook(req, res) {
    try {
      const webhookData = req.body;

      console.log('OIee');
      
      // Processar a mensagem
      const result = await WebhookService.processMessage(webhookData);
      
      res.json({
        success: true,
        message: 'Webhook processado com sucesso',
        data: result
      });
    } catch (error) {
      console.error('Erro ao processar webhook:', error);
      res.status(500).json({
        success: false,
        message: 'Erro ao processar webhook',
        error: error.message
      });
    }
  },

  async getMessages(req, res) {
    try {
      const messages = await WebhookService.getMessages();
      res.json(messages);
    } catch (error) {
      console.error('Erro ao buscar mensagens:', error);
      res.status(500).json({
        success: false,
        message: 'Erro ao buscar mensagens',
        error: error.message
      });
    }
  }
};

module.exports = WebhookController; 