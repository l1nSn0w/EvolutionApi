import axios from 'axios';

// Usar a variável de ambiente ou fallback para localhost em desenvolvimento
const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5002';

export const getLeadTracking = async (leadId, phone) => {
  try {
    const params = new URLSearchParams();
    if (leadId) params.append('lead_id', leadId);
    if (phone) {
      // Formatar o telefone para remover caracteres não numéricos
      const formattedPhone = phone.replace(/\D/g, '');
      params.append('phone', formattedPhone);
    }

    console.log('Buscando histórico com parâmetros:', params.toString());
    const response = await axios.get(`${API_URL}/api/lead-tracking?${params.toString()}`);
    return response.data;
  } catch (error) {
    console.error('Erro ao buscar histórico do lead:', error);
    throw error;
  }
};

/**
 * Cria um rastreamento manual de estágio no Kommo para um lead
 * @param {number} leadId - ID do lead no Kommo (opcional)
 * @param {string} phone - Telefone do lead (opcional)
 * @param {number} messageId - ID da mensagem (opcional)
 * @returns {Promise<Object>} - Resultado da operação
 */
export const createManualStageTracking = async (leadId, phone, messageId) => {
  try {
    const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:5002';
    const payload = {};
    
    // Adicionar os parâmetros que estão disponíveis
    if (leadId) payload.lead_id = leadId;
    if (phone) payload.phone = phone;
    if (messageId) payload.message_id = messageId;
    
    const response = await axios.post(`${apiUrl}/api/create-manual-stage`, payload);
    return response.data;
  } catch (error) {
    console.error('Erro ao criar rastreamento de estágio:', error);
    throw error;
  }
}; 