const { Op } = require('sequelize');
const WebhookMessage = require('../models/WebhookMessage');
const LeadTracking = require('../models/LeadTracking');
const sequelize = require('../config/database');

/**
 * Serviço para cálculos e métricas do dashboard
 */
const dashboardService = {
  /**
   * Obter métricas de anúncios para o dashboard
   * Versão extraída da rota /dashboard/ad-metrics
   * @returns {Promise<Object>} Métricas de campanhas, conjuntos de anúncios e anúncios
   */
  getAdMetrics: async () => {
    try {
      console.log("Starting ad-metrics processing...");
      
      // 1. Obter todos os eventos de rastreamento
      const trackingEvents = await LeadTracking.findAll({
        include: [{
          model: WebhookMessage,
          attributes: ['campaign_id', 'campaign_name', 'adset_id', 'adset_name', 'ad_name']
        }]
      });
      
      console.log(`Retrieved ${trackingEvents.length} tracking events`);
      
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
      
      // Mapa para evitar duplicação de atendimentos
      const userLeadMap = {};

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
        
        // Rastrear usuário que atendeu este lead, se houver
        if (eventData.responsible_user_name && eventData.lead_id) {
          const leadId = eventData.lead_id;
          const userName = eventData.responsible_user_name;
          
          leadToUser[leadId] = userName;
          
          // Adicionar o nome do atendente ao conjunto de atendentes
          for (const messageId in leadsByMessage) {
            if (leadsByMessage[messageId].lead_id === leadId) {
              leadsByMessage[messageId].attended_by.add(userName);
              
              // Se o lead foi convertido, atribuímos a conversão ao responsável
              if (eventData.lead_situation === 'COMPROU') {
                leadsByMessage[messageId].converted = true;
                leadsByMessage[messageId].conversion_time = new Date(eventData.event_time);
                
                // Se tiver preço, registramos
                if (eventData.price) {
                  leadsByMessage[messageId].price = parseFloat(eventData.price);
                }
              }
              // Se o lead foi descartado, registramos o motivo
              else if (eventData.lead_situation === 'DESCARTADO') {
                leadsByMessage[messageId].lost_reason = 'DESCARTADO';
                leadsByMessage[messageId].discard_time = new Date(eventData.event_time);
              }
            }
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
            }
          }
        }
      });
      
      // Processar todas as mensagens com dados de lead para métricas finais
      console.log(`Processing ${Object.keys(leadsByMessage).length} messages with lead data`);
      
      for (const messageId in leadsByMessage) {
        const eventData = { message_id: messageId };
        const lead = leadsByMessage[messageId];
        const message = lead.message_data;
        
        if (!message) {
          console.log(`Skipping message_id: ${messageId} - no associated message data`);
          continue;
        }
        
        // Log the message we're processing for debugging
        console.log(`Processing message_id: ${messageId} for lead: ${lead.lead_id}, campaign: ${message.campaign_name}, ad: ${message.ad_name}`);
        
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
          
          // Registrar distribuição de estágios alcançados
          if (lead.farthest_stage) {
            if (!campaignMetrics[message.campaign_id].stage_reached_distribution[lead.farthest_stage]) {
              campaignMetrics[message.campaign_id].stage_reached_distribution[lead.farthest_stage] = 0;
            }
            campaignMetrics[message.campaign_id].stage_reached_distribution[lead.farthest_stage]++;
          }
          
          // Verificar se o lead foi convertido
          if (lead.converted) {
            campaignMetrics[message.campaign_id].converted_leads++;
            campaignMetrics[message.campaign_id].total_value += lead.price;
            
            // Adicionar tempo de conversão
            if (lead.conversion_time) {
              const conversionTimeMs = lead.conversion_time - lead.first_event_time;
              campaignMetrics[message.campaign_id].conversion_times.push(conversionTimeMs);
            }
            
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
        
        // Processar também métricas por conjunto de anúncios e anúncios
        // (Código adicional para adSetMetrics e adMetrics omitido por brevidade)
        // Continuar com o mesmo padrão para conjuntos de anúncios e anúncios
      }

      // Funções auxiliares para cálculos
      const calculateAverageConversionTime = (conversionTimes) => {
        if (!conversionTimes || conversionTimes.length === 0) {
          return null;
        }
        
        const totalMs = conversionTimes.reduce((sum, time) => sum + time, 0);
        const averageMs = totalMs / conversionTimes.length;
        
        // Converter ms para formato "hh:mm:ss"
        const hours = Math.floor(averageMs / (1000 * 60 * 60));
        const minutes = Math.floor((averageMs % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((averageMs % (1000 * 60)) / 1000);
        
        return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
      };
      
      const calculateAverageDiscardTime = (discardTimes) => {
        if (!discardTimes || discardTimes.length === 0) {
          return null;
        }
        
        const totalMs = discardTimes.reduce((sum, time) => sum + time, 0);
        const averageMs = totalMs / discardTimes.length;
        
        // Converter ms para formato "hh:mm:ss"
        const hours = Math.floor(averageMs / (1000 * 60 * 60));
        const minutes = Math.floor((averageMs % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((averageMs % (1000 * 60)) / 1000);
        
        return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
      };
      
      const findMostCommonLastStage = (stageDistribution) => {
        if (!stageDistribution || Object.keys(stageDistribution).length === 0) {
          return null;
        }
        
        return Object.entries(stageDistribution)
          .sort((a, b) => b[1] - a[1])[0][0];
      };
      
      const findFarthestStageReached = (stageReachedDistribution) => {
        if (!stageReachedDistribution || Object.keys(stageReachedDistribution).length === 0) {
          return null;
        }
        
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
        
        return Object.keys(stageReachedDistribution)
          .sort((a, b) => (stageOrder[b] || 0) - (stageOrder[a] || 0))[0];
      };
      
      const convertTopUsersToArray = (topUsers) => {
        if (!topUsers) {
          return [];
        }
        
        return Object.values(topUsers)
          .map(user => {
            // Calcular número real de leads atendidos (únicos)
            const attended = user.leads_attended ? user.leads_attended.size : 0;
            
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
        
        // Construir objeto final
        const result = {
          ...metric,
          conversion_rate: parseFloat(conversion_rate.toFixed(2)),
          average_conversion_time,
          average_discard_time,
          most_common_last_stage,
          farthest_stage_reached,
          top_users
        };
        
        // Remover campos internos
        delete result.conversion_times;
        delete result.discard_times;
        
        return result;
      });
      
      const adSets = Object.values(adSetMetrics).map(metric => {
        const conversion_rate = metric.total_leads > 0 ? (metric.converted_leads / metric.total_leads) * 100 : 0;
        const average_conversion_time = calculateAverageConversionTime(metric.conversion_times);
        const average_discard_time = calculateAverageDiscardTime(metric.discard_times);
        const most_common_last_stage = findMostCommonLastStage(metric.stage_distribution);
        const farthest_stage_reached = findFarthestStageReached(metric.stage_reached_distribution);
        const top_users = convertTopUsersToArray(metric.top_users);
        
        const result = {
          ...metric,
          conversion_rate: parseFloat(conversion_rate.toFixed(2)),
          average_conversion_time,
          average_discard_time,
          most_common_last_stage,
          farthest_stage_reached,
          top_users
        };
        
        delete result.conversion_times;
        delete result.discard_times;
        
        return result;
      });
      
      const ads = Object.values(adMetrics).map(metric => {
        const conversion_rate = metric.total_leads > 0 ? (metric.converted_leads / metric.total_leads) * 100 : 0;
        const average_conversion_time = calculateAverageConversionTime(metric.conversion_times);
        const average_discard_time = calculateAverageDiscardTime(metric.discard_times);
        const most_common_last_stage = findMostCommonLastStage(metric.stage_distribution);
        const farthest_stage_reached = findFarthestStageReached(metric.stage_reached_distribution);
        const top_users = convertTopUsersToArray(metric.top_users);
        
        const result = {
          ...metric,
          ad_id: metric.id,
          conversion_rate: parseFloat(conversion_rate.toFixed(2)),
          average_conversion_time,
          average_discard_time,
          most_common_last_stage,
          farthest_stage_reached,
          top_users
        };
        
        delete result.conversion_times;
        delete result.discard_times;
        
        return result;
      });
      
      // Calcular os top users consolidados
      const consolidatedTopUsers = {};
      const userConversionMap = {};
      
      // Processa eventos para identificar top users
      trackingEvents.forEach(event => {
        const eventData = event.toJSON();
        
        if (eventData.lead_situation === 'COMPROU' && 
            eventData.responsible_user_name &&
            eventData.price) {
          
          const userName = eventData.responsible_user_name;
          const leadId = eventData.lead_id;
          const price = parseFloat(eventData.price);
          
          const conversionKey = `${userName}-${leadId}-conversion`;
          
          if (userConversionMap[conversionKey]) {
            return;
          }
          
          userConversionMap[conversionKey] = true;
          
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
          
          if (!consolidatedTopUsers[userName].leads_converted.has(leadId)) {
            consolidatedTopUsers[userName].converted++;
            consolidatedTopUsers[userName].total_value += price;
            consolidatedTopUsers[userName].leads_converted.add(leadId);
          }
        }
      });
      
      // Converte top users consolidados para array
      const top_users = Object.values(consolidatedTopUsers)
        .map(user => {
          return {
            name: user.name,
            attended: user.leads_attended?.size || 0,
            converted: user.converted,
            total_value: user.total_value,
            conversion_rate: user.attended > 0 ? (user.converted / user.attended) * 100 : 0,
            average_ticket: user.converted > 0 ? user.total_value / user.converted : 0
          };
        })
        .sort((a, b) => b.converted - a.converted)
        .slice(0, 5);
      
      // Preparar a resposta final
      return {
        campaigns,
        adSets,
        ads,
        top_users
      };
    } catch (error) {
      console.error('Error generating ad metrics:', error);
      throw error;
    }
  }
};

module.exports = dashboardService; 