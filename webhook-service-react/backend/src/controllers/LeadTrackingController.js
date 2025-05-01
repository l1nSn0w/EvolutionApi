const LeadTracking = require('../models/LeadTracking');
const { Op } = require('sequelize');

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
        limit: 100
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
  }
};

module.exports = LeadTrackingController; 