import axios from 'axios';

// Usar a variável de ambiente ou fallback para localhost em desenvolvimento
const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5002';

/**
 * Serviço para interagir com a API do Kommo
 */
const kommoService = {
  /**
   * Verifica o status de autenticação do Kommo
   * @returns {Promise<Object>} Dados de autenticação
   */
  checkAuthStatus: async () => {
    try {
      const response = await axios.get(`${API_URL}/api/kommo/status`);
      return response.data;
    } catch (error) {
      console.error('Erro ao verificar status de autenticação:', error);
      throw error;
    }
  },

  /**
   * Busca os pipelines do Kommo
   * @returns {Promise<Object>} Dados dos pipelines
   */
  getPipelines: async () => {
    try {
      const response = await axios.get(`${API_URL}/api/kommo/pipelines`);
      return response.data;
    } catch (error) {
      console.error('Erro ao buscar pipelines:', error);
      throw error;
    }
  },

  /**
   * Busca os estágios de um pipeline específico
   * @param {number} pipelineId - ID do pipeline
   * @returns {Promise<Object>} Dados dos estágios
   */
  getPipelineStages: async (pipelineId) => {
    try {
      console.log(`Buscando estágios do pipeline ${pipelineId}...`);
      const response = await axios.get(`${API_URL}/api/kommo/pipelines/${pipelineId}/stages`);
      console.log(`Estágios encontrados: ${response.data.stages?.length || 0}`);
      return response.data;
    } catch (error) {
      console.error('Erro ao buscar estágios do pipeline:', error);
      throw error;
    }
  },

  /**
   * Busca os leads de um pipeline específico
   * @param {number} pipelineId - ID do pipeline
   * @returns {Promise<Object>} Dados dos leads
   */
  getPipelineLeads: async (pipelineId) => {
    try {
      console.log(`Buscando leads do pipeline ${pipelineId}...`);
      const response = await axios.get(`${API_URL}/api/kommo/pipelines/${pipelineId}/leads`);
      console.log(`Leads encontrados: ${response.data.leads?.length || 0}`);
      return response.data;
    } catch (error) {
      console.error('Erro ao buscar leads do pipeline:', error);
      throw error;
    }
  },

  /**
   * Busca os leads de um estágio específico
   * @param {number} pipelineId - ID do pipeline
   * @param {number} stageId - ID do estágio
   * @returns {Promise<Object>} Dados dos leads
   */
  getStageLeads: async (pipelineId, stageId) => {
    try {
      console.log(`Buscando leads do estágio ${stageId} do pipeline ${pipelineId}...`);
      const response = await axios.get(`${API_URL}/api/kommo/pipelines/${pipelineId}/stages/${stageId}/leads`);
      console.log(`Leads encontrados: ${response.data.leads?.length || 0}`);
      return response.data;
    } catch (error) {
      console.error('Erro ao buscar leads do estágio:', error);
      throw error;
    }
  },

  /**
   * Busca os leads de um pipeline específico da tabela leadTracking
   * @param {number} pipelineId - ID do pipeline
   * @returns {Promise<Object>} Dados dos leads
   */
  getPipelineTrackingLeads: async (pipelineId) => {
    try {
      console.log(`Buscando leads do pipeline ${pipelineId} na tabela de tracking...`);
      const response = await axios.get(`${API_URL}/api/kommo/pipelines/${pipelineId}/tracking-leads`);
      console.log(`Resposta completa:`, response.data);
      console.log(`Leads encontrados: ${Object.keys(response.data.leads || {}).length} estágios`);
      return response.data.leads;
    } catch (error) {
      console.error('Erro ao buscar leads do pipeline na tabela de tracking:', error);
      throw error;
    }
  }
};

export default kommoService; 