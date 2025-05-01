const { Op } = require('sequelize');
const WebhookMessage = require('../models/WebhookMessage');
const LeadTracking = require('../models/LeadTracking');
const sequelize = require('../config/database');

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
   * Obter métricas de anúncios para o dashboard
   * Versão extraída da rota /dashboard/ad-metrics
   * @returns {Promise<Object>} Métricas de campanhas, conjuntos de anúncios e anúncios
   */
  getAdMetrics: async () => {
    try {
      // Add debug logging
      console.log("Starting ad-metrics processing...");
      
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
              responsible_user_name: eventData.responsible_user_name || null,
              attended_by: new Set(),
              // Add a reference to the message data for easier lookup
              message_data: eventData.WebhookMessage || null
            };
          }
        }
        
        // Atualizar último evento e estágio
        const leadId = eventData.lead_id;
        
        // Encontrar todos os leads associados a este lead_id
        for (const messageId in leadsByMessage) {
          if (leadsByMessage[messageId].lead_id === leadId) {
            // Atualizar os dados do lead
            leadsByMessage[messageId].last_event_time = new Date(eventData.event_time);
            
            // Atualizar estágio atual
            if (eventData.current_status_name) {
              leadsByMessage[messageId].last_stage = eventData.current_status_name;
            }
            
            // Atualizar estágio mais distante alcançado
            if (eventData.current_status_name) {
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
              
              const currentStageOrder = stageOrder[eventData.current_status_name] || 0;
              const farthestStageOrder = stageOrder[leadsByMessage[messageId].farthest_stage] || 0;
              
              // Se o estágio atual for de ordem mais alta, ou for LEAD DESCARTADO, atualizamos
              if (currentStageOrder > farthestStageOrder || eventData.current_status_name === 'LEAD DESCARTADO') {
                leadsByMessage[messageId].farthest_stage = eventData.current_status_name;
              }
              
              // Casos especiais para estágios com mesma ordem
              if (currentStageOrder === farthestStageOrder) {
                // Priorização entre estágios com a mesma ordem
                const stagePriorities = {
                  'LEAD QUENTE': 1,   // Prioridade maior (número menor)
                  'AGENDADO': 2,      
                  'GARANTIA': 1,      // Prioridade maior
                  'ASSISTÊNCIA': 2    
                };
                
                const currentPriority = stagePriorities[eventData.current_status_name] || 999;
                const farthestPriority = stagePriorities[leadsByMessage[messageId].farthest_stage] || 999;
                
                // Número menor significa maior prioridade
                if (currentPriority < farthestPriority) {
                  leadsByMessage[messageId].farthest_stage = eventData.current_status_name;
                }
              }
            }
            
            // Registrar usuário responsável
            if (eventData.responsible_user_name) {
              leadsByMessage[messageId].responsible_user_name = eventData.responsible_user_name;
              leadsByMessage[messageId].attended_by.add(eventData.responsible_user_name);
            }
            
            // Se for COMPROU, registrar como conversão
            if (eventData.lead_situation === 'COMPROU' && eventData.price) {
              leadsByMessage[messageId].converted = true;
              leadsByMessage[messageId].price = parseFloat(eventData.price);
              leadsByMessage[messageId].conversion_time = new Date(eventData.event_time);
              
              // Registrar a conversão no mapa por lead
              conversionsByLead[leadId] = {
                price: parseFloat(eventData.price),
                conversion_time: new Date(eventData.event_time)
              };
            }
            
            // Se tiver um lead_situation diferente de COMPROU, registrar como descarte
            if (eventData.lead_situation && eventData.lead_situation !== 'COMPROU') {
              leadsByMessage[messageId].lost_reason = eventData.lead_situation;
              leadsByMessage[messageId].discard_time = new Date(eventData.event_time);
              
              // Registrar o descarte no mapa por lead
              discardsByLead[leadId] = {
                reason: eventData.lead_situation,
                discard_time: new Date(eventData.event_time)
              };
            }
            
            // Registrar o usuário responsável
            if (eventData.responsible_user_name) {
              leadToUser[leadId] = eventData.responsible_user_name;
            }
          }
        }
      });
      
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
              });
            
            // Registrar usuário responsável pelo lead
            if (leadToUser[lead.lead_id]) {
              const userName = leadToUser[lead.lead_id];
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
              });
              
              // Registrar usuário responsável pelo lead
              if (leadToUser[lead.lead_id]) {
                const userName = leadToUser[lead.lead_id];
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
              const userLeadKey = `${userName}-${lead.lead_id}`;
              
              // Se já contabilizamos este atendimento, pule
              if (userLeadMap[userLeadKey]) {
                return;
              }
              
              // Marca este atendimento como contabilizado
              userLeadMap[userLeadKey] = true;
              
              if (!adMetrics[adKey].top_users[userName]) {
                adMetrics[adKey].top_users[userName] = {
                  name: userName,
                  attended: 0,
                  converted: 0,
                  total_value: 0,
                  leads_attended: new Set() // Conjunto para rastrear leads únicos
                };
              }
              
              // Incrementa o contador de atendimentos (agora sem duplicação)
              adMetrics[adKey].top_users[userName].attended++;
              // Adiciona o lead_id ao conjunto de leads atendidos
              adMetrics[adKey].top_users[userName].leads_attended.add(lead.lead_id);
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
                const userName = lead.responsible_user_name;
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
                const userName = lead.responsible_user_name;
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
  
      // Função para calcular o tempo médio de conversão
      const calculateAverageConversionTime = (conversionTimes) => {
        if (conversionTimes.length === 0) return null;
        
        const totalMs = conversionTimes.reduce((sum, time) => sum + time, 0);
        const avgMs = totalMs / conversionTimes.length;
        
        // Converter para formato HH:MM:SS
        const hours = Math.floor(avgMs / (1000 * 60 * 60));
        const minutes = Math.floor((avgMs % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((avgMs % (1000 * 60)) / 1000);
        
        return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
      };
      
      // Função para calcular o tempo médio até descarte
      const calculateAverageDiscardTime = (discardTimes) => {
        if (discardTimes.length === 0) return null;
        
        const totalMs = discardTimes.reduce((sum, time) => sum + time, 0);
        const avgMs = totalMs / discardTimes.length;
        
        // Converter para formato HH:MM:SS
        const hours = Math.floor(avgMs / (1000 * 60 * 60));
        const minutes = Math.floor((avgMs % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((avgMs % (1000 * 60)) / 1000);
        
        return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
      };
      
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
          .slice(0, 5); // Top 5 usuários em vez de 3
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
        
        // Log the individual ad metric
        console.log(`Processing ad: ${metric.ad_name}, leads: ${metric.total_leads}`);
        
        return {
          ...metric,
          ad_id: metric.id, // Ensure consistent field naming
          conversion_rate: parseFloat(conversion_rate.toFixed(2)),
          average_conversion_time,
          average_discard_time,
          most_common_last_stage,
          farthest_stage_reached,
          top_users
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
        top_users: []
      };
      
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
      });
      
      // Calcular os top users consolidados
      const consolidatedTopUsers = {};
      // Mapa para rastrear leads convertidos por usuário (para evitar duplicação)
      const userConversionMap = {};
      
      // Processar todos os usuários de anúncios para garantir que capturamos todos
      // Mesmo aqueles que não têm conversões (como Felipe Quichaba)
      Object.values(adMetrics).forEach(ad => {
        Object.values(ad.top_users).forEach(user => {
          if (!consolidatedTopUsers[user.name]) {
            consolidatedTopUsers[user.name] = {
              name: user.name,
              attended: 0,
              converted: 0,
              total_value: 0,
              leads_attended: new Set(), // Guardar os leads atendidos por este usuário
              leads_converted: new Set() // Guardar os leads convertidos por este usuário
            };
          }
          
          // Transferir os leads atendidos
          if (user.leads_attended) {
            user.leads_attended.forEach(leadId => {
              consolidatedTopUsers[user.name].leads_attended.add(leadId);
            });
          }
        });
      });
      
      // Uma segunda passagem para capturar conversões de forma mais precisa (dos ads)
      // Isso evita duplicações, pois estamos trabalhando diretamente com os leads
      trackingEvents.forEach(event => {
        const eventData = event.toJSON();
        
        // Apenas para eventos de conversão
        if (eventData.lead_situation === 'COMPROU' && 
            eventData.responsible_user_name &&
            eventData.price) {
          
          const userName = eventData.responsible_user_name;
          const leadId = eventData.lead_id;
          const price = parseFloat(eventData.price);
          
          // Chave única para este par usuário-lead-conversão
          const conversionKey = `${userName}-${leadId}-conversion`;
          
          // Pular se já contabilizamos esta conversão
          if (userConversionMap[conversionKey]) {
            return;
          }
          
          // Marcar como contabilizado
          userConversionMap[conversionKey] = true;
          
          // Adicionar à lista consolidada
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
          
          // Incrementar conversão se ainda não contabilizamos este lead
          if (!consolidatedTopUsers[userName].leads_converted.has(leadId)) {
            consolidatedTopUsers[userName].converted++;
            consolidatedTopUsers[userName].total_value += price;
            consolidatedTopUsers[userName].leads_converted.add(leadId);
          }
        }
      });
      
      // Após juntar todos os leads, atualizamos o contador de attended
      Object.values(consolidatedTopUsers).forEach(user => {
        user.attended = user.leads_attended.size;
        
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
      
      return(response);
    } catch (error) {
      console.error('Error fetching ad metrics:', error);
    return ({ error: error.message });
    }
  }
};

module.exports = dashboardService; 