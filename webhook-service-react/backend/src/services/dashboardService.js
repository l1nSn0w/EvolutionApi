const { Op } = require('sequelize');
const WebhookMessage = require('../models/WebhookMessage');
const LeadTracking = require('../models/LeadTracking');
const sequelize = require('../config/database');
const { Sequelize } = require('sequelize');

/**
 * Serviço para cálculos e métricas do dashboard
 */
const dashboardService = {
  /**
   * Obter métricas básicas de campanhas
   * @returns {Promise<Array>} Lista de métricas por campanha
   */
  getCampaignMetrics: async () => {
    try {
      return await WebhookMessage.findAll({
        attributes: [
          'campaign_name',
          'campaign_id',
          [sequelize.fn('COUNT', sequelize.col('id')), 'message_count']
        ],
        where: {
          campaign_id: {
            [Op.ne]: null
          }
        },
        group: ['campaign_name', 'campaign_id']
      });
    } catch (error) {
      console.error('Error in getCampaignMetrics:', error);
      throw error;
    }
  },

  /**
   * Obter análise de campanhas por situação
   * @returns {Promise<Array>} Lista de campanhas com contagem por situação
   */
  getCampaignsBySituation: async () => {
    try {
      return await LeadTracking.findAll({
        attributes: [
          'current_pipeline_name',
          'current_status_name',
          [sequelize.fn('COUNT', sequelize.col('id')), 'lead_count']
        ],
        where: {
          current_pipeline_name: {
            [Op.ne]: null
          }
        },
        group: ['current_pipeline_name', 'current_status_name']
      });
    } catch (error) {
      console.error('Error in getCampaignsBySituation:', error);
      throw error;
    }
  },

  /**
   * Obter mensagens com paginação
   * @param {Object} options - Opções de paginação
   * @param {number} options.page - Página atual
   * @param {number} options.limit - Limite por página
   * @returns {Promise<Object>} Mensagens paginadas com metadados
   */
  getMessages: async ({ page = 1, limit = 10 }) => {
    try {
      const offset = (page - 1) * limit;
      const messages = await WebhookMessage.findAndCountAll({
        limit: parseInt(limit),
        offset: parseInt(offset),
        order: [['created_at', 'DESC']],
        include: [{
          model: LeadTracking,
          attributes: ['lead_id', 'event_type', 'current_pipeline_name', 'current_status_name']
        }]
      });

      return {
        total: messages.count,
        pages: Math.ceil(messages.count / limit),
        currentPage: parseInt(page),
        messages: messages.rows
      };
    } catch (error) {
      console.error('Error in getMessages:', error);
      throw error;
    }
  },

  /**
   * Obter rastreamento de leads com paginação
   * @param {Object} options - Opções de paginação
   * @param {number} options.page - Página atual
   * @param {number} options.limit - Limite por página
   * @returns {Promise<Object>} Rastreamento de leads paginado com metadados
   */
  getLeadTracking: async ({ page = 1, limit = 10 }) => {
    try {
      const offset = (page - 1) * limit;
      const tracking = await LeadTracking.findAndCountAll({
        limit: parseInt(limit),
        offset: parseInt(offset),
        order: [['created_at', 'DESC']],
        include: [{
          model: WebhookMessage,
          attributes: ['telefone', 'nome', 'mensagem']
        }]
      });

      return {
        total: tracking.count,
        pages: Math.ceil(tracking.count / limit),
        currentPage: parseInt(page),
        tracking: tracking.rows
      };
    } catch (error) {
      console.error('Error in getLeadTracking:', error);
      throw error;
    }
  },

  /**
   * Obter métricas básicas das campanhas
   * Função simplificada que retorna apenas os dados essenciais das campanhas
   * @returns {Promise<Array>} Array com as métricas básicas de cada campanha
   */
  getCampaignBasicMetrics: async () => {
    try {
      console.log("Iniciando processamento de métricas básicas de campanhas...");
      
      // 1. Obter mensagens de webhook com campanhas
      const messages = await WebhookMessage.findAll({
        where: {
          campaign_id: {
            [Op.ne]: null
          }
        }
      });
      
      console.log(`Obtidas ${messages.length} mensagens de webhook com campanhas`);
      
      // 2. Obter TODOS os eventos de rastreamento 
      const events = await LeadTracking.findAll({
        include: [{
          model: WebhookMessage,
          attributes: ['campaign_id', 'campaign_name']
        }]
      });
      
      console.log(`Obtidos ${events.length} eventos de rastreamento`);
      
      // Registrar todos os eventos com situação COMPROU para debug
      const compraEvents = events.filter(event => event.lead_situation === 'COMPROU');
      console.log(`Eventos com COMPROU: ${compraEvents.length}`);
      compraEvents.forEach(event => {
        console.log(`  Lead: ${event.lead_id}, Message: ${event.message_id}, Preço: ${event.price}, Campanha: ${event.WebhookMessage?.campaign_id || 'N/A'}`);
      });
      
      // 3. Preparar estruturas de dados
      const campaignMap = {};
      const messageMap = {};
      const leadsByMessage = {};
      const eventsByLead = {};
      
      // Mapear mensagens por campanha e por ID
      messages.forEach(message => {
        const data = message.toJSON();
        // Mapear por campanha
        if (!campaignMap[data.campaign_id]) {
          campaignMap[data.campaign_id] = {
            campaign_id: data.campaign_id,
            campaign_name: data.campaign_name,
            total_leads: 0,
            converted_leads: 0,
            total_value: 0,
            conversion_times: [],
            discard_times: []
          };
        }
        
        // Mapear por ID para fácil acesso
        messageMap[data.id] = data;
      });
      
      // 4. Organizar eventos por lead e mensagem
      events.forEach(event => {
        const eventData = event.toJSON();
        
        // Organizar eventos por lead
        if (eventData.lead_id) {
          if (!eventsByLead[eventData.lead_id]) {
            eventsByLead[eventData.lead_id] = [];
          }
          eventsByLead[eventData.lead_id].push(eventData);
        }
        
        // Se for evento de mensagem recebida, registrar a mensagem 
        if (eventData.event_type === 'message_received' && eventData.message_id) {
          if (!leadsByMessage[eventData.message_id]) {
            leadsByMessage[eventData.message_id] = {
              lead_id: eventData.lead_id,
              converted: false,
              price: 0,
              first_event_time: new Date(eventData.event_time),
              conversion_time: null,
              discard_time: null,
              campaign_id: null
            };
            
            // Encontrar a qual campanha esta mensagem pertence
            const message = messageMap[eventData.message_id] || eventData.WebhookMessage;
            if (message && message.campaign_id) {
              leadsByMessage[eventData.message_id].campaign_id = message.campaign_id;
              // Incrementar contador de leads da campanha
              if (campaignMap[message.campaign_id]) {
                campaignMap[message.campaign_id].total_leads++;
              }
            }
          }
        }
      });
      
      console.log(`Leads organizados por mensagem: ${Object.keys(leadsByMessage).length}`);
      
      // 5. Processar eventos de conversão para cada lead
      Object.keys(eventsByLead).forEach(leadId => {
        const leadEvents = eventsByLead[leadId];
        
        // Ordenar eventos por data
        leadEvents.sort((a, b) => new Date(a.event_time) - new Date(b.event_time));
        
        const firstEvent = leadEvents[0];
        const firstEventTime = new Date(firstEvent.event_time);
        
        // Buscar eventos de COMPROU
        const boughtEvents = leadEvents.filter(e => e.lead_situation === 'COMPROU');
        
        // Se encontrou evento de compra para este lead
        if (boughtEvents.length > 0) {
          // Encontrar o evento de compra com melhor preço
          const eventWithBestPrice = boughtEvents.reduce((best, current) => {
            const currentPrice = current.price ? parseFloat(current.price) : 0;
            const bestPrice = best.price ? parseFloat(best.price) : 0;
            return currentPrice > bestPrice ? current : best;
          }, boughtEvents[0]);
          
          // Extrair informações do evento de compra
          const price = eventWithBestPrice.price ? parseFloat(eventWithBestPrice.price) : 0;
          const conversionTime = new Date(eventWithBestPrice.event_time);
          
          // Tentar encontrar a mensagem associada a este lead
          const messageEntries = Object.entries(leadsByMessage).filter(([_, lead]) => lead.lead_id === leadId);
          
          if (messageEntries.length > 0) {
            // Para cada mensagem associada a este lead
            messageEntries.forEach(([messageId, lead]) => {
              // Atualizar informações do lead
              lead.converted = true;
              lead.price = price;
              lead.conversion_time = conversionTime;
              
              // Se temos a campanha, atualizar suas métricas
              if (lead.campaign_id && campaignMap[lead.campaign_id]) {
                const campaign = campaignMap[lead.campaign_id];
                
                // Incrementar contadores de conversão
                campaign.converted_leads++;
                campaign.total_value += price;
                
                // Calcular tempo de conversão
                const conversionTimeMs = conversionTime - lead.first_event_time;
                if (conversionTimeMs > 0) {
                  campaign.conversion_times.push(conversionTimeMs);
                }
                
                console.log(`Conversão registrada para campanha ${lead.campaign_id}: Lead ${leadId}, Valor ${price}`);
              }
            });
          } else {
            // Este lead não tem mensagem associada, mas tem evento de compra
            // Tentar usar o WebhookMessage do próprio evento para registrar
            const messageId = eventWithBestPrice.message_id;
            const campaignId = eventWithBestPrice.WebhookMessage?.campaign_id;
            
            if (messageId && campaignId && campaignMap[campaignId]) {
              console.log(`Conversão sem lead mapeado: Message ${messageId}, Lead ${leadId}, Campanha ${campaignId}`);
              
              // Registrar a conversão diretamente
              campaignMap[campaignId].converted_leads++;
              campaignMap[campaignId].total_value += price;
              
              // Sem calcular tempo de conversão, pois não temos o evento inicial
            }
          }
        }
        
        // Processar eventos de descarte (lead_situation não nulo e diferente de COMPROU)
        const discardEvents = leadEvents.filter(e => e.lead_situation && e.lead_situation !== 'COMPROU');
        
        if (discardEvents.length > 0 && boughtEvents.length === 0) {
          // Lead descartado (não convertido)
          const latestDiscardEvent = discardEvents[discardEvents.length - 1];
          const discardTime = new Date(latestDiscardEvent.event_time);
          
          // Encontrar mensagens associadas a este lead
          const messageEntries = Object.entries(leadsByMessage).filter(([_, lead]) => lead.lead_id === leadId);
          
          messageEntries.forEach(([messageId, lead]) => {
            // Atualizar informação de descarte
            lead.discard_time = discardTime;
            
            // Se temos a campanha, atualizar suas métricas
            if (lead.campaign_id && campaignMap[lead.campaign_id]) {
              // Calcular tempo de descarte
              const discardTimeMs = discardTime - lead.first_event_time;
              if (discardTimeMs > 0) {
                campaignMap[lead.campaign_id].discard_times.push(discardTimeMs);
              }
            }
          });
        }
      });
      
      // 6. Processar dados finais e preparar resposta
      const calculateAverage = (times) => {
        if (!times || times.length === 0) return null;
        const total = times.reduce((sum, time) => sum + time, 0);
        return Math.round(total / times.length);
      };
      
      const campaigns = Object.values(campaignMap).map(campaign => {
        // Calcular taxa de conversão
        const conversion_rate = campaign.total_leads > 0 
          ? (campaign.converted_leads / campaign.total_leads) * 100 
          : 0;
        
        return {
          campaign_id: campaign.campaign_id,
          campaign_name: campaign.campaign_name,
          total_leads: campaign.total_leads,
          converted_leads: campaign.converted_leads,
          total_value: campaign.total_value,
          conversion_rate: parseFloat(conversion_rate.toFixed(2)),
          average_conversion_time: calculateAverage(campaign.conversion_times),
          average_discard_time: calculateAverage(campaign.discard_times)
        };
      });
      
      console.log("Métricas de campanha finalizadas:", campaigns.map(c => ({
        campaign_name: c.campaign_name, 
        total_leads: c.total_leads, 
        converted_leads: c.converted_leads
      })));
      
      return campaigns;
      
    } catch (error) {
      console.error('Erro ao obter métricas básicas de campanhas:', error);
      return { error: error.message };
    }
  },

  /**
   * Obter apenas métricas de campanhas
   * Versão simplificada da função getAdMetrics que retorna apenas dados de campanhas
   * @returns {Promise<Object>} Métricas de campanhas
   */
  getCampaignOnlyMetrics: async () => {
    try {
      console.log("Starting campaign-only metrics processing...");
      
      // 1. Obter todas as mensagens de webhook relacionadas a campanhas
      const webhookMessages = await WebhookMessage.findAll({
        where: {
          campaign_id: {
            [Op.ne]: null
          }
        }
      });
      
      console.log(`Retrieved ${webhookMessages.length} webhook messages`);
      
      // 2. Obter todos os eventos de rastreamento
      const trackingEvents = await LeadTracking.findAll({
        include: [{
          model: WebhookMessage,
          attributes: ['campaign_id', 'campaign_name', 'adset_id', 'adset_name', 'ad_name']
        }]
      });
      
      console.log(`Retrieved ${trackingEvents.length} tracking events`);
      
      // 3. Preparar estruturas de dados
      const campaignMetrics = {};
      const leadsByMessage = {};
      const eventsByLead = {};
      
      // Função auxiliar para limpar nomes de usuários (remover 'undefined')
      const cleanUserName = (userName) => {
        if (!userName) return null;
        return userName.replace(/\s+undefined$/, '').trim();
      };

      // 4. Organizar eventos por lead
      trackingEvents.forEach(event => {
        const eventData = event.toJSON();
        
        // Inicializar eventos por lead se necessário
        if (!eventsByLead[eventData.lead_id]) {
          eventsByLead[eventData.lead_id] = [];
        }
        
        // Adicionar evento à lista do lead
        eventsByLead[eventData.lead_id].push(eventData);
        
        // Se for um evento de mensagem recebida, registramos o lead
        if (eventData.event_type === 'message_received' && eventData.message_id) {
          if (!leadsByMessage[eventData.message_id]) {
            leadsByMessage[eventData.message_id] = {
              lead_id: eventData.lead_id,
              phone: eventData.phone,
              converted: false,
              price: 0,
              first_event_time: new Date(eventData.event_time),
              last_event_time: new Date(eventData.event_time),
              last_stage: eventData.current_status_name,
              farthest_stage: eventData.current_status_name,
              lost_reason: null,
              responsible_user_name: cleanUserName(eventData.responsible_user_name) || null,
              attended_by: new Set(),
              message_data: eventData.WebhookMessage || null
            };
          }
        }
      });

      // 5. Processar dados de cada lead
      for (const messageId in leadsByMessage) {
        const lead = leadsByMessage[messageId];
        const leadId = lead.lead_id;
        
        if (eventsByLead[leadId]) {
          // Atualizar última data do evento
          lead.last_event_time = new Date(
            Math.max(...eventsByLead[leadId].map(e => new Date(e.event_time)))
          );
          
          // Encontrar último evento de mudança de status - este será tanto o último estágio quanto o mais distante
          const lastStatusEvent = eventsByLead[leadId]
            .filter(e => e.event_type === 'lead_status_changed' && e.current_status_name)
            .sort((a, b) => new Date(b.event_time) - new Date(a.event_time))[0];
          
          if (lastStatusEvent) {
            lead.last_stage = lastStatusEvent.current_status_name;
            lead.farthest_stage = lastStatusEvent.current_status_name; // O último é também o mais distante cronologicamente
          }
          
          // Encontrar último responsável
          const lastResponsible = eventsByLead[leadId]
            .filter(e => e.event_type === 'lead_status_changed' && e.responsible_user_name)
            .sort((a, b) => new Date(b.event_time) - new Date(a.event_time))[0];
          
          lead.responsible_user_name = cleanUserName(lastResponsible?.responsible_user_name) || lead.responsible_user_name;
          
          // Registrar todos os usuários que atenderam
          eventsByLead[leadId].forEach(e => {
            if (e.responsible_user_name) {
              lead.attended_by.add(cleanUserName(e.responsible_user_name));
            }
          });
          
          // Verificar se tem lead_situation de COMPROU
          const boughtEvent = eventsByLead[leadId].find(e => e.lead_situation === 'COMPROU');
          if (boughtEvent) {
            lead.converted = true;
            lead.price = boughtEvent.price ? parseFloat(boughtEvent.price) : (eventsByLead[leadId].find(e => e.lead_situation === 'COMPROU' && e.price)?.price || 0);
            lead.conversion_time = new Date(boughtEvent.event_time);
          }
          
          // Verificar se tem lost_reason
          const lostEvent = eventsByLead[leadId]
            .filter(e => e.lead_situation && e.lead_situation !== 'COMPROU')
            .sort((a, b) => new Date(b.event_time) - new Date(a.event_time))[0];
          
          if (lostEvent) {
            lead.lost_reason = lostEvent.lead_situation;
            lead.discard_time = new Date(lostEvent.event_time);
          }
        }
      }
      
      // 6. Processar métricas por campanha
      trackingEvents.forEach(event => {
        const eventData = event.toJSON();
        const message = eventData.WebhookMessage;
        
        // Apenas processar eventos com message_id e do tipo message_received
        if (eventData.event_type !== 'message_received' || !message || !eventData.message_id) {
          return;
        }
        
        // Processar métricas por campanha
        if (message.campaign_id) {
          if (!campaignMetrics[message.campaign_id]) {
            campaignMetrics[message.campaign_id] = {
              campaign_id: message.campaign_id,
              campaign_name: message.campaign_name,
              total_leads: 0,
              converted_leads: 0,
              total_value: 0,
              lost_reasons: {},
              in_progress: 0,
              stage_distribution: {},
              stage_reached_distribution: {},
              top_users: {},
              conversion_times: [],
              discard_times: []
            };
          }
          
          // Incrementar total de leads
          campaignMetrics[message.campaign_id].total_leads++;
          
          // Verificar se o lead foi convertido
          const lead = leadsByMessage[eventData.message_id];
          if (lead) {
            // Registrar distribuição de estágios alcançados
            if (lead.farthest_stage) {
              if (!campaignMetrics[message.campaign_id].stage_reached_distribution[lead.farthest_stage]) {
                campaignMetrics[message.campaign_id].stage_reached_distribution[lead.farthest_stage] = 0;
              }
              campaignMetrics[message.campaign_id].stage_reached_distribution[lead.farthest_stage]++;
            }
            
            if (lead.converted) {
              campaignMetrics[message.campaign_id].converted_leads++;
              campaignMetrics[message.campaign_id].total_value += lead.price;
              
              // Adicionar tempo de conversão
              if (lead.conversion_time) {
                const conversionTimeMs = lead.conversion_time - lead.first_event_time;
                campaignMetrics[message.campaign_id].conversion_times.push(conversionTimeMs);
              }
              
              // Registrar usuários que atenderam o lead
              lead.attended_by.forEach(userName => {
                const cleanedUserName = cleanUserName(userName);
                if (!campaignMetrics[message.campaign_id].top_users[cleanedUserName]) {
                  campaignMetrics[message.campaign_id].top_users[cleanedUserName] = {
                    name: cleanedUserName,
                    attended: 0,
                    converted: 0,
                    total_value: 0,
                    leads_attended: new Set() // Conjunto para rastrear leads únicos
                  };
                }
                campaignMetrics[message.campaign_id].top_users[cleanedUserName].attended++;
                // Adiciona o lead_id ao conjunto de leads atendidos
                campaignMetrics[message.campaign_id].top_users[cleanedUserName].leads_attended.add(lead.lead_id);
              });
            } else if (lead.lost_reason) {
              // Registrar motivo de perda
              if (!campaignMetrics[message.campaign_id].lost_reasons[lead.lost_reason]) {
                campaignMetrics[message.campaign_id].lost_reasons[lead.lost_reason] = 0;
              }
              campaignMetrics[message.campaign_id].lost_reasons[lead.lost_reason]++;
              
              // Adicionar tempo até descarte
              if (lead.discard_time) {
                const discardTimeMs = lead.discard_time - lead.first_event_time;
                campaignMetrics[message.campaign_id].discard_times.push(discardTimeMs);
              }
            } else {
              // Lead em andamento
              campaignMetrics[message.campaign_id].in_progress++;
              
              // Registrar distribuição de estágios
              if (lead.last_stage) {
                if (!campaignMetrics[message.campaign_id].stage_distribution[lead.last_stage]) {
                  campaignMetrics[message.campaign_id].stage_distribution[lead.last_stage] = 0;
                }
                campaignMetrics[message.campaign_id].stage_distribution[lead.last_stage]++;
              }
            }
          }
        }
      });
      
      // 7. Funções auxiliares para cálculos
      
      // Calcular tempo médio de conversão
      const calculateAverageConversionTime = (conversionTimes) => {
        if (!conversionTimes || conversionTimes.length === 0) return null;
        const totalTime = conversionTimes.reduce((sum, time) => sum + time, 0);
        return Math.round(totalTime / conversionTimes.length);
      };

      // Calcular tempo médio de descarte
      const calculateAverageDiscardTime = (discardTimes) => {
        if (!discardTimes || discardTimes.length === 0) return null;
        const totalTime = discardTimes.reduce((sum, time) => sum + time, 0);
        return Math.round(totalTime / discardTimes.length);
      };
      
      // Encontrar estágio mais comum
      const findMostCommonLastStage = (stageDistribution) => {
        if (Object.keys(stageDistribution).length === 0) return null;
        
        return Object.entries(stageDistribution)
          .sort((a, b) => b[1] - a[1])[0][0];
      };
      
      // Encontrar estágio mais distante alcançado
      const findFarthestStageReached = (stageReachedDistribution) => {
        if (Object.keys(stageReachedDistribution).length === 0) return null;
        
        // Simplesmente retornar o estágio mais comum (com maior contagem)
        return Object.entries(stageReachedDistribution)
          .sort((a, b) => b[1] - a[1])[0][0];
      };
      
      // Converter top_users de objeto para array
      const convertTopUsersToArray = (topUsers) => {
        return Object.values(topUsers)
          .map(user => {
            // Calcular o número real de leads atendidos pelo tamanho do conjunto
            const attended = user.leads_attended ? user.leads_attended.size : user.attended;
            
            // Calcular taxa de conversão
            const conversion_rate = attended > 0 
              ? (user.converted / attended) * 100 
              : 0;
            
            // Calcular ticket médio
            const average_ticket = user.converted > 0 
              ? user.total_value / user.converted 
              : 0;
            
            return {
              name: user.name,
              attended: attended,
              converted: user.converted,
              total_value: user.total_value,
              conversion_rate: parseFloat(conversion_rate.toFixed(2)),
              average_ticket: parseFloat(average_ticket.toFixed(2))
            };
          })
          .sort((a, b) => {
            // Primeiro por conversões
            if (b.converted !== a.converted) {
              return b.converted - a.converted;
            }
            // Depois por atendimentos
            return b.attended - a.attended;
          })
          .slice(0, 5); // Top 5 usuários
      };
      
      // Coletar dados detalhados de leads para cada campanha
      const collectLeadDetailsForCampaign = (campaignId) => {
        const leads = [];
        
        Object.keys(leadsByMessage).forEach(messageId => {
          const lead = leadsByMessage[messageId];
          
          if (lead.message_data && lead.message_data.campaign_id === campaignId) {
            leads.push({
              lead_id: lead.lead_id,
              phone: lead.phone,
              stage: lead.last_stage,
              farthest_stage: lead.farthest_stage,
              responsible_user: lead.responsible_user_name,
              ad_name: lead.message_data.ad_name,
              message_id: messageId
            });
          }
        });
        
        return leads;
      };
      
      // 8. Preparar resposta final com apenas dados de campanhas
      const campaigns = Object.values(campaignMetrics).map(metric => {
        // Calcular taxa de conversão
        const conversion_rate = metric.total_leads > 0 
          ? (metric.converted_leads / metric.total_leads) * 100 
          : 0;
        
        // Calcular tempo médio de conversão
        const average_conversion_time = calculateAverageConversionTime(metric.conversion_times);
        
        // Calcular tempo médio até descarte
        const average_discard_time = calculateAverageDiscardTime(metric.discard_times);
        
        // Encontrar estágio mais comum
        const most_common_last_stage = findMostCommonLastStage(metric.stage_distribution);
        
        // Encontrar estágio mais distante alcançado
        const farthest_stage_reached = findFarthestStageReached(metric.stage_reached_distribution);
        
        // Converter top_users para array
        const top_users = convertTopUsersToArray(metric.top_users);
        
        // Coletar informações detalhadas dos leads
        const lead_details = collectLeadDetailsForCampaign(metric.campaign_id);
        
        return {
          campaign_id: metric.campaign_id,
          campaign_name: metric.campaign_name,
          total_leads: metric.total_leads,
          converted_leads: metric.converted_leads,
          total_value: metric.total_value,
          lost_reasons: metric.lost_reasons,
          in_progress: metric.in_progress,
          stage_distribution: metric.stage_distribution,
          stage_reached_distribution: metric.stage_reached_distribution,
          conversion_rate: parseFloat(conversion_rate.toFixed(2)),
          average_conversion_time,
          average_discard_time,
          most_common_last_stage,
          farthest_stage_reached,
          top_users,
         // lead_details
        };
      });
      
      // Adicionar diagnóstico de mensagens sem tracking
      const messagesWithoutTracking = [];
      webhookMessages.forEach(message => {
        const messageData = message.toJSON();
        const messageId = messageData.id;
        
        const hasTracking = Object.keys(leadsByMessage).some(id => 
          parseInt(id) === messageId || id === messageId.toString()
        );
        
        if (!hasTracking && messageData.campaign_id) {
          messagesWithoutTracking.push({
            message_id: messageId,
            phone: messageData.telefone,
            name: messageData.nome,
            message: messageData.mensagem,
            campaign_name: messageData.campaign_name,
            campaign_id: messageData.campaign_id,
            date_time: messageData.date_time
          });
        }
      });
      
      // 9. Retornar apenas os dados relacionados a campanhas
      return {
        campaigns,
        total_campaigns: campaigns.length,
        diagnostics: {
          messagesWithoutTracking
        }
      };
      
    } catch (error) {
      console.error('Error fetching campaign metrics:', error);
      return { error: error.message };
    }
  },

  /**
   * Obter métricas de anúncios para o dashboard
   * Versão extraída da rota /dashboard/ad-metrics
   * @returns {Promise<Object>} Métricas de campanhas, conjuntos de anúncios e anúncios
   */
  getAdMetrics: async () => {
    try {
      // Add debug logging
      console.log("Starting ad-metrics processing...");
      
      // 0. Obter todas as mensagens de webhook (inclusive as que não têm eventos de tracking ainda)
      const webhookMessages = await WebhookMessage.findAll({
        where: {
          campaign_id: {
            [Op.ne]: null
          }
        }
      });
      
      console.log(`Retrieved ${webhookMessages.length} webhook messages`);
      
      // 1. Obter todos os eventos de rastreamento
      const trackingEvents = await LeadTracking.findAll({
        include: [{
          model: WebhookMessage,
          attributes: ['campaign_id', 'campaign_name', 'adset_id', 'adset_name', 'ad_name']
        }]
      });
      
      console.log(`Retrieved ${trackingEvents.length} tracking events`);
      
      // Log some sample data to verify relationships
      if (trackingEvents.length > 0) {
        const sampleEvents = trackingEvents.slice(0, Math.min(5, trackingEvents.length));
        console.log("Sample tracking events with webhook messages:");
        sampleEvents.forEach((event, i) => {
          const eventData = event.toJSON();
          console.log(`Event ${i+1}:`, {
            id: eventData.id,
            message_id: eventData.message_id,
            lead_id: eventData.lead_id,
            event_type: eventData.event_type,
            WebhookMessage: eventData.WebhookMessage
          });
        });
      }
      
      // 2. Processar os eventos para obter métricas
      const campaignMetrics = {};
      const adSetMetrics = {};
      const adMetrics = {};
      
      // Mapa para rastrear leads por message_id
      const leadsByMessage = {};
      
      // Mapa para rastrear conversões por lead_id
      const conversionsByLead = {};
      
      // Mapa para rastrear eventos por lead_id
      const eventsByLead = {};
      
      // Mapa para rastrear usuários responsáveis
      const usersByLead = {};
      
      // Mapa para rastrear descartes por lead_id
      const discardsByLead = {};
      
      // Mapa para rastrear o último usuário responsável por lead
      const leadToUser = {};
      
      // Função auxiliar para limpar nomes de usuários (remover 'undefined')
      const cleanUserName = (userName) => {
        if (!userName) return null;
        return userName.replace(/\s+undefined$/, '').trim();
      };

      // Primeiro, vamos identificar todos os leads e suas mensagens originais
      trackingEvents.forEach(event => {
        const eventData = event.toJSON();
        
        // Inicializar eventos por lead se necessário
        if (!eventsByLead[eventData.lead_id]) {
          eventsByLead[eventData.lead_id] = [];
        }
        
        // Adicionar evento à lista do lead
        eventsByLead[eventData.lead_id].push(eventData);
        
        // Se for um evento de mensagem recebida, registramos o lead
        if (eventData.event_type === 'message_received' && eventData.message_id) {
          // Log which message is being processed
          console.log(`Registering lead for message_id: ${eventData.message_id}, lead_id: ${eventData.lead_id}`);
          
          if (!leadsByMessage[eventData.message_id]) {
            leadsByMessage[eventData.message_id] = {
              lead_id: eventData.lead_id,
              phone: eventData.phone,
              converted: false,
              price: 0,
              first_event_time: new Date(eventData.event_time),
              last_event_time: new Date(eventData.event_time),
              last_stage: eventData.current_status_name,
              farthest_stage: eventData.current_status_name,
              lost_reason: null,
              responsible_user_name: cleanUserName(eventData.responsible_user_name) || null,
              attended_by: new Set(),
              // Add a reference to the message data for easier lookup
              message_data: eventData.WebhookMessage || null
            };
          }
        }
      });
        
      // Agora que temos todos os eventos agrupados por lead, fazemos a correção para last_stage, farthest_stage e responsible_user
        for (const messageId in leadsByMessage) {
        const lead = leadsByMessage[messageId];
        const leadId = lead.lead_id;
        
        if (eventsByLead[leadId]) {
          // Atualizamos a última data do evento
          lead.last_event_time = new Date(
            Math.max(...eventsByLead[leadId].map(e => new Date(e.event_time)))
          );
          
          // 1. CORREÇÃO: Estágio final (last_stage) - usar apenas o último evento lead_status_changed
          const lastStatusEvent = eventsByLead[leadId]
            .filter(e => e.event_type === 'lead_status_changed' && e.current_status_name)
            .sort((a, b) => new Date(b.event_time) - new Date(a.event_time))[0];
          
          lead.last_stage = lastStatusEvent?.current_status_name || lead.last_stage;
          
          // 2. CORREÇÃO: Estágio mais distante (farthest_stage) - analisar todos os estágios
          const allStages = eventsByLead[leadId]
            .map(e => e.current_status_name)
            .filter(Boolean);
          
              // Definir ordem dos estágios para determinar qual é o mais avançado
              const stageOrder = {
                'etapa de leads reorganizados': 1,
                '1° ATENDIMENTO(MANHÃ)': 2,
                '1º ATENDIMENTO(TARDE)': 3,
                '2° ATENDIMENTO': 4,
                '3° ATENDIMENTO': 5,
                'AGENDADO': 6,
                'LEAD QUENTE': 6,
                'ASSISTÊNCIA': 7,
                'GARANTIA': 7,
                'LEAD DESCARTADO': 8,
                'LEAD CONVERTIDO': 9
              };
              
          // Priorização quando os estágios têm o mesmo valor numérico
          const stagePriority = {
            'LEAD QUENTE': 1,      // Priorizar Lead Quente sobre Agendado
                  'AGENDADO': 2,      
            'GARANTIA': 1,         // Priorizar Garantia sobre Assistência
                  'ASSISTÊNCIA': 2    
                };
                
          // Função para determinar o estágio mais avançado
          const getMostAdvancedStage = (stages) => {
            if (!stages || stages.length === 0) return null;
            
            let highestOrder = -1;
            let mostAdvancedStage = null;
            
            stages.forEach(stage => {
              const order = stageOrder[stage] || 0;
              
              if (order > highestOrder) {
                highestOrder = order;
                mostAdvancedStage = stage;
              } 
              else if (order === highestOrder && mostAdvancedStage) {
                const currentPriority = stagePriority[stage] || 999;
                const existingPriority = stagePriority[mostAdvancedStage] || 999;
                
                // Número menor significa maior prioridade
                if (currentPriority < existingPriority) {
                  mostAdvancedStage = stage;
                }
              }
            });
            
            return mostAdvancedStage;
          };
          
          lead.farthest_stage = getMostAdvancedStage(allStages) || lead.farthest_stage;
          
          // 3. CORREÇÃO: Responsável (responsible_user_name) - usar o último evento com responsável
          const lastResponsible = eventsByLead[leadId]
            .filter(e => e.event_type === 'lead_status_changed' && e.responsible_user_name)
            .sort((a, b) => new Date(b.event_time) - new Date(a.event_time))[0];
          
          lead.responsible_user_name = cleanUserName(lastResponsible?.responsible_user_name) || lead.responsible_user_name;
          
          // Registrar todos os usuários que atenderam
          eventsByLead[leadId].forEach(e => {
            if (e.responsible_user_name) {
              lead.attended_by.add(cleanUserName(e.responsible_user_name));
            }
          });
          
          // Verificar se tem lead_situation de COMPROU
          const boughtEvent = eventsByLead[leadId].find(e => e.lead_situation === 'COMPROU');
          if (boughtEvent) {
            lead.converted = true;
            lead.price = boughtEvent.price ? parseFloat(boughtEvent.price) : (eventsByLead[leadId].find(e => e.lead_situation === 'COMPROU' && e.price)?.price || 0);
            lead.conversion_time = new Date(boughtEvent.event_time);
            
            // Adicionar log para depuração
            console.log(`CONVERSÃO DETECTADA - Lead ID: ${leadId}, Message ID: ${messageId}, Price: ${lead.price}`);
          }
          
          // Verificar se tem lost_reason
          const lostEvent = eventsByLead[leadId]
            .filter(e => e.lead_situation && e.lead_situation !== 'COMPROU')
            .sort((a, b) => new Date(b.event_time) - new Date(a.event_time))[0];
          
          if (lostEvent) {
            lead.lost_reason = lostEvent.lead_situation;
            lead.discard_time = new Date(lostEvent.event_time);
          }
        }
      }
      
      // Log para debugging
      console.log("Leads processados com estágios atualizados:");
      for (const messageId in leadsByMessage) {
        console.log(`Message ${messageId}, Lead ${leadsByMessage[messageId].lead_id}:`, {
          farthest_stage: leadsByMessage[messageId].farthest_stage,
          responsible_user: leadsByMessage[messageId].responsible_user_name,
          attended_by: Array.from(leadsByMessage[messageId].attended_by),
          converted: leadsByMessage[messageId].converted,
          lost_reason: leadsByMessage[messageId].lost_reason
        });
      }
  
      // Log the collected message data for verification
      console.log("Leads by message:", Object.keys(leadsByMessage).map(key => ({
        message_id: key,
        lead_id: leadsByMessage[key].lead_id,
        message_data: leadsByMessage[key].message_data ? 
          { ad_name: leadsByMessage[key].message_data.ad_name } : null
      })));
  
      // Agora, vamos processar as métricas por campanha, conjunto de anúncios e anúncio
      // First pass: Process only message_received events with WebhookMessage data
      
      // Rastrear quais leads foram atendidos por quais usuários para evitar contagem duplicada
      const userLeadMap = {};

      
      
      trackingEvents.forEach(event => {
        const eventData = event.toJSON();
        const message = eventData.WebhookMessage;
        
        // Only process events that have a message_id and are message_received type
        if (eventData.event_type !== 'message_received' || !message || !eventData.message_id) {
          return;
        }
        
        console.log(`Processing event for message_id: ${eventData.message_id}, ad: ${message.ad_name || 'N/A'}`);
        
        // Processar métricas por campanha
        if (message.campaign_id) {
          if (!campaignMetrics[message.campaign_id]) {
            campaignMetrics[message.campaign_id] = {
              campaign_id: message.campaign_id,
              campaign_name: message.campaign_name,
              total_leads: 0,
              converted_leads: 0,
              total_value: 0,
              lost_reasons: {},
              in_progress: 0,
              stage_distribution: {},
              stage_reached_distribution: {},
              top_users: {},
              conversion_times: [],
              discard_times: []
            };
          }
          
          // Incrementar total de leads
          campaignMetrics[message.campaign_id].total_leads++;
          
          // Verificar se o lead foi convertido
          const lead = leadsByMessage[eventData.message_id];
          if (lead) {
          // Registrar distribuição de estágios alcançados
          if (lead.farthest_stage) {
            if (!campaignMetrics[message.campaign_id].stage_reached_distribution[lead.farthest_stage]) {
              campaignMetrics[message.campaign_id].stage_reached_distribution[lead.farthest_stage] = 0;
            }
            campaignMetrics[message.campaign_id].stage_reached_distribution[lead.farthest_stage]++;
          }
          
          if (lead.converted) {
            campaignMetrics[message.campaign_id].converted_leads++;
            campaignMetrics[message.campaign_id].total_value += lead.price;
            
            // Adicionar tempo de conversão
            if (lead.conversion_time) {
              const conversionTimeMs = lead.conversion_time - lead.first_event_time;
              campaignMetrics[message.campaign_id].conversion_times.push(conversionTimeMs);
            }
              
              // Registrar usuários que atenderam o lead
              lead.attended_by.forEach(userName => {
                const cleanedUserName = cleanUserName(userName);
                if (!campaignMetrics[message.campaign_id].top_users[cleanedUserName]) {
                  campaignMetrics[message.campaign_id].top_users[cleanedUserName] = {
                    name: cleanedUserName,
                    attended: 0,
                    converted: 0,
                    total_value: 0,
                    leads_attended: new Set() // Conjunto para rastrear leads únicos
                  };
                }
                campaignMetrics[message.campaign_id].top_users[cleanedUserName].attended++;
                // Adiciona o lead_id ao conjunto de leads atendidos
                campaignMetrics[message.campaign_id].top_users[cleanedUserName].leads_attended.add(lead.lead_id);
              });
            
            // Registrar usuário responsável pelo lead
            if (leadToUser[lead.lead_id]) {
              const userName = cleanUserName(leadToUser[lead.lead_id]);
              if (!campaignMetrics[message.campaign_id].top_users[userName]) {
                campaignMetrics[message.campaign_id].top_users[userName] = {
                  name: userName,
                  attended: 0,
                  converted: 0,
                  total_value: 0,
                  leads_attended: new Set() // Conjunto para rastrear leads únicos
                };
              }
              campaignMetrics[message.campaign_id].top_users[userName].attended++;
              // Adiciona o lead_id ao conjunto de leads atendidos
              campaignMetrics[message.campaign_id].top_users[userName].leads_attended.add(lead.lead_id);
              
              if (lead.converted) {
                campaignMetrics[message.campaign_id].top_users[userName].converted++;
                campaignMetrics[message.campaign_id].top_users[userName].total_value += lead.price;
              }
            }
          } else if (lead.lost_reason) {
            // Registrar motivo de perda
            if (!campaignMetrics[message.campaign_id].lost_reasons[lead.lost_reason]) {
              campaignMetrics[message.campaign_id].lost_reasons[lead.lost_reason] = 0;
            }
            campaignMetrics[message.campaign_id].lost_reasons[lead.lost_reason]++;
            
            // Adicionar tempo até descarte
            if (lead.discard_time) {
              const discardTimeMs = lead.discard_time - lead.first_event_time;
              campaignMetrics[message.campaign_id].discard_times.push(discardTimeMs);
            }
          } else {
            // Lead em andamento
            campaignMetrics[message.campaign_id].in_progress++;
            
            // Registrar distribuição de estágios
            if (lead.last_stage) {
              if (!campaignMetrics[message.campaign_id].stage_distribution[lead.last_stage]) {
                campaignMetrics[message.campaign_id].stage_distribution[lead.last_stage] = 0;
              }
              campaignMetrics[message.campaign_id].stage_distribution[lead.last_stage]++;
              }
            }
          }
        }
        
        // Processar métricas por conjunto de anúncios
        if (message.adset_id) {
          if (!adSetMetrics[message.adset_id]) {
            adSetMetrics[message.adset_id] = {
              adset_id: message.adset_id,
              adset_name: message.adset_name,
              total_leads: 0,
              converted_leads: 0,
              total_value: 0,
              lost_reasons: {},
              in_progress: 0,
              stage_distribution: {},
              stage_reached_distribution: {},
              top_users: {},
              conversion_times: [],
              discard_times: []
            };
          }
          
          // Incrementar total de leads
          adSetMetrics[message.adset_id].total_leads++;
          
          // Verificar se o lead foi convertido
          const lead = leadsByMessage[eventData.message_id];
          if (lead) {
            // Registrar distribuição de estágios alcançados
            if (lead.farthest_stage) {
              if (!adSetMetrics[message.adset_id].stage_reached_distribution[lead.farthest_stage]) {
                adSetMetrics[message.adset_id].stage_reached_distribution[lead.farthest_stage] = 0;
              }
              adSetMetrics[message.adset_id].stage_reached_distribution[lead.farthest_stage]++;
            }
            
            if (lead.converted) {
              adSetMetrics[message.adset_id].converted_leads++;
              adSetMetrics[message.adset_id].total_value += lead.price;
              
              // Adicionar tempo de conversão
              if (lead.conversion_time) {
                const conversionTimeMs = lead.conversion_time - lead.first_event_time;
                adSetMetrics[message.adset_id].conversion_times.push(conversionTimeMs);
              }
              
              // Registrar usuários que atenderam o lead
              lead.attended_by.forEach(userName => {
                const cleanedUserName = cleanUserName(userName);
                if (!adSetMetrics[message.adset_id].top_users[cleanedUserName]) {
                  adSetMetrics[message.adset_id].top_users[cleanedUserName] = {
                    name: cleanedUserName,
                    attended: 0,
                    converted: 0,
                    total_value: 0,
                    leads_attended: new Set() // Conjunto para rastrear leads únicos
                  };
                }
                adSetMetrics[message.adset_id].top_users[cleanedUserName].attended++;
                // Adiciona o lead_id ao conjunto de leads atendidos
                adSetMetrics[message.adset_id].top_users[cleanedUserName].leads_attended.add(lead.lead_id);
              });
              
              // Registrar usuário responsável pelo lead
              if (leadToUser[lead.lead_id]) {
                const userName = cleanUserName(leadToUser[lead.lead_id]);
                if (!adSetMetrics[message.adset_id].top_users[userName]) {
                  adSetMetrics[message.adset_id].top_users[userName] = {
                    name: userName,
                    attended: 0,
                    converted: 0,
                    total_value: 0,
                    leads_attended: new Set() // Conjunto para rastrear leads únicos
                  };
                }
                adSetMetrics[message.adset_id].top_users[userName].attended++;
                // Adiciona o lead_id ao conjunto de leads atendidos
                adSetMetrics[message.adset_id].top_users[userName].leads_attended.add(lead.lead_id);
                
                if (lead.converted) {
                  adSetMetrics[message.adset_id].top_users[userName].converted++;
                  adSetMetrics[message.adset_id].top_users[userName].total_value += lead.price;
                }
              }
            } else if (lead.lost_reason) {
              // Registrar motivo de perda
              if (!adSetMetrics[message.adset_id].lost_reasons[lead.lost_reason]) {
                adSetMetrics[message.adset_id].lost_reasons[lead.lost_reason] = 0;
              }
              adSetMetrics[message.adset_id].lost_reasons[lead.lost_reason]++;
              
              // Adicionar tempo até descarte
              if (lead.discard_time) {
                const discardTimeMs = lead.discard_time - lead.first_event_time;
                adSetMetrics[message.adset_id].discard_times.push(discardTimeMs);
              }
            } else {
              // Lead em andamento
              adSetMetrics[message.adset_id].in_progress++;
              
              // Registrar distribuição de estágios
              if (lead.last_stage) {
                if (!adSetMetrics[message.adset_id].stage_distribution[lead.last_stage]) {
                  adSetMetrics[message.adset_id].stage_distribution[lead.last_stage] = 0;
                }
                adSetMetrics[message.adset_id].stage_distribution[lead.last_stage]++;
              }
            }
          }
        }
        
        // Processar métricas por anúncio
        if (message.ad_name) {
          const adKey = message.ad_name;
          
          console.log(`Adding metrics for ad: ${adKey}`);
          
          if (!adMetrics[adKey]) {
            adMetrics[adKey] = {
              id: message.ad_id || null,
              ad_name: message.ad_name,
              total_leads: 0,
              converted_leads: 0,
              total_value: 0,
              lost_reasons: {},
              in_progress: 0,
              stage_distribution: {},
              stage_reached_distribution: {},
              top_users: {},
              conversion_times: [],
              discard_times: []
            };
          }
          
          // Increment total leads only for message_received events
          adMetrics[adKey].total_leads++;
          
          // Get lead info for this message
          const lead = leadsByMessage[eventData.message_id];
          
          if (lead) {
            console.log(`Processing lead ${lead.lead_id} for ad ${adKey} with farthest stage ${lead.farthest_stage}`);
            
            // Update stage distribution with the FARTHEST stage reached
            if (lead.farthest_stage) {
              if (!adMetrics[adKey].stage_reached_distribution[lead.farthest_stage]) {
                adMetrics[adKey].stage_reached_distribution[lead.farthest_stage] = 0;
              }
              adMetrics[adKey].stage_reached_distribution[lead.farthest_stage]++;
            }
            
            // Process all users who attended this lead
            Array.from(lead.attended_by).forEach(userName => {
              // Cria uma chave única para cada par usuário-lead para evitar duplicação
              const cleanedUserName = cleanUserName(userName);
              const userLeadKey = `${cleanedUserName}-${lead.lead_id}`;
              
              // Se já contabilizamos este atendimento, pule
              if (userLeadMap[userLeadKey]) {
                return;
              }
              
              // Marca este atendimento como contabilizado
              userLeadMap[userLeadKey] = true;
              
              if (!adMetrics[adKey].top_users[cleanedUserName]) {
                adMetrics[adKey].top_users[cleanedUserName] = {
                  name: cleanedUserName,
                  attended: 0,
                  converted: 0,
                  total_value: 0,
                  leads_attended: new Set() // Conjunto para rastrear leads únicos
                };
              }
              
              // Incrementa o contador de atendimentos (agora sem duplicação)
              adMetrics[adKey].top_users[cleanedUserName].attended++;
              // Adiciona o lead_id ao conjunto de leads atendidos
              adMetrics[adKey].top_users[cleanedUserName].leads_attended.add(lead.lead_id);
            });
            
            // Update metrics based on lead status
            if (lead.converted) {
              adMetrics[adKey].converted_leads++;
              adMetrics[adKey].total_value += lead.price;
              
              // Add conversion time
              if (lead.conversion_time) {
                const conversionTimeMs = lead.conversion_time - lead.first_event_time;
                adMetrics[adKey].conversion_times.push(conversionTimeMs);
              }
              
              // If there's a responsible user, attribute the conversion to them
              if (lead.responsible_user_name) {
                const userName = cleanUserName(lead.responsible_user_name);
                if (!adMetrics[adKey].top_users[userName]) {
                  adMetrics[adKey].top_users[userName] = {
                    name: userName,
                    attended: 1,
                    converted: 0,
                    total_value: 0,
                    leads_attended: new Set() // Conjunto para rastrear leads únicos
                  };
                }
                adMetrics[adKey].top_users[userName].converted++;
                adMetrics[adKey].top_users[userName].total_value += lead.price;
                // Adiciona o lead_id ao conjunto de leads atendidos
                adMetrics[adKey].top_users[userName].leads_attended.add(lead.lead_id);
              }
            } else if (lead.lost_reason) {
              // Add lost reason
              if (!adMetrics[adKey].lost_reasons[lead.lost_reason]) {
                adMetrics[adKey].lost_reasons[lead.lost_reason] = 0;
              }
              adMetrics[adKey].lost_reasons[lead.lost_reason]++;
              
              // Add discard time
              if (lead.discard_time) {
                const discardTimeMs = lead.discard_time - lead.first_event_time;
                adMetrics[adKey].discard_times.push(discardTimeMs);
              }
              
              // If there's a responsible user for discard, attribute it
              if (lead.responsible_user_name) {
                const userName = cleanUserName(lead.responsible_user_name);
                if (!adMetrics[adKey].top_users[userName]) {
                  adMetrics[adKey].top_users[userName] = {
                    name: userName,
                    attended: 1,
                    converted: 0,
                    total_value: 0,
                    leads_attended: new Set() // Conjunto para rastrear leads únicos
                  };
                }
                // Adiciona o lead_id ao conjunto de leads atendidos
                adMetrics[adKey].top_users[userName].leads_attended.add(lead.lead_id);
              }
            } else {
              // Lead in progress
              adMetrics[adKey].in_progress++;
              
              // Update stage distribution with the CURRENT stage
              if (lead.last_stage) {
                if (!adMetrics[adKey].stage_distribution[lead.last_stage]) {
                  adMetrics[adKey].stage_distribution[lead.last_stage] = 0;
                }
                adMetrics[adKey].stage_distribution[lead.last_stage]++;
              }
            }
          }
        }
      });
      
      // Log the ad metrics we've collected
      console.log("Ad metrics after processing:", Object.keys(adMetrics).map(key => ({
        ad_name: adMetrics[key].ad_name,
        total_leads: adMetrics[key].total_leads,
        converted_leads: adMetrics[key].converted_leads
      })));
  
      // Calcular tempos médios de conversão e descarte
      const calculateAverageConversionTime = (conversionTimes) => {
        if (!conversionTimes || conversionTimes.length === 0) return null;
        const totalTime = conversionTimes.reduce((sum, time) => sum + time, 0);
        return Math.round(totalTime / conversionTimes.length);
      };

      const calculateAverageDiscardTime = (discardTimes) => {
        if (!discardTimes || discardTimes.length === 0) return null;
        const totalTime = discardTimes.reduce((sum, time) => sum + time, 0);
        return Math.round(totalTime / discardTimes.length);
      };

      // Processar cada lead para calcular tempos
      const conversionTimes = [];
      const discardTimes = [];

      Object.values(eventsByLead).forEach(events => {
        const firstEvent = events[0];
        const lastEvent = events[events.length - 1];
        
        if (firstEvent && lastEvent) {
          const timeDiff = Math.abs(new Date(lastEvent.event_time) - new Date(firstEvent.event_time)) / 1000; // em segundos
          
          if (lastEvent.event_type === 'lead_converted') {
            conversionTimes.push(timeDiff);
          } else if (lastEvent.event_type === 'lead_lost') {
            discardTimes.push(timeDiff);
          }
        }
      });

      // Atualizar métricas com os tempos médios
      Object.values(campaignMetrics).forEach(metric => {
        metric.average_conversion_time = calculateAverageConversionTime(conversionTimes);
        metric.average_discard_time = calculateAverageDiscardTime(discardTimes);
      });

      Object.values(adSetMetrics).forEach(metric => {
        metric.average_conversion_time = calculateAverageConversionTime(conversionTimes);
        metric.average_discard_time = calculateAverageDiscardTime(discardTimes);
      });

      Object.values(adMetrics).forEach(metric => {
        metric.average_conversion_time = calculateAverageConversionTime(conversionTimes);
        metric.average_discard_time = calculateAverageDiscardTime(discardTimes);
      });
      
      // Função para encontrar o estágio mais comum
      const findMostCommonLastStage = (stageDistribution) => {
        if (Object.keys(stageDistribution).length === 0) return null;
        
        return Object.entries(stageDistribution)
          .sort((a, b) => b[1] - a[1])[0][0];
      };
      
      // Função para encontrar o estágio mais distante alcançado
      const findFarthestStageReached = (stageReachedDistribution) => {
        if (Object.keys(stageReachedDistribution).length === 0) return null;
        
        // Definir ordem dos estágios para determinar qual é o mais avançado
        const stageOrder = {
          'etapa de leads reorganizados': 1,
          '1° ATENDIMENTO(MANHÃ)': 2,
          '1º ATENDIMENTO(TARDE)': 3,
          '2° ATENDIMENTO': 4,
          '3° ATENDIMENTO': 5,
          'AGENDADO': 6,
          'LEAD QUENTE': 6,
          'ASSISTÊNCIA': 7,
          'GARANTIA': 7,
          'LEAD DESCARTADO': 8,
          'LEAD CONVERTIDO': 9
        };
        
        // Priorização quando os estágios têm o mesmo valor numérico
        const stagePriority = {
          'LEAD QUENTE': 1,      // Priorizar Lead Quente sobre Agendado
          'AGENDADO': 2,
          'GARANTIA': 1,         // Priorizar Garantia sobre Assistência
          'ASSISTÊNCIA': 2
        };
        
        // Encontrar o estágio com a ordem mais alta
        let highestOrder = -1;
        let farthestStage = null;
        
        Object.keys(stageReachedDistribution).forEach(stage => {
          const order = stageOrder[stage] || 0;
          
          // Se encontramos um estágio com ordem mais alta, ele se torna o mais distante
          if (order > highestOrder) {
            highestOrder = order;
            farthestStage = stage;
          } 
          // Se temos um empate na ordem, usamos a prioridade para desempatar
          else if (order === highestOrder && farthestStage) {
            const currentPriority = stagePriority[stage] || 999;
            const existingPriority = stagePriority[farthestStage] || 999;
            
            // Número menor significa maior prioridade
            if (currentPriority < existingPriority) {
              farthestStage = stage;
            }
          }
        });
        
        return farthestStage;
      };
      
      // Função para converter top_users de objeto para array
      const convertTopUsersToArray = (topUsers) => {
        return Object.values(topUsers)
          .map(user => {
            // Calcular o número real de leads atendidos pelo tamanho do conjunto
            const attended = user.leads_attended ? user.leads_attended.size : user.attended;
            
            // Calcular taxa de conversão
            const conversion_rate = attended > 0 
              ? (user.converted / attended) * 100 
              : 0;
            
            // Calcular ticket médio
            const average_ticket = user.converted > 0 
              ? user.total_value / user.converted 
              : 0;
            
            return {
              name: user.name,
              attended: attended,
              converted: user.converted,
              total_value: user.total_value,
              conversion_rate: parseFloat(conversion_rate.toFixed(2)),
              average_ticket: parseFloat(average_ticket.toFixed(2))
            };
          })
          .sort((a, b) => {
            // Primeiro por conversões
            if (b.converted !== a.converted) {
              return b.converted - a.converted;
            }
            // Depois por atendimentos
            return b.attended - a.attended;
          })
          .slice(0, 5); // Top 5 usuários
      };

      // Função para coletar dados detalhados de leads para cada anúncio
      const collectLeadDetailsForAd = (adName) => {
        // Coletar todos os leads associados a este anúncio
        const leads = [];
        
        // Buscar todos os message_id para este anúncio
        Object.keys(leadsByMessage).forEach(messageId => {
          const lead = leadsByMessage[messageId];
          
          // Verificar se esta mensagem está associada a este anúncio
          if (lead.message_data && lead.message_data.ad_name === adName) {
            leads.push({
              lead_id: lead.lead_id,
              phone: lead.phone,
              stage: lead.last_stage,
              farthest_stage: lead.farthest_stage,
              responsible_user: lead.responsible_user_name,
              message_id: messageId
            });
          }
        });
        
        return leads;
      };

      // Função para coletar dados detalhados de leads para cada campanha
      const collectLeadDetailsForCampaign = (campaignId) => {
        // Coletar todos os leads associados a esta campanha
        const leads = [];
        
        // Buscar todos os message_id para esta campanha
        Object.keys(leadsByMessage).forEach(messageId => {
          const lead = leadsByMessage[messageId];
          
          // Verificar se esta mensagem está associada a esta campanha
          if (lead.message_data && lead.message_data.campaign_id === campaignId) {
            leads.push({
              lead_id: lead.lead_id,
              phone: lead.phone,
              stage: lead.last_stage,
              farthest_stage: lead.farthest_stage,
              responsible_user: lead.responsible_user_name,
              ad_name: lead.message_data.ad_name,
              message_id: messageId
            });
          }
        });
        
        return leads;
      };

      // 3. Converter os objetos em arrays e adicionar métricas calculadas
      const campaigns = Object.values(campaignMetrics).map(metric => {
        // Calcular taxa de conversão
        const conversion_rate = metric.total_leads > 0 
          ? (metric.converted_leads / metric.total_leads) * 100 
          : 0;
        
        // Calcular tempo médio de conversão
        const average_conversion_time = calculateAverageConversionTime(metric.conversion_times);
        
        // Calcular tempo médio até descarte
        const average_discard_time = calculateAverageDiscardTime(metric.discard_times);
        
        // Encontrar estágio mais comum
        const most_common_last_stage = findMostCommonLastStage(metric.stage_distribution);
        
        // Encontrar estágio mais distante alcançado
        const farthest_stage_reached = findFarthestStageReached(metric.stage_reached_distribution);
        
        // Converter top_users para array
        const top_users = convertTopUsersToArray(metric.top_users);
        
        // Coletar informações detalhadas dos leads para diagnóstico
        const lead_details = collectLeadDetailsForCampaign(metric.campaign_id);
        
        // Log campaign metrics
        console.log(`Processing campaign: ${metric.campaign_name}, leads: ${metric.total_leads}, lead_details: ${lead_details.length}`);
        
        return {
          ...metric,
          conversion_rate: parseFloat(conversion_rate.toFixed(2)),
          average_conversion_time,
          average_discard_time,
          most_common_last_stage,
          farthest_stage_reached,
          top_users,
         // lead_details // Adicionar detalhes dos leads
        };
      });
      
      const adSets = Object.values(adSetMetrics).map(metric => {
        // Calcular taxa de conversão
        const conversion_rate = metric.total_leads > 0 
          ? (metric.converted_leads / metric.total_leads) * 100 
          : 0;
        
        // Calcular tempo médio de conversão
        const average_conversion_time = calculateAverageConversionTime(metric.conversion_times);
        
        // Calcular tempo médio até descarte
        const average_discard_time = calculateAverageDiscardTime(metric.discard_times);
        
        // Encontrar estágio mais comum
        const most_common_last_stage = findMostCommonLastStage(metric.stage_distribution);
        
        // Encontrar estágio mais distante alcançado
        const farthest_stage_reached = findFarthestStageReached(metric.stage_reached_distribution);
        
        // Converter top_users para array
        const top_users = convertTopUsersToArray(metric.top_users);
        
        return {
          ...metric,
          conversion_rate: parseFloat(conversion_rate.toFixed(2)),
          average_conversion_time,
          average_discard_time,
          most_common_last_stage,
          farthest_stage_reached,
          top_users
        };
      });
      
      // Log before processing ads
      console.log("Processing ads for response, keys:", Object.keys(adMetrics));
      
      const ads = Object.values(adMetrics).map(metric => {
        // Calcular taxa de conversão
        const conversion_rate = metric.total_leads > 0 
          ? (metric.converted_leads / metric.total_leads) * 100 
          : 0;
        
        // Calcular tempo médio de conversão
        const average_conversion_time = calculateAverageConversionTime(metric.conversion_times);
        
        // Calcular tempo médio até descarte
        const average_discard_time = calculateAverageDiscardTime(metric.discard_times);
        
        // Encontrar estágio mais comum
        const most_common_last_stage = findMostCommonLastStage(metric.stage_distribution);
        
        // Encontrar estágio mais distante alcançado
        const farthest_stage_reached = findFarthestStageReached(metric.stage_reached_distribution);
        
        // Converter top_users para array
        const top_users = convertTopUsersToArray(metric.top_users);
        
        // Coletar informações detalhadas dos leads para diagnóstico
        const lead_details = collectLeadDetailsForAd(metric.ad_name);
        
        // Log the individual ad metric
        console.log(`Processing ad: ${metric.ad_name}, leads: ${metric.total_leads}, lead_details: ${lead_details.length}`);
        
        return {
          ...metric,
          ad_id: metric.id, // Ensure consistent field naming
          conversion_rate: parseFloat(conversion_rate.toFixed(2)),
          average_conversion_time,
          average_discard_time,
          most_common_last_stage,
          farthest_stage_reached,
          top_users,
          //lead_details // Adicionar detalhes dos leads
        };
      });
      
      // Log the final ads array
      console.log("Final ads for response:", ads.map(ad => ({
        ad_name: ad.ad_name,
        total_leads: ad.total_leads
      })));
  
      // Preparar a resposta final
      const response = {
        campaigns,
        adSets,
        ads,
        top_users: [],
        diagnostics: {} // Adicionar seção de diagnóstico
      };
      
      // Adicionar informações de diagnóstico para mensagens sem tracking
      const messagesWithoutTracking = [];
      webhookMessages.forEach(message => {
        const messageData = message.toJSON();
        const messageId = messageData.id;
        
        // Verificar se esta mensagem está em algum lead registrado
        const hasTracking = Object.keys(leadsByMessage).some(id => 
          parseInt(id) === messageId || id === messageId.toString()
        );
        
        if (!hasTracking) {
          // Esta mensagem não tem tracking associado
          messagesWithoutTracking.push({
            message_id: messageId,
            phone: messageData.telefone,
            name: messageData.nome,
            message: messageData.mensagem,
            ad_name: messageData.ad_name,
            adset_name: messageData.adset_name,
            adset_id: messageData.adset_id,
            campaign_name: messageData.campaign_name,
            campaign_id: messageData.campaign_id,
            date_time: messageData.date_time
          });
        }
      });
      
      response.diagnostics.messagesWithoutTracking = messagesWithoutTracking;
      console.log(`Found ${messagesWithoutTracking.length} messages without tracking`);
      
      // Remove conversion_times and discard_times from the response for cleaner output
      response.campaigns.forEach(campaign => {
        delete campaign.conversion_times;
        delete campaign.discard_times;
      });
      
      response.adSets.forEach(adSet => {
        delete adSet.conversion_times;
        delete adSet.discard_times;
      });
      
      response.ads.forEach(ad => {
        delete ad.conversion_times;
        delete ad.discard_times;
        // Mantenha lead_details (não precisamos excluir)
      });
      
      // Calcular os top users consolidados
      const consolidatedTopUsers = {};
      // Mapa para rastrear leads convertidos por usuário (para evitar duplicação)
      const userConversionMap = {};
      
      // Rastrear qual usuário foi o último a atender cada lead
      const lastResponsibleByLead = {};
      
      // Set com todos os leads encontrados, incluindo aqueles sem atendimento
      const allLeads = new Set();
      
      // Registrar todos os leads conhecidos pelo sistema
      // Primeiro via webhookMessages 
      webhookMessages.forEach(msg => {
        const messageData = msg.toJSON();
        allLeads.add(messageData.id.toString());
      });
      
      // Depois via LeadTracking
      trackingEvents.forEach(event => {
        const eventData = event.toJSON();
        if (eventData.lead_id) {
          allLeads.add(eventData.lead_id.toString());
        }
      });
      
      console.log(`Total de leads conhecidos: ${allLeads.size}`);
      
      // Primeiro, identificar o último usuário responsável por cada lead
      trackingEvents.forEach(event => {
        const eventData = event.toJSON();
        
        if (eventData.lead_id) {
          // Registrar este lead como um lead conhecido
          allLeads.add(eventData.lead_id.toString());
          
          if (eventData.responsible_user_name) {
            const cleanedName = cleanUserName(eventData.responsible_user_name);
            
            // Verificar se já temos um evento para este lead e se este evento é mais recente
            if (!lastResponsibleByLead[eventData.lead_id] || 
                new Date(eventData.event_time) > new Date(lastResponsibleByLead[eventData.lead_id].event_time)) {
              lastResponsibleByLead[eventData.lead_id] = {
                user_name: cleanedName,
                event_time: eventData.event_time
              };
            }
          }
        }
      });
      
      // Inicializar um objeto para leads sem atendente
      consolidatedTopUsers["Sem atendente"] = {
        name: "Sem atendente",
              attended: 0,
              converted: 0,
              total_value: 0,
        leads_attended: new Set(),
        leads_converted: new Set()
      };
      
      // Distribuir todos os leads conhecidos pelos atendentes ou "Sem atendente"
      allLeads.forEach(leadId => {
        if (lastResponsibleByLead[leadId]) {
          // Lead tem um responsável
          const userName = lastResponsibleByLead[leadId].user_name;
          
          if (!consolidatedTopUsers[userName]) {
            consolidatedTopUsers[userName] = {
              name: userName,
              attended: 0,
              converted: 0,
              total_value: 0,
              leads_attended: new Set(),
              leads_converted: new Set()
            };
          }
          
          // Adicionar este lead à lista de atendidos
          consolidatedTopUsers[userName].leads_attended.add(leadId);
        } else {
          // Lead não tem responsável, atribuir a "Sem atendente"
          consolidatedTopUsers["Sem atendente"].leads_attended.add(leadId);
        }
      });
      
      // Processar conversões
      trackingEvents.forEach(event => {
        const eventData = event.toJSON();
        
        // Apenas para eventos de conversão
        if (eventData.lead_situation === 'COMPROU' && eventData.lead_id && eventData.price) {
          const leadId = eventData.lead_id;
          const price = parseFloat(eventData.price);
          
          // Verificar qual usuário foi o último responsável por este lead
          if (lastResponsibleByLead[leadId]) {
            const userName = lastResponsibleByLead[leadId].user_name;
          
          // Chave única para este par usuário-lead-conversão
          const conversionKey = `${userName}-${leadId}-conversion`;
          
          // Pular se já contabilizamos esta conversão
          if (userConversionMap[conversionKey]) {
            return;
          }
          
          // Marcar como contabilizado
          userConversionMap[conversionKey] = true;
          
          // Incrementar conversão se ainda não contabilizamos este lead
          if (!consolidatedTopUsers[userName].leads_converted.has(leadId)) {
            consolidatedTopUsers[userName].converted++;
            consolidatedTopUsers[userName].total_value += price;
            consolidatedTopUsers[userName].leads_converted.add(leadId);
            }
          }
        }
      });
      
      // Log para debugging dos totais
      let totalAttended = 0;
      
      // Após juntar todos os leads, atualizamos o contador de attended
      Object.values(consolidatedTopUsers).forEach(user => {
        user.attended = user.leads_attended ? user.leads_attended.size : 0;
        totalAttended += user.attended;
        
        // Limpeza: remover os conjuntos de rastreamento
        delete user.leads_attended;
        delete user.leads_converted;
        
        // Calcular taxa de conversão
        user.conversion_rate = user.attended > 0 ? (user.converted / user.attended) * 100 : 0;
        
        // Calcular ticket médio
        user.average_ticket = user.converted > 0 ? user.total_value / user.converted : 0;
        
        // Formatar valores para 2 casas decimais
        user.conversion_rate = parseFloat(user.conversion_rate.toFixed(2));
        user.average_ticket = parseFloat(user.average_ticket.toFixed(2));
      });
      
      console.log(`Total de leads atendidos por todos os usuários: ${totalAttended}`);
      console.log(`Total de leads únicos: ${allLeads.size}`);
      
      // Ordenar por número de conversões e adicionar ao response
      response.top_users = Object.values(consolidatedTopUsers)
        .sort((a, b) => {
          // Primeiro ordenar por conversões
          if (b.converted !== a.converted) {
            return b.converted - a.converted;
          }
          // Depois por número de atendimentos
          return b.attended - a.attended;
        })
        .slice(0, 10); // Limitar aos 10 melhores usuários
      
      console.log("Top users consolidados:", response.top_users);
      
      // Adicionar este log para debugar o que está acontecendo com os eventos COMPROU
      // Adicione este trecho depois do loop de processamento de leadsByMessage
      // ao redor da linha ~395

      // Debug para verificar os eventos de COMPROU
      console.log("------------ DEBUGANDO CONVERSÕES ------------");
      for (const leadId in eventsByLead) {
        const boughtEvents = eventsByLead[leadId].filter(e => e.lead_situation === 'COMPROU');
        if (boughtEvents.length > 0) {
          console.log(`Lead ${leadId} tem ${boughtEvents.length} eventos COMPROU:`);
          boughtEvents.forEach((e, i) => {
            console.log(`  Evento ${i+1}: price=${e.price}, message_id=${e.message_id}, event_time=${e.event_time}`);
          });
          
          // Verificar se este lead está associado a alguma mensagem
          const associatedMessages = Object.entries(leadsByMessage)
            .filter(([_, lead]) => lead.lead_id === leadId)
            .map(([msgId, _]) => msgId);
          
          console.log(`  Mensagens associadas: ${associatedMessages.join(', ') || 'nenhuma'}`);
          
          // Verificar se a conversão foi contabilizada para um anúncio
          if (associatedMessages.length > 0) {
            for (const msgId of associatedMessages) {
              const leadData = leadsByMessage[msgId];
              const adName = leadData.message_data?.ad_name;
              console.log(`  Mensagem ${msgId} está associada ao anúncio: ${adName || 'N/A'}`);
              console.log(`    Conversão contabilizada: ${leadData.converted}`);
            }
          }
        }
      }
      
      return(response);
    } catch (error) {
      console.error('Error fetching ad metrics:', error);
    return ({ error: error.message });
    }
  },

  /**
   * Obter leads agrupados por número de telefone
   * Função que organiza eventos de rastreamento e mensagens por telefone
   * @returns {Promise<Object>} Dados agrupados por telefone
   */
  getLeadsByPhone: async () => {
    try {
      console.log("Iniciando agrupamento de leads por telefone...");
      
      // 1. Obter todos os eventos de rastreamento
      const events = await LeadTracking.findAll({
        include: [{
          model: WebhookMessage,
          attributes: ['id', 'telefone', 'nome', 'campaign_id', 'campaign_name', 'adset_id', 'adset_name', 'ad_name', 'date_time']
        }]
      });
      
      console.log(`Obtidos ${events.length} eventos de rastreamento`);
      
      // Função para normalizar os timestamps para o padrão brasileiro (UTC-3)
      const normalizeTimestamp = (timestamp) => {
        if (!timestamp) return null;
        
        // Converter para objeto Date se for string
        const date = typeof timestamp === 'string' ? new Date(timestamp) : new Date(timestamp);
        
        // Subtrair 3 horas para converter de UTC para horário brasileiro (UTC-3)
        date.setHours(date.getHours() - 3);
        
        return date;
      };
      
      // 2. Agrupar eventos por telefone
      const phoneData = {};
      
      events.forEach(event => {
        const eventData = event.toJSON();
        // Usar telefone do evento ou da mensagem associada
        const phone = eventData.phone || (eventData.WebhookMessage ? eventData.WebhookMessage.telefone : null);
        
        if (!phone) return; // Pular eventos sem telefone
        
        // Inicializar estrutura para este telefone se não existir
        if (!phoneData[phone]) {
          phoneData[phone] = {
            telefone: phone,
            nome: null,
            mensagens: new Set(),
            rastreamentos: new Set(),
            eventos: [],
            leads: new Set(),
            anuncios: [], // Lista de anúncios ao invés de apenas IDs de campanha
            conversoes: [],
            descartes: [],
            primeiro_contato: null,
            ultimo_contato: null
          };
        }
        
        // Adicionar ID da mensagem ao conjunto
        if (eventData.message_id) {
          phoneData[phone].mensagens.add(eventData.message_id);
        }
        
        // Adicionar ID do rastreamento ao conjunto
        phoneData[phone].rastreamentos.add(eventData.id);
        
        // Adicionar ID do lead ao conjunto
        if (eventData.lead_id) {
          phoneData[phone].leads.add(eventData.lead_id);
        }
        
        // Registrar nome do contato se disponível
        if (!phoneData[phone].nome && eventData.WebhookMessage && eventData.WebhookMessage.nome) {
          phoneData[phone].nome = eventData.WebhookMessage.nome;
        }
        
        // Registrar informações de anúncios (campanha, conjunto, anúncio)
        if (eventData.WebhookMessage && eventData.WebhookMessage.campaign_id) {
          const msg = eventData.WebhookMessage;
          
          // Verificar se este anúncio já foi registrado para este telefone
          //const anuncioExistente = phoneData[phone].anuncios.find(
           // a => a.campaign_id === msg.campaign_id && 
          //       a.adset_id === msg.adset_id &&
          //       a.ad_name === msg.ad_name
          //);
          
         // if (!anuncioExistente) {
            // Usar date_time da mensagem
            phoneData[phone].anuncios.push({
              campaign_id: msg.campaign_id,
              campaign_name: msg.campaign_name || 'Sem nome',
              adset_id: msg.adset_id,
              adset_name: msg.adset_name || 'Sem nome',
              ad_name: msg.ad_name || 'Sem nome',
              message_id: msg.id,
              date_time: msg.date_time // Manter o mesmo formato da mensagem
            });
         // }
        }
        
        // Normalizar timestamp do evento para o padrão da mensagem
        const messageDateTime = eventData.WebhookMessage?.date_time;
        let eventTime;
        
        if (messageDateTime && eventData.event_type === 'message_received') {
          // Para eventos de mensagem recebida, usar a data da mensagem
          eventTime = messageDateTime;
        } else {
          // Para outros eventos, normalizar a data para formato padrão brasileiro
          eventTime = normalizeTimestamp(eventData.event_time).toISOString();
        }
        
        // Registrar primeiro e último contato
        if (!phoneData[phone].primeiro_contato || new Date(eventTime) < new Date(phoneData[phone].primeiro_contato)) {
          phoneData[phone].primeiro_contato = eventTime;
        }
        if (!phoneData[phone].ultimo_contato || new Date(eventTime) > new Date(phoneData[phone].ultimo_contato)) {
          phoneData[phone].ultimo_contato = eventTime;
        }
        
        // Adicionar evento à lista de eventos (com data normalizada)
        phoneData[phone].eventos.push({
          id: eventData.id,
          lead_id: eventData.lead_id,
          message_id: eventData.message_id,
          event_type: eventData.event_type,
          event_time: eventTime,
          current_status_name: eventData.current_status_name,
          responsible_user_name: eventData.responsible_user_name ? eventData.responsible_user_name.replace(' undefined', '') : null,
          lead_situation: eventData.lead_situation,
          price: eventData.price
        });
        
        // Registrar conversões (com data normalizada)
        if (eventData.lead_situation === 'COMPROU') {
          phoneData[phone].conversoes.push({
            lead_id: eventData.lead_id,
            event_time: eventTime,
            price: eventData.price ? parseFloat(eventData.price) : 0,
            message_id: eventData.message_id,
            responsible_user_name: eventData.responsible_user_name ? eventData.responsible_user_name.replace(' undefined', '') : null,
            // Adicionar informações do anúncio que gerou a conversão, se disponível
            campaign_name: eventData.WebhookMessage?.campaign_name,
            ad_name: eventData.WebhookMessage?.ad_name
          });
        }
        
        // Registrar descartes (com data normalizada)
        if (eventData.current_status_name === 'LEAD DESCARTADO') {
          phoneData[phone].descartes = phoneData[phone].descartes || [];
          phoneData[phone].descartes.push({
            lead_id: eventData.lead_id,
            event_time: eventTime,
            motivo: eventData.lead_situation || 'Não especificado',
            message_id: eventData.message_id,
            responsible_user_name: eventData.responsible_user_name ? eventData.responsible_user_name.replace(' undefined', '') : null,
            // Adicionar informações do anúncio que gerou o descarte, se disponível
            campaign_name: eventData.WebhookMessage?.campaign_name,
            ad_name: eventData.WebhookMessage?.ad_name
          });
        }
      });
      
      // 3. Converter conjuntos (Sets) para arrays
      const result = {};
      Object.keys(phoneData).forEach(phone => {
        const data = phoneData[phone];
        result[phone] = {
          telefone: data.telefone,
          nome: data.nome,
          mensagens: Array.from(data.mensagens),
          rastreamentos: Array.from(data.rastreamentos),
          leads: Array.from(data.leads),
          anuncios: data.anuncios,
          // Ordenar eventos cronologicamente
          eventos: data.eventos.sort((a, b) => new Date(a.event_time) - new Date(b.event_time)),
          conversoes: data.conversoes,
          primeiro_contato: data.primeiro_contato,
          ultimo_contato: data.ultimo_contato,
          total_mensagens: data.mensagens.size,
          total_leads: data.leads.size,
          total_anuncios: (() => {
            // Calcular o total de anúncios únicos
            const uniqueAds = new Set();
            data.anuncios.forEach(ad => {
              const adKey = `${ad.campaign_id}_${ad.adset_id}_${ad.ad_name}`;
              uniqueAds.add(adKey);
            });
            return uniqueAds.size;
          })(),
          convertido: data.conversoes.length > 0,
          // Adicionar campo para último status e responsável
          ultimo_status: data.eventos.length > 0 ? 
            data.eventos.sort((a, b) => new Date(b.event_time) - new Date(a.event_time))[0].current_status_name : null,
          responsavel: data.eventos.length > 0 ? 
            data.eventos.filter(e => e.responsible_user_name)
              .sort((a, b) => new Date(b.event_time) - new Date(a.event_time))[0]?.responsible_user_name : null,
          descartes: data.descartes,
          descartado: data.descartes.length > 0,
          motivo_descarte: data.descartes.length > 0 ? 
            data.descartes.sort((a, b) => new Date(b.event_time) - new Date(a.event_time))[0].motivo : null,
          total_descartes: data.descartes.length
        };
      });
      
      console.log(`Processados ${Object.keys(result).length} números de telefone únicos`);
      
      return result;
    } catch (error) {
      console.error('Erro ao agrupar leads por telefone:', error);
      return { error: error.message };
    }
  },

  /**
   * Obter análise detalhada de campanhas usando os dados organizados por telefone
   * Usa a função getLeadsByPhone como base e processa os dados para métricas por campanha
   * @returns {Promise<Object>} Estatísticas detalhadas por campanha
   */
  getCampaignAnalytics: async () => {
    try {
      console.log("Iniciando análise detalhada de campanhas...");
      
      // 1. Obter todos os dados organizados por telefone
      const dataByPhone = await dashboardService.getLeadsByPhone();
      
      // 2. Inicializar estruturas para análise
      const campaignAnalytics = {};
      const adSetAnalytics = {};
      const adAnalytics = {};
      
      // Mapas para rastrear os motivos de descarte por campanha/adset/ad
      const discardReasonsByCampaign = {};
      const discardReasonsByAdSet = {};
      const discardReasonsByAd = {};
      
      // Conjunto para rastrear todas as mensagens vistas globalmente
      const allMessages = new Set();
      
      // 3. Processar os dados para extrair métricas por campanha
      Object.values(dataByPhone).forEach(contact => {
        // Pular registros com erro
        if (contact.error) return;
        
        // Mapeamento de mensagens por campanha/adset/ad para este contato
        const contactMessagesByCampaign = {};
        const contactMessagesByAdSet = {};
        const contactMessagesByAd = {};
        
        // Processar cada anúncio relacionado a este contato
        contact.anuncios.forEach(ad => {
          const campaignId = ad.campaign_id;
          const adSetId = ad.adset_id;
          const adKey = `${ad.campaign_id}_${ad.adset_id}_${ad.ad_name}`;
          const messageId = ad.message_id;
          
          // Registrar mensagem no conjunto global
          allMessages.add(messageId);
          
          // Inicializar contadores de mensagens para este contato por entidade
          if (!contactMessagesByCampaign[campaignId]) {
            contactMessagesByCampaign[campaignId] = new Set();
          }
          if (!contactMessagesByAdSet[adSetId]) {
            contactMessagesByAdSet[adSetId] = new Set();
          }
          if (!contactMessagesByAd[adKey]) {
            contactMessagesByAd[adKey] = new Set();
          }
          
          // Adicionar mensagem aos conjuntos
          contactMessagesByCampaign[campaignId].add(messageId);
          contactMessagesByAdSet[adSetId].add(messageId);
          contactMessagesByAd[adKey].add(messageId);
          
          // Inicializar dados da campanha se ainda não existir
          if (!campaignAnalytics[campaignId]) {
            campaignAnalytics[campaignId] = {
              campaign_id: campaignId,
              campaign_name: ad.campaign_name,
              total_contacts: 0,
              total_clicks: 0,
              total_leads: 0,
              converted_leads: 0,
              discarded_leads: 0,
              total_value: 0,
              status_distribution: {},
              conversion_times: [],
              discard_times: [],
              discard_reasons: {},
              messages: new Set(),
              responsible_users: {},
              ad_sets: new Set(),
              ads: new Set(),
              // Mapear leads convertidos para evitar duplicação
              converted_lead_ids: new Set(),
              // Mapear leads descartados para evitar duplicação
              discarded_lead_ids: new Set(),
              // Conjunto para contatos únicos
              unique_contacts: new Set(),
              // Mapa para contabilizar mensagens por contato
              messages_by_contact: {}
            };
          }
          
          // Inicializar dados do conjunto de anúncios se ainda não existir
          if (!adSetAnalytics[adSetId]) {
            adSetAnalytics[adSetId] = {
              adset_id: adSetId,
              adset_name: ad.adset_name,
              campaign_id: campaignId,
              campaign_name: ad.campaign_name,
              total_contacts: 0,
              total_clicks: 0,
              total_leads: 0,
              converted_leads: 0,
              discarded_leads: 0,
              total_value: 0,
              discard_reasons: {},
              ads: new Set(),
              // Mapear leads convertidos para evitar duplicação
              converted_lead_ids: new Set(),
              // Mapear leads descartados para evitar duplicação
              discarded_lead_ids: new Set(),
              // Conjunto para contatos únicos
              unique_contacts: new Set(),
              // Mapa para contabilizar mensagens por contato
              messages_by_contact: {}
            };
          }
          
          // Inicializar dados do anúncio se ainda não existir
          if (!adAnalytics[adKey]) {
            adAnalytics[adKey] = {
              ad_name: ad.ad_name,
              adset_id: adSetId,
              adset_name: ad.adset_name,
              campaign_id: campaignId,
              campaign_name: ad.campaign_name,
              total_contacts: 0,
              total_clicks: 0,
              total_leads: 0,
              converted_leads: 0,
              discarded_leads: 0,
              total_value: 0,
              discard_reasons: {},
              // Mapear leads convertidos para evitar duplicação
              converted_lead_ids: new Set(),
              // Mapear leads descartados para evitar duplicação
              discarded_lead_ids: new Set(),
              // Conjunto para contatos únicos
              unique_contacts: new Set(),
              // Mapa para contabilizar mensagens por contato
              messages_by_contact: {}
            };
          }
          
          // Verificar se é a primeira vez que vemos este contato para cada entidade
          let isNewContactForCampaign = false;
          if (!campaignAnalytics[campaignId].unique_contacts.has(contact.telefone)) {
            campaignAnalytics[campaignId].unique_contacts.add(contact.telefone);
            campaignAnalytics[campaignId].total_contacts++;
            isNewContactForCampaign = true;
          }
          
          let isNewContactForAdSet = false;
          if (!adSetAnalytics[adSetId].unique_contacts.has(contact.telefone)) {
            adSetAnalytics[adSetId].unique_contacts.add(contact.telefone);
            adSetAnalytics[adSetId].total_contacts++;
            isNewContactForAdSet = true;
          }
          
          let isNewContactForAd = false;
          if (!adAnalytics[adKey].unique_contacts.has(contact.telefone)) {
            adAnalytics[adKey].unique_contacts.add(contact.telefone);
            adAnalytics[adKey].total_contacts++;
            isNewContactForAd = true;
          }
          
          // Registrar mensagem nos mapas de contato
          if (!campaignAnalytics[campaignId].messages_by_contact[contact.telefone]) {
            campaignAnalytics[campaignId].messages_by_contact[contact.telefone] = new Set();
          }
          campaignAnalytics[campaignId].messages_by_contact[contact.telefone].add(messageId);
          
          if (!adSetAnalytics[adSetId].messages_by_contact[contact.telefone]) {
            adSetAnalytics[adSetId].messages_by_contact[contact.telefone] = new Set();
          }
          adSetAnalytics[adSetId].messages_by_contact[contact.telefone].add(messageId);
          
          if (!adAnalytics[adKey].messages_by_contact[contact.telefone]) {
            adAnalytics[adKey].messages_by_contact[contact.telefone] = new Set();
          }
          adAnalytics[adKey].messages_by_contact[contact.telefone].add(messageId);
          
          // Registrar mensagem global
          campaignAnalytics[campaignId].messages.add(messageId);
          
          // Registrar conjuntos e anúncios da campanha
          campaignAnalytics[campaignId].ad_sets.add(adSetId);
          campaignAnalytics[campaignId].ads.add(adKey);
          adSetAnalytics[adSetId].ads.add(adKey);
          
          // Registrar dados de leads
          if (contact.leads.length > 0) {
            // Registrar lead para campainha, adset e ad (sem duplicação)
            let newLeadsForCampaign = 0;
            let newLeadsForAdSet = 0;
            let newLeadsForAd = 0;
            
            contact.leads.forEach(leadId => {
              // Verificar se é um novo lead para cada nível
              if (!campaignAnalytics[campaignId].hasOwnProperty(`lead_${leadId}`)) {
                campaignAnalytics[campaignId][`lead_${leadId}`] = true;
                newLeadsForCampaign++;
              }
              
              if (!adSetAnalytics[adSetId].hasOwnProperty(`lead_${leadId}`)) {
                adSetAnalytics[adSetId][`lead_${leadId}`] = true;
                newLeadsForAdSet++;
              }
              
              if (!adAnalytics[adKey].hasOwnProperty(`lead_${leadId}`)) {
                adAnalytics[adKey][`lead_${leadId}`] = true;
                newLeadsForAd++;
              }
            });
            
            // Incrementar contadores de leads
            campaignAnalytics[campaignId].total_leads += newLeadsForCampaign;
            adSetAnalytics[adSetId].total_leads += newLeadsForAdSet;
            adAnalytics[adKey].total_leads += newLeadsForAd;
            
            // Registrar distribuição de status
            const status = contact.ultimo_status || 'Desconhecido';
            campaignAnalytics[campaignId].status_distribution[status] = 
              (campaignAnalytics[campaignId].status_distribution[status] || 0) + 1;
              
            // Registrar usuário responsável
            if (contact.responsavel) {
              const user = contact.responsavel;
              if (!campaignAnalytics[campaignId].responsible_users[user]) {
                campaignAnalytics[campaignId].responsible_users[user] = {
                  name: user,
                  total_leads: 0,
                  converted_leads: 0,
                  total_value: 0,
                  // Mapear leads para evitar duplicação
                  lead_ids: new Set(),
                  converted_lead_ids: new Set()
                };
              }
              
              // Registrar leads únicos por usuário 
              contact.leads.forEach(leadId => {
                if (!campaignAnalytics[campaignId].responsible_users[user].lead_ids.has(leadId)) {
                  campaignAnalytics[campaignId].responsible_users[user].lead_ids.add(leadId);
                  campaignAnalytics[campaignId].responsible_users[user].total_leads++;
                }
              });
            }
          }
          
          // Processar conversões - usar apenas o último evento de conversão para cada lead
          if (contact.convertido && contact.conversoes.length > 0) {
            // Ordenar conversões por data (mais recente primeiro)
            const sortedConversions = [...contact.conversoes].sort(
              (a, b) => new Date(b.event_time) - new Date(a.event_time)
            );
            
            // Usar apenas a conversão mais recente
            const latestConversion = sortedConversions[0];
            
            // Para cada lead convertido
            contact.leads.forEach(leadId => {
              // Verificar se este lead já foi contabilizado para esta campanha
              if (!campaignAnalytics[campaignId].converted_lead_ids.has(leadId)) {
                // Registrar lead como contabilizado
                campaignAnalytics[campaignId].converted_lead_ids.add(leadId);
                adSetAnalytics[adSetId].converted_lead_ids.add(leadId);
                adAnalytics[adKey].converted_lead_ids.add(leadId);
                
                // Incrementar contadores
                campaignAnalytics[campaignId].converted_leads++;
                adSetAnalytics[adSetId].converted_leads++;
                adAnalytics[adKey].converted_leads++;
                
                // Adicionar valor
                const price = latestConversion.price || 0;
                campaignAnalytics[campaignId].total_value += price;
                adSetAnalytics[adSetId].total_value += price;
                adAnalytics[adKey].total_value += price;
                
                // Registrar usuário responsável pela conversão
                if (latestConversion.responsible_user_name) {
                  const user = latestConversion.responsible_user_name;
                  if (campaignAnalytics[campaignId].responsible_users[user]) {
                    // Verificar se este lead já foi contabilizado para este usuário
                    if (!campaignAnalytics[campaignId].responsible_users[user].converted_lead_ids.has(leadId)) {
                      campaignAnalytics[campaignId].responsible_users[user].converted_lead_ids.add(leadId);
                      campaignAnalytics[campaignId].responsible_users[user].converted_leads++;
                      campaignAnalytics[campaignId].responsible_users[user].total_value += price;
                    }
                  }
                }
                
                // Calcular tempo de conversão (se tiver dados suficientes)
                if (contact.primeiro_contato && latestConversion.event_time) {
                  const firstContact = new Date(contact.primeiro_contato);
                  const conversionTime = new Date(latestConversion.event_time);
                  const timeMs = conversionTime - firstContact;
                  
                  if (timeMs > 0) {
                    campaignAnalytics[campaignId].conversion_times.push({
                      time_ms: timeMs,
                      days: timeMs / (1000 * 60 * 60 * 24),
                      hours: timeMs / (1000 * 60 * 60),
                      contact: contact.telefone,
                      price: price,
                      lead_id: leadId
                    });
                  }
                }
              }
            });
          }
          
          // Processar descartes - usar apenas o último motivo de descarte para cada lead
          if (contact.descartado && contact.descartes.length > 0) {
            // Ordenar descartes por data (mais recente primeiro)
            const sortedDiscards = [...contact.descartes].sort(
              (a, b) => new Date(b.event_time) - new Date(a.event_time)
            );
            
            // Usar apenas o descarte mais recente
            const latestDiscard = sortedDiscards[0];
            
            // Para cada lead descartado
            contact.leads.forEach(leadId => {
              // Verificar se este lead já foi contabilizado para esta campanha
              if (!campaignAnalytics[campaignId].discarded_lead_ids.has(leadId)) {
                // Registrar lead como contabilizado
                campaignAnalytics[campaignId].discarded_lead_ids.add(leadId);
                adSetAnalytics[adSetId].discarded_lead_ids.add(leadId);
                adAnalytics[adKey].discarded_lead_ids.add(leadId);
                
                // Incrementar contadores
                campaignAnalytics[campaignId].discarded_leads++;
                adSetAnalytics[adSetId].discarded_leads++;
                adAnalytics[adKey].discarded_leads++;
                
                // Registrar motivo de descarte
                const discardReason = latestDiscard.motivo || 'Não especificado';
                
                // Para campanha
                campaignAnalytics[campaignId].discard_reasons[discardReason] = 
                  (campaignAnalytics[campaignId].discard_reasons[discardReason] || 0) + 1;
                
                // Para adset
                adSetAnalytics[adSetId].discard_reasons[discardReason] = 
                  (adSetAnalytics[adSetId].discard_reasons[discardReason] || 0) + 1;
                
                // Para ad
                adAnalytics[adKey].discard_reasons[discardReason] = 
                  (adAnalytics[adKey].discard_reasons[discardReason] || 0) + 1;
                
                // Registrar usuário responsável pelo descarte
                if (latestDiscard.responsible_user_name) {
                  const user = latestDiscard.responsible_user_name;
                  if (campaignAnalytics[campaignId].responsible_users[user]) {
                    // Adicionar propriedade de descartes se não existir
                    if (!campaignAnalytics[campaignId].responsible_users[user].discarded_leads) {
                      campaignAnalytics[campaignId].responsible_users[user].discarded_leads = 0;
                      campaignAnalytics[campaignId].responsible_users[user].discarded_lead_ids = new Set();
                      campaignAnalytics[campaignId].responsible_users[user].discard_reasons = {};
                    }
                    
                    // Verificar se este lead já foi contabilizado para este usuário
                    if (!campaignAnalytics[campaignId].responsible_users[user].discarded_lead_ids.has(leadId)) {
                      campaignAnalytics[campaignId].responsible_users[user].discarded_lead_ids.add(leadId);
                      campaignAnalytics[campaignId].responsible_users[user].discarded_leads++;
                      
                      // Rastrear motivos de descarte por usuário
                      campaignAnalytics[campaignId].responsible_users[user].discard_reasons[discardReason] = 
                        (campaignAnalytics[campaignId].responsible_users[user].discard_reasons[discardReason] || 0) + 1;
                    }
                  }
                }
                
                // Calcular tempo até o descarte (se tiver dados suficientes)
                if (contact.primeiro_contato && latestDiscard.event_time) {
                  const firstContact = new Date(contact.primeiro_contato);
                  const discardTime = new Date(latestDiscard.event_time);
                  const timeMs = discardTime - firstContact;
                  
                  if (timeMs > 0) {
                    campaignAnalytics[campaignId].discard_times.push({
                      time_ms: timeMs,
                      days: timeMs / (1000 * 60 * 60 * 24),
                      hours: timeMs / (1000 * 60 * 60),
                      contact: contact.telefone,
                      motivo: discardReason,
                      lead_id: leadId
                    });
                  }
                }
              }
            });
          }
        });
        
        // Agora que processamos todos os anúncios para este contato, atualizamos os totais de cliques
        
        // Atualizar cliques por campanha
        Object.keys(contactMessagesByCampaign).forEach(campaignId => {
          campaignAnalytics[campaignId].total_clicks += contactMessagesByCampaign[campaignId].size;
        });
        
        // Atualizar cliques por conjunto de anúncios
        Object.keys(contactMessagesByAdSet).forEach(adSetId => {
          adSetAnalytics[adSetId].total_clicks += contactMessagesByAdSet[adSetId].size;
        });
        
        // Atualizar cliques por anúncio
        Object.keys(contactMessagesByAd).forEach(adKey => {
          adAnalytics[adKey].total_clicks += contactMessagesByAd[adKey].size;
        });
      });
      
      // 4. Processar dados finais e calcular métricas adicionais
      Object.values(campaignAnalytics).forEach(campaign => {
        // Converter Sets para arrays
        campaign.ad_sets = Array.from(campaign.ad_sets);
        campaign.ads = Array.from(campaign.ads);
        campaign.messages = Array.from(campaign.messages);
        
        // Calcular taxa de conversão baseada em leads (não em cliques)
        campaign.conversion_rate = campaign.total_leads > 0 
          ? (campaign.converted_leads / campaign.total_leads) * 100 
          : 0;
        campaign.conversion_rate = parseFloat(campaign.conversion_rate.toFixed(2));
        
        // Calcular taxa de cliques por contato
        campaign.clicks_per_contact = campaign.total_contacts > 0
          ? (campaign.total_clicks / campaign.total_contacts)
          : 0;
        campaign.clicks_per_contact = parseFloat(campaign.clicks_per_contact.toFixed(2));
        
        // Calcular ticket médio
        campaign.average_ticket = campaign.converted_leads > 0 
          ? campaign.total_value / campaign.converted_leads 
          : 0;
        campaign.average_ticket = parseFloat(campaign.average_ticket.toFixed(2));
        
        // Calcular taxa de descarte
        campaign.discard_rate = campaign.total_leads > 0 
          ? (campaign.discarded_leads / campaign.total_leads) * 100 
          : 0;
        campaign.discard_rate = parseFloat(campaign.discard_rate.toFixed(2));
        
        // Calcular tempo médio de conversão
        if (campaign.conversion_times.length > 0) {
          const totalTime = campaign.conversion_times.reduce((sum, item) => sum + item.time_ms, 0);
          campaign.average_conversion_time_ms = Math.round(totalTime / campaign.conversion_times.length);
          campaign.average_conversion_time_hours = parseFloat((campaign.average_conversion_time_ms / (1000 * 60 * 60)).toFixed(2));
          campaign.average_conversion_time_days = parseFloat((campaign.average_conversion_time_ms / (1000 * 60 * 60 * 24)).toFixed(2));
        } else {
          campaign.average_conversion_time_ms = null;
          campaign.average_conversion_time_hours = null;
          campaign.average_conversion_time_days = null;
        }
        
        // Calcular tempo médio até o descarte
        if (campaign.discard_times.length > 0) {
          const totalDiscardTime = campaign.discard_times.reduce((sum, item) => sum + item.time_ms, 0);
          campaign.average_discard_time_ms = Math.round(totalDiscardTime / campaign.discard_times.length);
          campaign.average_discard_time_hours = parseFloat((campaign.average_discard_time_ms / (1000 * 60 * 60)).toFixed(2));
          campaign.average_discard_time_days = parseFloat((campaign.average_discard_time_ms / (1000 * 60 * 60 * 24)).toFixed(2));
          
          // Transformar motivos de descarte em array ordenado
          campaign.discard_reasons_array = Object.entries(campaign.discard_reasons)
            .map(([reason, count]) => ({ reason, count }))
            .sort((a, b) => b.count - a.count);
        } else {
          campaign.average_discard_time_ms = null;
          campaign.average_discard_time_hours = null;
          campaign.average_discard_time_days = null;
          campaign.discard_reasons_array = [];
        }
        
        // Converter usuários responsáveis para array
        campaign.responsible_users = Object.values(campaign.responsible_users)
          .map(user => {
            // Calcular taxa de conversão por usuário
            user.conversion_rate = user.total_leads > 0 
              ? (user.converted_leads / user.total_leads) * 100 
              : 0;
            user.conversion_rate = parseFloat(user.conversion_rate.toFixed(2));
            
            // Calcular ticket médio por usuário
            user.average_ticket = user.converted_leads > 0 
              ? user.total_value / user.converted_leads 
              : 0;
            user.average_ticket = parseFloat(user.average_ticket.toFixed(2));
            
            // Calcular taxa de descarte por usuário (se existir)
            if (user.discarded_leads !== undefined) {
              user.discard_rate = user.total_leads > 0 
                ? (user.discarded_leads / user.total_leads) * 100
                : 0;
              user.discard_rate = parseFloat(user.discard_rate.toFixed(2));
              
              // Transformar motivos de descarte em array ordenado
              if (user.discard_reasons) {
                user.discard_reasons_array = Object.entries(user.discard_reasons)
                  .map(([reason, count]) => ({ reason, count }))
                  .sort((a, b) => b.count - a.count);
              }
              
              // Remover conjunto de IDs de leads descartados
              delete user.discarded_lead_ids;
            }
            
            // Remover conjuntos de tracking
            delete user.lead_ids;
            delete user.converted_lead_ids;
            
            return user;
          })
          .sort((a, b) => b.total_leads - a.total_leads);
        
        // Remover dados de tracking que não precisamos na resposta
        delete campaign.converted_lead_ids;
        delete campaign.discarded_lead_ids;
        delete campaign.unique_contacts;
        delete campaign.messages_by_contact;
        
        // Remover dados temporários de leads
        Object.keys(campaign).forEach(key => {
          if (key.startsWith('lead_')) {
            delete campaign[key];
          }
        });
      });
      
      // Processar métricas adicionais para conjuntos de anúncios
      Object.values(adSetAnalytics).forEach(adSet => {
        // Converter Sets para arrays
        adSet.ads = Array.from(adSet.ads);
        
        // Calcular taxa de conversão
        adSet.conversion_rate = adSet.total_leads > 0 
          ? (adSet.converted_leads / adSet.total_leads) * 100 
          : 0;
        adSet.conversion_rate = parseFloat(adSet.conversion_rate.toFixed(2));
        
        // Calcular taxa de cliques por contato
        adSet.clicks_per_contact = adSet.total_contacts > 0
          ? (adSet.total_clicks / adSet.total_contacts)
          : 0;
        adSet.clicks_per_contact = parseFloat(adSet.clicks_per_contact.toFixed(2));
        
        // Calcular ticket médio
        adSet.average_ticket = adSet.converted_leads > 0 
          ? adSet.total_value / adSet.converted_leads 
          : 0;
        adSet.average_ticket = parseFloat(adSet.average_ticket.toFixed(2));
        
        // Calcular taxa de descarte
        adSet.discard_rate = adSet.total_leads > 0 
          ? (adSet.discarded_leads / adSet.total_leads) * 100
          : 0;
        adSet.discard_rate = parseFloat(adSet.discard_rate.toFixed(2));
        
        // Transformar motivos de descarte em array ordenado
        if (Object.keys(adSet.discard_reasons).length > 0) {
          adSet.discard_reasons_array = Object.entries(adSet.discard_reasons)
            .map(([reason, count]) => ({ reason, count }))
            .sort((a, b) => b.count - a.count);
        } else {
          adSet.discard_reasons_array = [];
        }
        
        // Remover dados de tracking
        delete adSet.converted_lead_ids;
        delete adSet.discarded_lead_ids;
        delete adSet.unique_contacts;
        delete adSet.messages_by_contact;
        
        // Remover dados temporários de leads
        Object.keys(adSet).forEach(key => {
          if (key.startsWith('lead_')) {
            delete adSet[key];
          }
        });
      });
      
      // Processar métricas adicionais para anúncios
      Object.values(adAnalytics).forEach(ad => {
        // Calcular taxa de conversão
        ad.conversion_rate = ad.total_leads > 0 
          ? (ad.converted_leads / ad.total_leads) * 100 
          : 0;
        ad.conversion_rate = parseFloat(ad.conversion_rate.toFixed(2));
        
        // Calcular taxa de cliques por contato
        ad.clicks_per_contact = ad.total_contacts > 0
          ? (ad.total_clicks / ad.total_contacts)
          : 0;
        ad.clicks_per_contact = parseFloat(ad.clicks_per_contact.toFixed(2));
        
        // Calcular ticket médio
        ad.average_ticket = ad.converted_leads > 0 
          ? ad.total_value / ad.converted_leads 
          : 0;
        ad.average_ticket = parseFloat(ad.average_ticket.toFixed(2));
        
        // Calcular taxa de descarte
        ad.discard_rate = ad.total_leads > 0 
          ? (ad.discarded_leads / ad.total_leads) * 100
          : 0;
        ad.discard_rate = parseFloat(ad.discard_rate.toFixed(2));
        
        // Transformar motivos de descarte em array ordenado
        if (Object.keys(ad.discard_reasons).length > 0) {
          ad.discard_reasons_array = Object.entries(ad.discard_reasons)
            .map(([reason, count]) => ({ reason, count }))
            .sort((a, b) => b.count - a.count);
        } else {
          ad.discard_reasons_array = [];
        }
        
        // Remover dados de tracking
        delete ad.converted_lead_ids;
        delete ad.discarded_lead_ids;
        delete ad.unique_contacts;
        delete ad.messages_by_contact;
        
        // Remover dados temporários de leads
        Object.keys(ad).forEach(key => {
          if (key.startsWith('lead_')) {
            delete ad[key];
          }
        });
      });
      
      // 5. Organizar resultado final
      const result = {
        campaigns: Object.values(campaignAnalytics).sort((a, b) => b.total_leads - a.total_leads),
        ad_sets: Object.values(adSetAnalytics).sort((a, b) => b.total_leads - a.total_leads),
        ads: Object.values(adAnalytics).sort((a, b) => b.total_leads - a.total_leads),
        total_campaigns: Object.keys(campaignAnalytics).length,
        total_ad_sets: Object.keys(adSetAnalytics).length,
        total_ads: Object.keys(adAnalytics).length,
        total_contacts: Object.keys(dataByPhone).length,
        total_clicks: allMessages.size,
        
        // Métricas agregadas sobre descartes
        discard_metrics: {
          total_discarded_leads: Object.values(campaignAnalytics).reduce((sum, campaign) => sum + campaign.discarded_leads, 0),
          discard_reasons: aggregateDiscardReasons(Object.values(campaignAnalytics)),
          average_discard_time_days: calculateAverageFromCampaigns(Object.values(campaignAnalytics), 'average_discard_time_days'),
          average_discard_time_hours: calculateAverageFromCampaigns(Object.values(campaignAnalytics), 'average_discard_time_hours')
        },
        
        processed_at: new Date().toISOString()
      };
      
      console.log(`Análise concluída: ${result.total_campaigns} campanhas, ${result.total_ad_sets} conjuntos, ${result.total_ads} anúncios, ${result.total_clicks} cliques totais, ${result.total_contacts} contatos únicos, ${result.discard_metrics.total_discarded_leads} leads descartados`);
      
      return result;
      
    } catch (error) {
      console.error('Erro na análise de campanhas:', error);
      return { error: error.message };
    }
  }
};

// Função auxiliar para agregar motivos de descarte
function aggregateDiscardReasons(campaigns) {
  const aggregatedReasons = {};
  
  campaigns.forEach(campaign => {
    if (campaign.discard_reasons) {
      Object.entries(campaign.discard_reasons).forEach(([reason, count]) => {
        aggregatedReasons[reason] = (aggregatedReasons[reason] || 0) + count;
      });
    }
  });
  
  return Object.entries(aggregatedReasons)
    .map(([reason, count]) => ({ reason, count }))
    .sort((a, b) => b.count - a.count);
}

// Função auxiliar para calcular médias a partir das campanhas
function calculateAverageFromCampaigns(campaigns, field) {
  const validValues = campaigns
    .map(campaign => campaign[field])
    .filter(value => value !== null && value !== undefined);
  
  if (validValues.length === 0) return null;
  
  const sum = validValues.reduce((total, value) => total + value, 0);
  return parseFloat((sum / validValues.length).toFixed(2));
}

module.exports = dashboardService; 