const axios = require('axios');
const WebhookMessage = require('../models/WebhookMessage');
const KommoToken = require('../models/KommoToken');
const LeadTracking = require('../models/LeadTracking');
const { searchLeadByPhone, refreshKommoToken, getPipelineDetails } = require('./kommoService');

// URL do webhook do Make
const MAKE_WEBHOOK_URL = "https://hook.us2.make.com/cig25e7rx3x5xdf85vlyx35xx8xa931j";

// Token de acesso do Facebook Graph API
const FB_ACCESS_TOKEN = "EAAU85NkleoUBO9DtADN5yv65TFm7yCA1Y8POz5qMMmcleOCpf5EZAZBCKMtRChZBGzZBVdoWDCUbwgFJyorvHw6UZCfUMrFeU3dvdZAnEJ8MKzjEPiOHHfo4FHTrKymZBVxWwGxqfNAHcxhYdGtrzz7zA5VDy368yx3zjtRmZB0KabtjUqTq3kNYiYR9CSLbsj3foaoqZCJZA0ZAfaA9nui";

class WebhookService {

  async processMessage(data) {
    try {
      //console.log('📩 Dados recebidos:', JSON.stringify(data, null, 2));
      console.log('📩 Nova mensagem recebida da Evolution API!');
  
      const messageData = data.data || {};
  
      const telefoneCompleto = messageData.key?.remoteJid || 'Desconhecido';
      const telefone = telefoneCompleto.split('@')[0] || 'Desconhecido';
      const nome = messageData.pushName || 'Desconhecido';
      const dispositivo = messageData.source || 'Desconhecido';
  
      // Extrair mensagem de texto
      let mensagem = '';
      if (messageData.message?.conversation) {
        mensagem = messageData.message.conversation;
      } else if (messageData.message?.extendedTextMessage?.text) {
        mensagem = messageData.message.extendedTextMessage.text;
      } else if (messageData.body) {
        mensagem = messageData.body;
      }
  
      const isFromMe = messageData.key?.fromMe || false;
  
      // Variáveis para o DB
      let sourceId = null;
      let title = null;
      let body = null;
      let mediaUrl = null;
      let thumbnailUrl = null;
      let sourceUrl = null;
      let encaminhado = false;
      let adName = null;
      let adsetName = null;
      let adsetId = null;
      let campaignName = null;
      let campaignId = null;
  
      // Verificar se tem contextInfo.externalAdReply
      const contextInfo = messageData.contextInfo || messageData.message?.contextInfo || messageData.message?.extendedTextMessage?.contextInfo;
      const externalAdReply = contextInfo?.externalAdReply;
  
      if (externalAdReply) {
        sourceId = externalAdReply.sourceId || null;
        title = externalAdReply.title || null;
        body = externalAdReply.body || null;
        mediaUrl = externalAdReply.mediaUrl || null;
        thumbnailUrl = externalAdReply.thumbnailUrl || null;
        sourceUrl = externalAdReply.sourceUrl || null;
      }
  
      
  
      let shouldSave = false;
  
      if (sourceId) {
        console.log('🔍 Source ID identificado:', sourceId);
        try {
          console.log(`🔵 Buscando informações do anúncio ${sourceId} no Facebook...`);
  
          const fbApiUrl = `https://graph.facebook.com/v18.0/${sourceId}?fields=name,adset_id,adset.fields(name),campaign_id,campaign.fields(name)&access_token=${FB_ACCESS_TOKEN}`;
  
          const response = await axios.get(fbApiUrl);
  
          if (response.status === 200) {
            const { name, adset_id, adset, campaign_id, campaign } = response.data;
  
            adName = name;
            adsetId = adset_id;
            adsetName = adset?.name;
            campaignId = campaign_id;
            campaignName = campaign?.name;
  
            console.log('✅ Dados do anúncio obtidos com sucesso!');
          }
        } catch (error) {
           if (error.response) {
    console.error('❌ Erro ao buscar dados do anúncio:', error.response.data);
  } else {
    console.error('❌ Erro ao buscar dados do anúncio:', error.message);
  }
        }
  
        // Encaminhar para o Make
        try {
          console.log('📤 Encaminhando mensagem para o Make...');
          const makePayload = {
            telefone,
            nome,
            mensagem,
            dispositivo,
            source_id: sourceId,
            title,
            body,
            media_url: mediaUrl,
            thumbnail_url: thumbnailUrl,
            source_url: sourceUrl,
            ad_name: adName,
            adset_name: adsetName,
            adset_id: adsetId,
            campaign_name: campaignName,
            campaign_id: campaignId,
            date_time: data.date_time
          };
  
          const makeResponse = await axios.post(MAKE_WEBHOOK_URL, makePayload);
  
          if (makeResponse.status === 200) {
            console.log('✅ Mensagem encaminhada para o Make com sucesso!');
            encaminhado = true;
          }
        } catch (error) {
          console.error(`❌ Erro ao encaminhar mensagem para o Make: ${error.message}`);
        }
      }
  
      // Só salvar se NÃO for fromMe E tiver sourceId
      if (!isFromMe && sourceId) {
        shouldSave = true;
      }
  
      let messageId = null;
      if (shouldSave) {
        console.log('💾 Condições atendidas. Salvando no banco de dados...');
  
        const webhookMessage = await this.saveMessage({
          telefone,
          nome,
          dispositivo,
          mensagem,
          source_id: sourceId,
          title,
          body,
          media_url: mediaUrl,
          thumbnail_url: thumbnailUrl,
          source_url: sourceUrl,
          encaminhado_make: encaminhado,
          date_time: data.date_time,
          ad_name: adName,
          adset_name: adsetName,
          adset_id: adsetId,
          campaign_name: campaignName,
          campaign_id: campaignId
        });
  
        messageId = webhookMessage.id;
        
        // Rastrear o lead no Kommo se for mensagem de anúncio
        if (messageId && sourceId) {
          try {
            console.log(`🔍 Rastreando lead no Kommo para o telefone: ${telefone}`);
            
            // Buscar o primeiro token disponível
            const token = await KommoToken.findOne({
              order: [['created_at', 'DESC']]
            });
            
            if (token) {
              // Verificar se o token está válido e renovar se necessário
              const now = new Date();
              const expiresAt = new Date(token.expires_at);
              
              if (now > expiresAt) {
                console.log('🔄 Token expirado, tentando renovar...');
                const newTokens = await refreshKommoToken(token.refresh_token, token.domain);
                
                if (newTokens) {
                  // Atualizar o token
                  await token.update({
                    access_token: newTokens.access_token,
                    refresh_token: newTokens.refresh_token,
                    expires_at: newTokens.expires_at
                  });
                } else {
                  console.error('❌ Falha ao renovar token de acesso para o Kommo.');
                }
              }
              
              // Construir o domínio completo
              let domain = token.domain;
              if (!domain.startsWith('http')) {
                // Verificar se já termina com .kommo.com para evitar duplicação
                if (!domain.endsWith('.kommo.com')) {
                  domain = `${domain}.kommo.com`;
                }
              }
              
              // Buscar lead no Kommo
              const result = await searchLeadByPhone(telefone, token.access_token, domain);
              
              if (result.status === 'success' && result.leads && result.leads.length > 0) {
                // Lead encontrado, registrar no sistema de rastreamento
                const lead = result.leads[0];
                const leadId = lead.id;
                const pipelineId = lead.pipeline_id;
                const statusId = lead.status_id;
                
                // Buscar detalhes do pipeline e status
                const pipelineDetails = await getPipelineDetails(domain, token.access_token);
                
                console.log('------ 😇 pipelineDetails', JSON.stringify(pipelineDetails, null, 2));
                
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
                
                // Registrar rastreamento do lead
                await LeadTracking.create({
                  message_id: messageId,
                  lead_id: leadId,
                  phone: telefone,
                  event_type: 'message_received',
                  source_id: sourceId,
                  current_pipeline_id: pipelineId,
                  current_pipeline_name: currentPipeline?.name || null,
                  current_status_id: statusId,
                  current_status_name: currentStatus?.name || null,
                  lead_situation: leadSituation
                });
                
                console.log('✅ Lead encontrado no Kommo e rastreamento registrado');
                console.log(`📊 Pipeline: ${currentPipeline?.name}, Status: ${currentStatus?.name}`);
              } else {
                console.log(`ℹ️ Nenhum lead encontrado no Kommo para o telefone ${telefone}`);
              }
            } else {
              console.warn('⚠️ Nenhum token de acesso para o Kommo configurado.');
            }
          } catch (error) {
            console.error(`❌ Erro ao rastrear lead no Kommo: ${error.message}`);
          }
        }
  
        return webhookMessage;
      }
  
      return { status: 'success', message: 'Mensagem processada com sucesso' };
    } catch (error) {
      console.error('❌ Erro ao processar mensagem:', error);
      throw error;
    }
  }
  

  async saveMessage({
    telefone,
    nome,
    dispositivo,
    mensagem,
    sourceId,
    title,
    url,
    encaminhado_make,
    date_time,
    ad_name,
    adset_name,
    adset_id,
    campaign_name,
    campaign_id
  }) {
    try {
      const webhookMessage = await WebhookMessage.create({
        telefone,
        nome,
        dispositivo,
        mensagem,
        source_id: sourceId,
        title,
        url,
        encaminhado_make,
        date_time,
        ad_name,
        adset_name,
        adset_id,
        campaign_name,
        campaign_id,
        date_time: new Date().toISOString()
      });

      return webhookMessage;
    } catch (error) {
      console.error('Erro ao salvar mensagem:', error);
      throw error;
    }
  }

  async sendToMake(webhookData) {
    try {
      await axios.post(MAKE_WEBHOOK_URL, webhookData);
    } catch (error) {
      console.error('Erro ao enviar para o Make:', error);
      throw error;
    }
  }

  async getFacebookAdData(sourceId) {
    try {
      const response = await axios.get(
        `https://graph.facebook.com/v18.0/${sourceId}`,
        {
          params: {
            access_token: FB_ACCESS_TOKEN,
            fields: 'name,adset{name,id,campaign{name,id}}'
          }
        }
      );

      const { name: adName, adset } = response.data;
      const { name: adsetName, id: adsetId, campaign } = adset;
      const { name: campaignName, id: campaignId } = campaign;

      return {
        adName,
        adsetName,
        adsetId,
        campaignName,
        campaignId
      };
    } catch (error) {
      console.error('Erro ao buscar dados do anúncio:', error);
      return null;
    }
  }

  async getMessages() {
    try {
      const messages = await WebhookMessage.findAll({
        order: [['date_time', 'DESC']],
        limit: 100
      });
      
      return messages;
    } catch (error) {
      console.error('Erro ao buscar mensagens:', error);
      throw error;
    }
  }
}

module.exports = new WebhookService(); 