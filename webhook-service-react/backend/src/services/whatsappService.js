const axios = require('axios');
const { EVOLUTION_API_URL, EVOLUTION_API_KEY, EVOLUTION_API_INSTANCE } = require('../config/evolutionApi');

/**
 * Serviço para integração com a Evolution API (WhatsApp)
 */
const whatsappService = {
  /**
   * Envia uma mensagem de texto para um grupo do WhatsApp
   * @param {string} groupId - ID do grupo no formato "XXXXXXXXXX-XXXXXXXXXX@g.us"
   * @param {string} message - Mensagem a ser enviada
   * @param {Object} options - Opções adicionais
   * @returns {Promise<Object>} - Resposta da API
   */
  sendGroupMessage: async (groupId, message, options = {}) => {
    try {
      // URL para enviar mensagem de texto
      const url = `${EVOLUTION_API_URL}/message/sendText/${EVOLUTION_API_INSTANCE}`;

      // Configurar delay e presença padrão se não fornecidos
      const delay = options.delay || 1200;
      const presence = options.presence || 'composing';

      // Payload com os dados da mensagem
      const payload = {
        number: groupId,
        options: {
          delay: delay,
          presence: presence
        },
        text: message
      };

      // Cabeçalhos com a API key
      const headers = {
        apikey: EVOLUTION_API_KEY,
        'Content-Type': 'application/json'
      };

      console.log(`🚀 Enviando mensagem para o grupo ${groupId}...`);
      console.log(`📝 Mensagem: ${message}`);

      // Fazer a requisição
      const response = await axios.post(url, payload, { headers });

      console.log(`✅ Mensagem enviada com sucesso!`);
      console.log(`📊 Resposta da API:`, response.data);

      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      console.error(`❌ Erro ao enviar mensagem para o grupo ${groupId}:`, error.message);
      
      // Se temos uma resposta da API com erro
      if (error.response) {
        console.error(`📄 Detalhes do erro:`, error.response.data);
        return {
          success: false,
          error: error.response.data,
          status: error.response.status
        };
      }

      // Erro de conexão ou outro tipo
      return {
        success: false,
        error: error.message
      };
    }
  },

  /**
   * Envia uma imagem para um grupo do WhatsApp
   * @param {string} groupId - ID do grupo no formato "XXXXXXXXXX-XXXXXXXXXX@g.us"
   * @param {string} imageUrl - URL da imagem a ser enviada
   * @param {string} caption - Legenda da imagem (opcional)
   * @returns {Promise<Object>} - Resposta da API
   */
  sendGroupImage: async (groupId, imageUrl, caption = '') => {
    try {
      // URL para enviar mensagem com mídia
      const url = `${EVOLUTION_API_URL}/message/sendMedia/${EVOLUTION_API_INSTANCE}`;

      // Payload com os dados da mensagem
      const payload = {
        number: groupId,
        options: {
          delay: 1200,
          presence: 'composing'
        },
        media: {
          url: imageUrl,
          caption: caption,
          type: 'image'
        }
      };

      // Cabeçalhos com a API key
      const headers = {
        apikey: EVOLUTION_API_KEY,
        'Content-Type': 'application/json'
      };

      console.log(`🚀 Enviando imagem para o grupo ${groupId}...`);
      console.log(`🖼️ URL da imagem: ${imageUrl}`);

      // Fazer a requisição
      const response = await axios.post(url, payload, { headers });

      console.log(`✅ Imagem enviada com sucesso!`);
      console.log(`📊 Resposta da API:`, response.data);

      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      console.error(`❌ Erro ao enviar imagem para o grupo ${groupId}:`, error.message);
      
      // Se temos uma resposta da API com erro
      if (error.response) {
        console.error(`📄 Detalhes do erro:`, error.response.data);
        return {
          success: false,
          error: error.response.data,
          status: error.response.status
        };
      }

      // Erro de conexão ou outro tipo
      return {
        success: false,
        error: error.message
      };
    }
  }
};

module.exports = whatsappService; 