const LeadTracking = require('../models/LeadTracking');
const { Op } = require('sequelize');
   // @ts-ignore
const LeadTrackingService = require('../services/LeadTrackingService');

/**
 * Controlador para gerenciar eventos de rastreamento de leads
 */
const LeadTrackingController = {
  /**
   * Busca eventos de rastreamento com base nos parâmetros de consulta
   * @param {Object} req - Requisição Express
   * @param {Object} res - Resposta Express
   */
  async getLeadTracking(req, res) {
    try {
      const { lead_id, phone } = req.query;
      let where = {};

      if (lead_id) {
        where.lead_id = lead_id;
      }
      
      if (phone) {
        const formattedPhone = phone.replace(/\D/g, '');
        where.phone = {
          [Op.like]: `%${formattedPhone}%`
        };
      }

      const events = await LeadTracking.findAll({
        where,
        order: [['event_time', 'DESC']],
        limit: 1000
      });

      const result = events.map(event => ({
        id: event.id,
        message_id: event.message_id,
        lead_id: event.lead_id,
        phone: event.phone,
        event_type: event.event_type,
        source_id: event.source_id,
        previous_pipeline: {
          id: event.previous_pipeline_id,
          name: event.previous_pipeline_name
        },
        previous_status: {
          id: event.previous_status_id,
          name: event.previous_status_name
        },
        current_pipeline: {
          id: event.current_pipeline_id,
          name: event.current_pipeline_name
        },
        current_status: {
          id: event.current_status_id,
          name: event.current_status_name
        },
        lead_situation: event.lead_situation,
        price: event.price,
        responsible_user_id: event.responsible_user_id,
        responsible_user_name: event.responsible_user_name,
        event_time: event.event_time,
        created_at: event.created_at
      }));

      return res.json({
        status: 'success',
        count: result.length,
        events: result
      });
    } catch (error) {
      console.error('Erro ao buscar eventos de rastreamento:', error);
      return res.status(500).json({
        status: 'error',
        message: `Erro ao buscar eventos de rastreamento: ${error.message}`
      });
    }
  },

  /**
   * Cria manualmente um rastreamento para uma mensagem
   */
  async createManualTracking(req, res) {
    try {
      const { message_id, lead_id } = req.body;
      
      // Validar parâmetros
      if (!message_id) {
        return res.status(400).json({ status: 'error', message: 'ID da mensagem é obrigatório' });
      }
      
      // Chamar o serviço para criar o rastreamento
      const result = await LeadTrackingService.createManualTracking(message_id, lead_id || null);
      
      if (result.status === 'error') {
        return res.status(400).json(result);
      }
      
      return res.status(201).json(result);
    } catch (error) {
      console.error('Erro ao criar rastreamento manual:', error);
      return res.status(500).json({ 
        status: 'error', 
        message: 'Erro ao processar a solicitação',
        error: error.message
      });
    }
  },
  
  /**
   * Lista todos os rastreamentos
   */
  async getTrackings(req, res) {
    try {
      const trackings = await LeadTrackingService.getTrackings();
      return res.json(trackings);
    } catch (error) {
      console.error('Erro ao listar rastreamentos:', error);
      return res.status(500).json({ 
        status: 'error', 
        message: 'Erro ao processar a solicitação',
        error: error.message
      });
    }
  },

  /**
   * Criar manualmente um rastreamento de estágio do Kommo
   * @param {Object} req - Requisição Express
   * @param {Object} res - Resposta Express
   */
  async createManualStageTracking(req, res) {
    try {
      const { lead_id, phone, message_id } = req.body;
      
      // É necessário ter pelo menos o telefone ou o ID do lead
      if (!lead_id && !phone && !message_id) {
        return res.status(400).json({
          status: 'error',
          message: 'É necessário fornecer o ID do lead, o telefone ou o ID da mensagem'
        });
      }

      const result = await LeadTrackingService.createManualStageTracking({
        leadId: lead_id,
        phone,
        messageId: message_id
      });

      if (result.status === 'error') {
        return res.status(400).json(result);
      }

      return res.json(result);
    } catch (error) {
      console.error('Erro ao criar rastreamento manual de estágio:', error);
      return res.status(500).json({
        status: 'error',
        message: 'Erro interno ao criar rastreamento de estágio'
      });
    }
  }
};

module.exports = LeadTrackingController; 