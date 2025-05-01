const axios = require('axios');
const KommoToken = require('../models/KommoToken');
const LeadTracking = require('../models/LeadTracking');
const WebhookMessage = require('../models/WebhookMessage');
const { KOMMO_CLIENT_ID, KOMMO_CLIENT_SECRET } = require('../config/kommo');
const { 
  searchLeadByPhone, 
  refreshKommoToken, 
  getPipelineDetails,
  getLeadDetails,
  getContactDetails,
  extractPhoneFromContact,
  getUserDetails
} = require('../services/KommoService');

/**
 * Controlador para integração com a plataforma Kommo
 */
const KommoController = {
  /**
   * Verifica o status de autenticação do Kommo
   * @param {Object} req - Requisição Express
   * @param {Object} res - Resposta Express
   */
  checkStatus: async (req, res) => {
    try {
      // Buscar o token mais recente
      const token = await KommoToken.findOne({
        order: [['created_at', 'DESC']]
      });

      if (!token) {
        return res.json({
          authenticated: false,
          message: 'Nenhum token encontrado'
        });
      }

      // Verificar se o token expirou
      const now = new Date();
      const expiresAt = new Date(token.expires_at);
      
      if (now > expiresAt) {
        return res.json({
          authenticated: false,
          message: 'Token expirado'
        });
      }

      return res.json({
        authenticated: true,
        message: 'Autenticado com sucesso',
        account_id: token.account_id,
        domain: token.domain
      });
    } catch (error) {
      console.error('Erro ao verificar status de autenticação:', error);
      return res.status(500).json({
        authenticated: false,
        message: 'Erro ao verificar status de autenticação',
        error: error.message
      });
    }
  },

  /**
   * Busca os pipelines do Kommo
   * @param {Object} req - Requisição Express
   * @param {Object} res - Resposta Express
   */
  getPipelines: async (req, res) => {
    try {
      // Buscar o token mais recente
      const token = await KommoToken.findOne({
        order: [['created_at', 'DESC']]
      });

      if (!token) {
        return res.status(401).json({
          success: false,
          message: 'Nenhum token encontrado'
        });
      }

      // Verificar se o token expirou
      const now = new Date();
      const expiresAt = new Date(token.expires_at);
      
      if (now > expiresAt) {
        return res.status(401).json({
          success: false,
          message: 'Token expirado'
        });
      }

      console.log('Buscando pipelines do Kommo...');
      console.log(`URL: https://${token.domain}/api/v4/leads/pipelines`);
      console.log(`Token: ${token.access_token.substring(0, 10)}...`);

      // Buscar os pipelines
      const response = await axios.get(
        `https://${token.domain}/api/v4/leads/pipelines`,
        {
          headers: {
            'Authorization': `Bearer ${token.access_token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      console.log('Pipelines encontrados:', response.data._embedded.pipelines.length);
      console.log('Pipelines:', JSON.stringify(response.data._embedded.pipelines, null, 2));

      // Retornar apenas os dados básicos dos pipelines
      const pipelines = response.data._embedded.pipelines.map(pipeline => ({
        id: pipeline.id,
        name: pipeline.name
      }));

      return res.json({
        success: true,
        pipelines
      });
    } catch (error) {
      console.error('Erro ao buscar pipelines:', error);
      return res.status(500).json({
        success: false,
        message: 'Erro ao buscar pipelines',
        error: error.message
      });
    }
  },

  /**
   * Busca os estágios de um pipeline específico
   * @param {Object} req - Requisição Express
   * @param {Object} res - Resposta Express
   */
  getPipelineStages: async (req, res) => {
    try {
      const { pipelineId } = req.params;

      // Buscar o token mais recente
      const token = await KommoToken.findOne({
        order: [['created_at', 'DESC']]
      });

      if (!token) {
        return res.status(401).json({
          success: false,
          message: 'Nenhum token encontrado'
        });
      }

      // Verificar se o token expirou
      const now = new Date();
      const expiresAt = new Date(token.expires_at);
      
      if (now > expiresAt) {
        return res.status(401).json({
          success: false,
          message: 'Token expirado'
        });
      }

      console.log(`Buscando estágios do pipeline ${pipelineId}...`);
      console.log(`URL: https://${token.domain}/api/v4/leads/pipelines/${pipelineId}/statuses`);
      console.log(`Token: ${token.access_token.substring(0, 10)}...`);

      // Buscar os estágios do pipeline
      const response = await axios.get(
        `https://${token.domain}/api/v4/leads/pipelines/${pipelineId}/statuses`,
        {
          headers: {
            'Authorization': `Bearer ${token.access_token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      console.log('Estágios encontrados:', response.data._embedded.statuses.length);

      // Retornar os estágios
      return res.json({
        success: true,
        stages: response.data._embedded.statuses
      });
    } catch (error) {
      console.error('Erro ao buscar estágios do pipeline:', error);
      return res.status(500).json({
        success: false,
        message: 'Erro ao buscar estágios do pipeline',
        error: error.message
      });
    }
  },

  /**
   * Busca os leads de um pipeline específico
   * @param {Object} req - Requisição Express
   * @param {Object} res - Resposta Express
   */
  getPipelineLeads: async (req, res) => {
    try {
      const { pipelineId } = req.params;

      // Buscar o token mais recente
      const token = await KommoToken.findOne({
        order: [['created_at', 'DESC']]
      });

      if (!token) {
        return res.status(401).json({
          success: false,
          message: 'Nenhum token encontrado'
        });
      }

      // Verificar se o token expirou
      const now = new Date();
      const expiresAt = new Date(token.expires_at);
      
      if (now > expiresAt) {
        return res.status(401).json({
          success: false,
          message: 'Token expirado'
        });
      }

      console.log(`Buscando leads do pipeline ${pipelineId}...`);
      console.log(`URL: https://${token.domain}/api/v4/leads?pipeline_id=${pipelineId}`);
      console.log(`Token: ${token.access_token.substring(0, 10)}...`);

      // Buscar os leads do pipeline
      const response = await axios.get(
        `https://${token.domain}/api/v4/leads?pipeline_id=${pipelineId}`,
        {
          headers: {
            'Authorization': `Bearer ${token.access_token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      console.log('Leads encontrados:', response.data._embedded.leads.length);

      // Retornar os leads
      return res.json({
        success: true,
        leads: response.data._embedded.leads
      });
    } catch (error) {
      console.error('Erro ao buscar leads do pipeline:', error);
      return res.status(500).json({
        success: false,
        message: 'Erro ao buscar leads do pipeline',
        error: error.message
      });
    }
  },

  /**
   * Busca os leads de um estágio específico
   * @param {Object} req - Requisição Express
   * @param {Object} res - Resposta Express
   */
  getStageLeads: async (req, res) => {
    try {
      const { pipelineId, stageId } = req.params;

      // Buscar o token mais recente
      const token = await KommoToken.findOne({
        order: [['created_at', 'DESC']]
      });

      if (!token) {
        return res.status(401).json({
          success: false,
          message: 'Nenhum token encontrado'
        });
      }

      // Verificar se o token expirou
      const now = new Date();
      const expiresAt = new Date(token.expires_at);
      
      if (now > expiresAt) {
        return res.status(401).json({
          success: false,
          message: 'Token expirado'
        });
      }

      console.log(`Buscando leads do estágio ${stageId} do pipeline ${pipelineId}...`);
      console.log(`URL: https://${token.domain}/api/v4/leads?pipeline_id=${pipelineId}&status_id=${stageId}`);
      console.log(`Token: ${token.access_token.substring(0, 10)}...`);

      // Buscar os leads do estágio
      const response = await axios.get(
        `https://${token.domain}/api/v4/leads?pipeline_id=${pipelineId}&status_id=${stageId}`,
        {
          headers: {
            'Authorization': `Bearer ${token.access_token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      console.log('Leads encontrados:', response.data._embedded.leads.length);

      // Retornar os leads
      return res.json({
        success: true,
        leads: response.data._embedded.leads
      });
    } catch (error) {
      console.error('Erro ao buscar leads do estágio:', error);
      return res.status(500).json({
        success: false,
        message: 'Erro ao buscar leads do estágio',
        error: error.message
      });
    }
  },

  /**
   * Processa webhooks do Kommo
   * @param {Object} req - Requisição Express
   * @param {Object} res - Resposta Express
   */
  handleKommoWebhook: async (req, res) => {
    try {
      console.log('🔔 Webhook recebido da Kommo!');
      console.log('📦 Body:', JSON.stringify(req.body, null, 2));

      // Extrair informações da conta
      const accountId = req.body.account?.id;
      const domain = req.body.account?.subdomain;
      const fullDomain = domain ? `${domain}.kommo.com` : 'kommo.com';

      // Extrair informações do lead
      const leadStatus = req.body.leads?.status?.[0];
      const leadId = leadStatus?.id;
      const newStatusId = leadStatus?.status_id;
      const previousStatusId = leadStatus?.old_status_id;
      const pipelineId = leadStatus?.pipeline_id;
      const previousPipelineId = leadStatus?.old_pipeline_id;

      // Logs com emojis
      console.log('👤 Account ID:', accountId);
      console.log('🌐 Domínio:', domain);
      console.log('🔗 Domínio completo:', fullDomain);
      console.log('📌 Lead ID:', leadId);
      console.log('⬅️ Status anterior:', previousStatusId);
      console.log('➡️ Novo status:', newStatusId);
      console.log('🔄 Pipeline ID:', pipelineId);
      console.log('⬅️ Pipeline anterior:', previousPipelineId);

      // Se temos um lead_id e account_id, vamos buscar detalhes do lead
      if (leadId && accountId) {
        // Buscar token de acesso para esta conta
        const token = await KommoToken.findOne({ where: { account_id: accountId } });
        if (!token) {
          console.error('❌ Token não encontrado para a conta:', accountId);
          throw new Error('Token não encontrado para esta conta');
        }

        // Verificar se o token está válido
        if (new Date(token.expires_at) <= new Date()) {
          console.log('🔄 Token expirado, tentando renovar...');
          const newTokens = await refreshKommoToken(token.refresh_token, token.domain);
          if (!newTokens) {
            throw new Error('Falha ao renovar token');
          }
          // Atualizar token no banco
          await token.update({
            access_token: newTokens.access_token,
            refresh_token: newTokens.refresh_token,
            expires_at: newTokens.expires_at
          });
        }

        // Buscar detalhes do lead
        const leadDetails = await getLeadDetails(fullDomain, token.access_token, leadId);
        console.log('🔄 Detalhes do Lead:', JSON.stringify(leadDetails, null, 2));

        // Buscar detalhes dos pipelines
        const pipelineDetails = await getPipelineDetails(fullDomain, token.access_token);
        console.log('🔄 Detalhes do Pipeline:', JSON.stringify(pipelineDetails, null, 2));

        // Buscar detalhes do usuário responsável
        let responsibleUserName = null;
        if (leadDetails.responsible_user_id) {
          const userDetails = await getUserDetails(fullDomain, token.access_token, leadDetails.responsible_user_id);
          if (userDetails) {
            responsibleUserName = userDetails.name;
            console.log(`👤 Nome do usuário responsável: ${responsibleUserName}`);
          }
        }

        // Encontrar informações do pipeline e status
        const currentPipeline = pipelineDetails[pipelineId];
        const currentStatus = currentPipeline?.stages?.[newStatusId];
        const previousStatus = currentPipeline?.stages?.[previousStatusId];

        // Encontrar o lead_situation nos custom_fields
        const leadSituationField = leadDetails.custom_fields_values?.find(
            field => field.field_name === "Situação do lead"
        );
        const leadSituation = leadSituationField?.values?.[0]?.value || null;

        // Extrair telefone dos contatos vinculados
        let phone = null;
        if (leadDetails._embedded && leadDetails._embedded.contacts) {
          const contacts = leadDetails._embedded.contacts;
          console.log(`👥 Contatos vinculados: ${contacts.length}`);
          
          for (let i = 0; i < contacts.length; i++) {
            const contact = contacts[i];
            const contactId = contact.id;
            const isMain = contact.is_main || false;
            console.log(`👤 Contato ${i+1}: ID=${contactId}, Principal=${isMain}`);
            
            if (contactId) {
              // Buscar detalhes do contato
              const contactDetails = await getContactDetails(fullDomain, token.access_token, contactId);
              if (contactDetails) {
                // Extrair telefone do contato
                phone = extractPhoneFromContact(contactDetails);
                if (phone) {
                  console.log(`📱 Telefone encontrado para o lead ${leadId}: ${phone}`);
                  break; // Parar após encontrar o primeiro telefone
                }
              }
            }
          }
        }

        // Verificar se o lead existe na tabela webhook_messages pelo telefone
        if (phone) {
          const existingMessage = await WebhookMessage.findOne({ 
            where: { telefone: phone }
          });
          
          if (!existingMessage) {
            console.log(`⚠️ Segurança: Lead com telefone ${phone} não encontrado na tabela webhook_messages, não processando webhook`);
            return res.json({
              success: false,
              message: 'Lead não registrado previamente através de formulário/webhook de mensagem'
            });
          }
          
          console.log(`✅ Lead com telefone ${phone} encontrado na tabela webhook_messages, prosseguindo com o processamento`);
        } else {
          console.log(`⚠️ Não foi possível extrair telefone do lead ${leadId}, verificando pelo lead_id em mensagens anteriores`);
          
          // Se não temos telefone, verificar se já registramos esse lead anteriormente
          const existingTracking = await LeadTracking.findOne({
            where: { lead_id: leadId.toString() },
            include: [{
              model: WebhookMessage,
              required: true // INNER JOIN - exige que exista na tabela WebhookMessage
            }]
          });
          
          if (!existingTracking) {
            console.log(`⚠️ Segurança: Lead com ID ${leadId} não tem registro prévio na tabela lead_tracking com webhook_message associado`);
            return res.json({
              success: false,
              message: 'Lead não registrado previamente através de formulário/webhook de mensagem'
            });
          }
          
          console.log(`✅ Lead com ID ${leadId} tem registro prévio na tabela lead_tracking com webhook_message associado`);
        }

        // Criar registro de rastreamento
        const leadTracking = await LeadTracking.create({
            lead_id: leadId.toString(),
            phone: phone || null,
            event_type: 'lead_status_changed',
            source_id: leadDetails.source_id || null,
            previous_pipeline_id: previousPipelineId?.toString() || null,
            previous_pipeline_name: currentPipeline?.name || null,
            previous_status_id: previousStatusId?.toString() || null,
            previous_status_name: previousStatus?.name || null,
            current_pipeline_id: pipelineId?.toString() || null,
            current_pipeline_name: currentPipeline?.name || null,
            current_status_id: newStatusId?.toString() || null,
            current_status_name: currentStatus?.name || null,
            lead_situation: leadSituation,
            price: leadDetails.price || null,
            responsible_user_id: leadDetails.responsible_user_id?.toString() || null,
            responsible_user_name: responsibleUserName || null
        });

        console.log('✅ Lead tracking criado com sucesso:', leadTracking.id);
        return res.json({
          success: true,
          message: 'Webhook processado com sucesso',
          data: leadTracking
        });
      }

      return res.json({
        success: true,
        message: 'Webhook recebido mas não processado (dados incompletos)'
      });
    } catch (error) {
      console.error('❌ Erro ao processar webhook:', error);
      return res.status(500).json({
        success: false,
        message: 'Erro ao processar webhook',
        error: error.message
      });
    }
  },

  /**
   * Busca os leads de um pipeline específico da tabela leadTracking
   * @param {Object} req - Requisição Express
   * @param {Object} res - Resposta Express
   */
  getPipelineLeadsFromTracking: async (req, res) => {
    try {
      const { pipelineId } = req.params;
      console.log(`Buscando leads do pipeline ${pipelineId} na tabela de tracking...`);

      // Buscar todos os registros do pipeline ordenados por event_time
      const leads = await LeadTracking.findAll({
        where: {
          current_pipeline_id: pipelineId.toString()
        },
        order: [['event_time', 'DESC']],
        include: [{
          model: WebhookMessage,
          required: false, // LEFT JOIN
          attributes: ['ad_name', 'adset_name', 'campaign_name']
        }]
      });
      console.log(`Encontrados ${leads.length} registros na tabela de tracking`);
      console.log('🔄 Leads encontrados:', JSON.stringify(leads, null, 2));

      // Primeiro, vamos criar um mapa com os dados mais antigos de cada lead
      const oldestLeadData = {};
      leads.forEach(lead => {
        // Se não temos dados para este lead ou se este registro é mais antigo
        if (!oldestLeadData[lead.lead_id] || 
            (lead.WebhookMessage && new Date(lead.event_time) < new Date(oldestLeadData[lead.lead_id].event_time))) {
          oldestLeadData[lead.lead_id] = {
            event_time: lead.event_time,
            ad_name: lead.WebhookMessage?.ad_name || null,
            adset_name: lead.WebhookMessage?.adset_name || null,
            campaign_name: lead.WebhookMessage?.campaign_name || null
          };
        }
      });

      console.log('📊 Dados mais antigos por lead:', JSON.stringify(oldestLeadData, null, 2));

      // Agora vamos agrupar os leads por status, usando os dados mais recentes mas com as informações de campanha mais antigas
      const leadsByStatus = {};
      const processedLeads = new Set();

      leads.forEach(lead => {
        // Se já processamos este lead, pular
        if (processedLeads.has(lead.lead_id)) {
          return;
        }

        // Marcar este lead como processado
        processedLeads.add(lead.lead_id);

        // Adicionar ao grupo do status atual
        const statusId = lead.current_status_id;
        if (!leadsByStatus[statusId]) {
          leadsByStatus[statusId] = [];
        }
        
        // Criar objeto com os dados do lead, incluindo as informações de campanha mais antigas
        const leadData = {
          lead_id: lead.lead_id,
          phone: lead.phone,
          lead_situation: lead.lead_situation,
          event_time: lead.event_time,
          ...oldestLeadData[lead.lead_id] // Incluir os dados de campanha mais antigos
        };
        
        leadsByStatus[statusId].push(leadData);
      });

      console.log('Leads agrupados por status:', JSON.stringify(leadsByStatus, null, 2));
      console.log(`Total de estágios com leads: ${Object.keys(leadsByStatus).length}`);

      return res.json({
        success: true,
        leads: leadsByStatus
      });
    } catch (error) {
      console.error('Erro ao buscar leads do pipeline:', error);
      return res.status(500).json({
        success: false,
        message: 'Erro ao buscar leads do pipeline',
        error: error.message
      });
    }
  }
};

module.exports = KommoController; 