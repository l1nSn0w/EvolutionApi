const whatsappService = require('../services/whatsappService');

/**
 * Controlador para operações relacionadas ao WhatsApp
 */
const WhatsappController = {
  /**
   * Envia uma mensagem de texto para um grupo do WhatsApp
   * @param {Object} req - Requisição Express
   * @param {Object} res - Resposta Express
   */
  sendGroupMessage: async (req, res) => {
    try {
      const { groupId, message, options } = req.body;

      // Validações básicas
      if (!groupId) {
        return res.status(400).json({
          success: false,
          message: 'O ID do grupo é obrigatório'
        });
      }

      if (!message) {
        return res.status(400).json({
          success: false,
          message: 'A mensagem é obrigatória'
        });
      }

      // Enviar mensagem usando o serviço
      const result = await whatsappService.sendGroupMessage(groupId, message, options);

      // Se houve erro no serviço
      if (!result.success) {
        return res.status(result.status || 500).json({
          success: false,
          message: 'Erro ao enviar mensagem',
          error: result.error
        });
      }

      // Resposta de sucesso
      return res.status(200).json({
        success: true,
        message: 'Mensagem enviada com sucesso',
        data: result.data
      });
    } catch (error) {
      console.error('Erro ao processar requisição:', error);
      return res.status(500).json({
        success: false,
        message: 'Erro ao processar requisição',
        error: error.message
      });
    }
  },

  /**
   * Envia uma imagem para um grupo do WhatsApp
   * @param {Object} req - Requisição Express
   * @param {Object} res - Resposta Express
   */
  sendGroupImage: async (req, res) => {
    try {
      const { groupId, imageUrl, caption } = req.body;

      // Validações básicas
      if (!groupId) {
        return res.status(400).json({
          success: false,
          message: 'O ID do grupo é obrigatório'
        });
      }

      if (!imageUrl) {
        return res.status(400).json({
          success: false,
          message: 'A URL da imagem é obrigatória'
        });
      }

      // Enviar imagem usando o serviço
      const result = await whatsappService.sendGroupImage(groupId, imageUrl, caption || '');

      // Se houve erro no serviço
      if (!result.success) {
        return res.status(result.status || 500).json({
          success: false,
          message: 'Erro ao enviar imagem',
          error: result.error
        });
      }

      // Resposta de sucesso
      return res.status(200).json({
        success: true,
        message: 'Imagem enviada com sucesso',
        data: result.data
      });
    } catch (error) {
      console.error('Erro ao processar requisição:', error);
      return res.status(500).json({
        success: false,
        message: 'Erro ao processar requisição',
        error: error.message
      });
    }
  }
};

module.exports = WhatsappController; 