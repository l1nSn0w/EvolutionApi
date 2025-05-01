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