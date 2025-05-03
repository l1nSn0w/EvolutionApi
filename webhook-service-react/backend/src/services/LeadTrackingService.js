const LeadTracking = require('../models/LeadTracking');
const WebhookMessage = require('../models/WebhookMessage');
const KommoToken = require('../models/KommoToken');
const { searchLeadByPhone, getPipelineDetails } = require('./KommoService');

class LeadTrackingService {
  /**
   * Cria manualmente um rastreamento para uma mensagem existente
   * @param {number} messageId - ID da mensagem a ser rastreada
   * @param {number} leadId - ID do lead (opcional)
   */
  async createManualTracking(messageId, leadId = null) {
    try {
      // 1. Verificar se a mensagem existe
      const message = await WebhookMessage.findByPk(messageId);
      if (!message) {
        return { 
          status: 'error', 
          message: 'Mensagem não encontrada' 
        };
      }

      // 2. Verificar se já existe um rastreamento para esta mensagem
      const existingTracking = await LeadTracking.findOne({
        where: { message_id: messageId }
      });

      if (existingTracking) {
        return { 
          status: 'error', 
          message: 'Esta mensagem já possui um rastreamento' 
        };
      }

      // 3. Obter dados necessários da mensagem
      const telefone = message.telefone;
      const sourceId = message.source_id;

      // 4. Se o ID do lead não foi fornecido, buscar no Kommo pelo telefone
      if (!leadId) {
        // Buscar token do Kommo
        const token = await KommoToken.findOne({
          order: [['created_at', 'DESC']]
        });

        if (!token) {
          return { 
            status: 'error', 
            message: 'Nenhum token de acesso para o Kommo configurado' 
          };
        }

        // Construir domínio
        let domain = token.domain;
        if (!domain.startsWith('http')) {
          if (!domain.endsWith('.kommo.com')) {
            domain = `${domain}.kommo.com`;
          }
        }

        console.log(`🔍 Buscando lead no Kommo para o telefone: ${telefone}`);
        const result = await searchLeadByPhone(telefone, token.access_token, domain);

        if (result.status !== 'success' || !result.leads || result.leads.length === 0) {
          return { 
            status: 'error', 
            message: `Nenhum lead encontrado no Kommo para o telefone ${telefone}` 
          };
        }

        // Lead encontrado, usar o primeiro da lista
        const lead = result.leads[0];
        leadId = lead.id;
        
        // Buscar detalhes do pipeline e status
        const pipelineDetails = await getPipelineDetails(domain, token.access_token);
        
        const pipelineId = lead.pipeline_id;
        const statusId = lead.status_id;
        
        // Encontrar informações do pipeline e status
        const currentPipeline = pipelineDetails[pipelineId];
        const currentStatus = currentPipeline?.stages?.[statusId];
        
        // Buscar campo personalizado "Situação do lead"
        let leadSituation = null;
        if (lead.custom_fields_values) {
          for (const field of lead.custom_fields_values) {
            if (['Situação do lead', 'Situacao do lead', 'Situação', 'Situacao'].includes(field.field_name)) {
              if (field.values && field.values.length > 0) {
                leadSituation = field.values[0].value;
                break;
              }
            }
          }
        }

        // Criar o registro de rastreamento
        const tracking = await LeadTracking.create({
          message_id: messageId,
          lead_id: leadId,
          phone: telefone,
          event_type: 'message_received',
          source_id: sourceId,
          current_pipeline_id: pipelineId,
          current_pipeline_name: currentPipeline?.name || null,
          current_status_id: statusId,
          current_status_name: currentStatus?.name || null,
          lead_situation: leadSituation,
          is_manually_created: true // Definir explicitamente como true para rastreamentos manuais
        });

        return {
          status: 'success',
          message: 'Rastreamento criado com sucesso',
          tracking
        };
      } else {
        // Se o ID do lead foi fornecido, usá-lo diretamente
        // Buscar token do Kommo para obter outros detalhes do lead
        const token = await KommoToken.findOne({
          order: [['created_at', 'DESC']]
        });

        if (!token) {
          return { 
            status: 'error', 
            message: 'Nenhum token de acesso para o Kommo configurado' 
          };
        }

        // Construir domínio
        let domain = token.domain;
        if (!domain.startsWith('http')) {
          if (!domain.endsWith('.kommo.com')) {
            domain = `${domain}.kommo.com`;
          }
        }

        // Criar o registro de rastreamento com informações básicas
        // Os detalhes completos serão obtidos automaticamente em sincronizações futuras
        const tracking = await LeadTracking.create({
          message_id: messageId,
          lead_id: leadId,
          phone: telefone,
          event_type: 'message_received',
          source_id: sourceId,
          is_manually_created: true // Definir explicitamente como true para rastreamentos manuais
        });

        return {
          status: 'success',
          message: 'Rastreamento criado com sucesso usando ID de lead fornecido',
          tracking
        };
      }
    } catch (error) {
      console.error('❌ Erro ao criar rastreamento manual:', error);
      return {
        status: 'error',
        message: `Erro ao criar rastreamento: ${error.message}`
      };
    }
  }

  /**
   * Lista todos os rastreamentos
   */
  async getTrackings() {
    try {
      const trackings = await LeadTracking.findAll({
        include: [{
          model: WebhookMessage,
          attributes: ['telefone', 'nome', 'mensagem', 'campaign_name', 'ad_name']
        }],
        order: [['created_at', 'DESC']]
      });
      
      return trackings;
    } catch (error) {
      console.error('Erro ao buscar rastreamentos:', error);
      throw error;
    }
  }
}

module.exports = new LeadTrackingService(); 