const axios = require('axios');
const KommoToken = require('../models/KommoToken');
const { 
  KOMMO_CLIENT_ID, 
  KOMMO_CLIENT_SECRET, 
  KOMMO_REDIRECT_URI,
  NGROK_URL
} = require('../config/kommo');

// Função para buscar lead por telefone
async function searchLeadByPhone(phone, accessToken, domain) {
  try {
    console.log(`🔍 Buscando lead com telefone ${phone} no Kommo...`);
    
    // Remover caracteres não numéricos do telefone
    const cleanPhone = phone.replace(/\D/g, '');
    
    // Construir a URL da API
    const apiUrl = `https://${domain}/api/v4/leads`;
    
    // Configurar os headers
    const headers = {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    };
    
    // Configurar os parâmetros da query
    const params = {
      with: 'contacts,custom_fields_values',
      query: cleanPhone
    };
    
    // Fazer a requisição
    const response = await axios.get(apiUrl, { headers, params });
    
    if (response.status === 200) {
      console.log(`✅ Lead encontrado no Kommo!`);
      return {
        status: 'success',
        leads: response.data._embedded.leads
      };
    }
    
    return {
      status: 'error',
      message: 'Erro ao buscar lead no Kommo'
    };
  } catch (error) {
    console.error('❌ Erro ao buscar lead no Kommo:', error.message);
    return {
      status: 'error',
      message: error.message
    };
  }
}

// Função para renovar o token de acesso
async function refreshKommoToken(refreshToken, domain) {
  try {
    console.log('🔄 Renovando token de acesso do Kommo...');
    
    // Construir a URL da API
    const apiUrl = `https://${domain}/oauth2/access_token`;
    
    // Configurar os parâmetros
    const params = new URLSearchParams();
    params.append('grant_type', 'refresh_token');
    params.append('client_id', process.env.KOMMO_CLIENT_ID);
    params.append('client_secret', process.env.KOMMO_CLIENT_SECRET);
    params.append('refresh_token', refreshToken);
    
    // Fazer a requisição
    const response = await axios.post(apiUrl, params);
    
    if (response.status === 200) {
      console.log('✅ Token renovado com sucesso!');
      return {
        access_token: response.data.access_token,
        refresh_token: response.data.refresh_token,
        expires_at: new Date(Date.now() + response.data.expires_in * 1000)
      };
    }
    
    return null;
  } catch (error) {
    console.error('❌ Erro ao renovar token:', error.message);
    return null;
  }
}

// Função para obter detalhes do pipeline
async function getPipelineDetails(domain, accessToken) {
  try {
    console.log('🔍 Buscando detalhes do pipeline no Kommo...');
    
    // Construir a URL da API
    const apiUrl = `https://${domain}/api/v4/leads/pipelines`;
    
    // Configurar os headers
    const headers = {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    };
    
    // Fazer a requisição
    const response = await axios.get(apiUrl, { headers });
    
    if (response.status === 200) {
      console.log('✅ Detalhes do pipeline obtidos com sucesso!');
      
      const pipelinesData = response.data;
      
      // Formatar os dados de pipelines
      const pipelines = {};
      if (pipelinesData._embedded && pipelinesData._embedded.pipelines) {
        for (const pipeline of pipelinesData._embedded.pipelines) {
          const pipelineId = pipeline.id;
          const pipelineName = pipeline.name;
          
          // Obter estágios deste pipeline
          const stages = {};
          if (pipeline._embedded && pipeline._embedded.statuses) {
            for (const stage of pipeline._embedded.statuses) {
              const stageId = stage.id;
              const stageName = stage.name;
              const stageColor = stage.color;
              stages[stageId] = {
                name: stageName,
                color: stageColor
              };
            }
          }
          
          pipelines[pipelineId] = {
            name: pipelineName,
            stages: stages
          };
        }
      }
      
      return pipelines;
    }
    
    return null;
  } catch (error) {
    console.error('❌ Erro ao buscar detalhes do pipeline:', error.message);
    return null;
  }
}

// Função para obter detalhes de um lead específico do Kommo
async function getLeadDetails(domain, accessToken, leadId) {
  try {
    // URL da API
    const apiUrl = `https://${domain}/api/v4/leads/${leadId}`;
    
    // Parâmetros para incluir informações de contatos
    const params = {
      with: 'contacts,catalog_elements,custom_fields_values'
    };
    
    // Cabeçalhos com o token de acesso
    const headers = {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    };
    
    // Fazer a requisição para obter os detalhes do lead
    console.log(`🔍 Buscando detalhes do lead ${leadId} com parâmetros:`, params);
    const response = await axios.get(apiUrl, { headers, params });
    
    // Verificar se a requisição foi bem-sucedida
    if (response.status === 200) {
      return response.data;
    } else {
      console.error(`❌ Erro ao obter detalhes do lead: ${response.status} - ${response.data}`);
      return null;
    }
  } catch (error) {
    console.error('❌ Erro ao obter detalhes do lead:', error.message);
    return null;
  }
}

// Função para obter detalhes de um contato específico do Kommo
async function getContactDetails(domain, accessToken, contactId) {
  try {
    // URL da API
    const apiUrl = `https://${domain}/api/v4/contacts/${contactId}`;
    
    // Cabeçalhos com o token de acesso
    const headers = {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    };
    
    // Fazer a requisição para obter os detalhes do contato
    console.log(`🔍 Buscando detalhes do contato ${contactId}`);
    const response = await axios.get(apiUrl, { headers });
    
    // Verificar se a requisição foi bem-sucedida
    if (response.status === 200) {
      return response.data;
    } else {
      console.error(`❌ Erro ao obter detalhes do contato: ${response.status} - ${response.data}`);
      return null;
    }
  } catch (error) {
    console.error('❌ Erro ao obter detalhes do contato:', error.message);
    return null;
  }
}

// Função para extrair o telefone dos detalhes do contato
function extractPhoneFromContact(contactDetails) {
  if (!contactDetails || !contactDetails.custom_fields_values) {
    return null;
  }

  // Procurar por campos de telefone nos custom_fields
  for (const field of contactDetails.custom_fields_values) {
    if (['PHONE', 'TELEFONE', 'CELULAR', 'MOBILE'].includes(field.field_code)) {
      if (field.values && field.values.length > 0) {
        // Pegar o primeiro número de telefone
        for (const value of field.values) {
          if (value.value) {
            // Remover o símbolo '+' e qualquer outro caractere não numérico
            const phone = value.value.replace(/[^0-9]/g, '');
            console.log(`📱 Telefone encontrado: ${phone}`);
            return phone;
          }
        }
      }
    }
  }

  return null;
}

// Função para obter detalhes de um usuário específico do Kommo
async function getUserDetails(domain, accessToken, userId) {
  try {
    // URL da API
    const apiUrl = `https://${domain}/api/v4/users/${userId}`;
    
    // Cabeçalhos com o token de acesso
    const headers = {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    };
    
    // Fazer a requisição para obter os detalhes do usuário
    console.log(`🔍 Buscando detalhes do usuário ${userId}`);
    const response = await axios.get(apiUrl, { headers });
    
    // Verificar se a requisição foi bem-sucedida
    if (response.status === 200) {
      return response.data;
    } else {
      console.error(`❌ Erro ao obter detalhes do usuário: ${response.status} - ${response.data}`);
      return null;
    }
  } catch (error) {
    console.error('❌ Erro ao obter detalhes do usuário:', error.message);
    return null;
  }
}

// Função para trocar código por tokens
async function exchangeCodeForTokens(code, referer = null) {
  try {
    const domain = referer || 'kommo.com';
    const tokenUrl = `https://${domain}/oauth2/access_token`;
    
    const response = await axios.post(tokenUrl, {
      client_id: KOMMO_CLIENT_ID,
      client_secret: KOMMO_CLIENT_SECRET,
      grant_type: 'authorization_code',
      code: code,
      redirect_uri: KOMMO_REDIRECT_URI
    });

    if (response.status === 200) {
      const tokensData = response.data;
      const expiresAt = new Date(Date.now() + (tokensData.expires_in * 1000));
      
      // Extrair account_id do token JWT
      let accountId = null;
      if (tokensData.access_token) {
        try {
          // Dividir o token JWT em suas partes (header.payload.signature)
          const jwtParts = tokensData.access_token.split('.');
          if (jwtParts.length >= 2) {
            // Ajustar o padding para base64
            const padded = jwtParts[1] + '='.repeat((4 - jwtParts[1].length % 4) % 4);
            // Decodificar e converter para JSON
            const jwtPayload = JSON.parse(Buffer.from(padded, 'base64').toString());
            
            // Extrair o account_id do payload
            accountId = jwtPayload.account_id?.toString();
            console.log('Account ID extraído do JWT:', accountId);
          }
        } catch (jwtErr) {
          console.error('Erro ao decodificar JWT:', jwtErr);
        }
      }
      
      // Se não conseguiu extrair do JWT, tentar do base_domain
      if (!accountId && tokensData.base_domain) {
        const domainParts = tokensData.base_domain.split('.');
        if (domainParts.length > 0) {
          accountId = domainParts[0];
          console.log('Account ID extraído do base_domain:', accountId);
        }
      }
      
      // Se ainda não tiver account_id, usar o domínio como identificador
      if (!accountId && domain && domain !== 'kommo.com') {
        const domainParts = domain.split('.');
        if (domainParts.length > 0) {
          accountId = domainParts[0];
          console.log('Account ID extraído do domínio:', accountId);
        }
      }
      
      // Como último recurso, gerar um ID aleatório
      if (!accountId) {
        const { randomBytes } = require('crypto');
        accountId = `unknown_${randomBytes(4).toString('hex')}`;
        console.log('Account ID gerado aleatoriamente:', accountId);
      }
      
      return {
        access_token: tokensData.access_token,
        refresh_token: tokensData.refresh_token,
        expires_at: expiresAt,
        account_id: accountId,
        domain: domain
      };
    }
    return null;
  } catch (error) {
    console.error('Error exchanging code for tokens:', error);
    return null;
  }
}

// Função para verificar o status da autenticação
async function checkAuthStatus() {
  try {
    // Buscar token existente
    const token = await KommoToken.findOne();
    
    if (token) {
      // Verificar se o token está expirado
      const isExpired = new Date() > new Date(token.expires_at);
      
      return {
        isAuthenticated: !isExpired,
        tokenInfo: {
          account_id: token.account_id,
          domain: token.domain,
          expires_at: token.expires_at,
          created_at: token.createdAt,
          updated_at: token.updatedAt
        }
      };
    }
    
    return { isAuthenticated: false };
  } catch (error) {
    console.error('Error checking auth status:', error);
    throw error;
  }
}

// Função para revogar token de autenticação
async function revokeToken(accountId) {
  try {
    if (!accountId) {
      throw new Error('Account ID is required');
    }
    
    // Encontrar e excluir o token
    await KommoToken.destroy({ where: { account_id: accountId } });
    
    return {
      success: true,
      message: 'Token revoked successfully'
    };
  } catch (error) {
    console.error('Error revoking token:', error);
    throw error;
  }
}

// Função para buscar informações da conta Kommo
async function getAccountInfo(accessToken, referer = null) {
  try {
    const domain = referer || 'kommo.com';
    console.log('🔍 Buscando informações da conta Kommo...');
    
    // Fazer a requisição para a API do Kommo
    const response = await axios.get(`https://${domain}/api/v4/account`, {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    });
    
    if (response.data && response.data.id) {
      console.log('✅ Informações da conta obtidas com sucesso!');
      return {
        account_id: response.data.id.toString(),
        domain: domain
      };
    }
    
    return { account_id: 'default', domain: domain };
  } catch (error) {
    console.error('Error fetching account info:', error);
    return { account_id: 'default', domain: referer || 'kommo.com' };
  }
}

// Função para criar um rastreamento manual de estágio do lead no Kommo
async function createLeadStageTracking(leadId, phone) {
  try {
    console.log(`🔍 Criando rastreamento de estágio para o lead ${leadId} com telefone ${phone}`);
    
    // Buscar o token mais recente do Kommo
    const token = await KommoToken.findOne({
      order: [['created_at', 'DESC']]
    });
    
    if (!token) {
      return { 
        status: 'error', 
        message: 'Nenhum token de acesso para o Kommo configurado' 
      };
    }
    
    // Construir o domínio
    let domain = token.domain;
    if (!domain.startsWith('http')) {
      if (!domain.endsWith('.kommo.com')) {
        domain = `${domain}.kommo.com`;
      }
    }
    
    // Se não temos o ID do lead, mas temos o telefone, buscamos o lead pelo telefone
    if (!leadId && phone) {
      console.log(`🔍 Buscando lead no Kommo para o telefone: ${phone}`);
      const result = await searchLeadByPhone(phone, token.access_token, domain);
      
      if (result.status !== 'success' || !result.leads || result.leads.length === 0) {
        return { 
          status: 'error', 
          message: `Nenhum lead encontrado no Kommo para o telefone ${phone}` 
        };
      }
      
      // Lead encontrado, usar o primeiro da lista
      const lead = result.leads[0];
      leadId = lead.id;
    }
    
    // Obter detalhes do lead
    const leadDetails = await getLeadDetails(domain, token.access_token, leadId);
    
    if (!leadDetails) {
      return { 
        status: 'error', 
        message: `Não foi possível obter detalhes do lead ${leadId}` 
      };
    }
    
    // Obter informações do pipeline e status
    const pipelineDetails = await getPipelineDetails(domain, token.access_token);
    
    if (!pipelineDetails) {
      return { 
        status: 'error', 
        message: 'Não foi possível obter detalhes dos pipelines' 
      };
    }
    
    // Extrair dados do lead
    const pipelineId = leadDetails.pipeline_id;
    const statusId = leadDetails.status_id;
    const currentPipeline = pipelineDetails[pipelineId];
    const currentStatus = currentPipeline?.stages?.[statusId];
    
    // Extrair nome do responsável, se disponível
    let responsibleUserName = null;
    if (leadDetails.responsible_user_id) {
      const userDetails = await getUserDetails(domain, token.access_token, leadDetails.responsible_user_id);
      if (userDetails) {
        responsibleUserName = `${userDetails.name} ${userDetails.surname}`;
      }
    }
    
    // Buscar campo personalizado "Situação do lead"
    let leadSituation = null;
    if (leadDetails.custom_fields_values) {
      for (const field of leadDetails.custom_fields_values) {
        if (['Situação do lead', 'Situacao do lead', 'Situação', 'Situacao'].includes(field.field_name)) {
          if (field.values && field.values.length > 0) {
            leadSituation = field.values[0].value;
            break;
          }
        }
      }
    }
    
    // Criar o registro de rastreamento
    const LeadTracking = require('../models/LeadTracking');
    const leadTracking = await LeadTracking.create({
      lead_id: leadId.toString(),
      phone: phone,
      event_type: 'lead_status_changed',
      source_id: leadDetails.source_id || null,
      current_pipeline_id: pipelineId?.toString() || null,
      current_pipeline_name: currentPipeline?.name || null,
      current_status_id: statusId?.toString() || null,
      current_status_name: currentStatus?.name || null,
      lead_situation: leadSituation,
      price: leadDetails.price || null,
      responsible_user_id: leadDetails.responsible_user_id?.toString() || null,
      responsible_user_name: responsibleUserName || null,
      is_manually_created: true
    });
    
    return {
      status: 'success',
      message: 'Rastreamento de estágio criado com sucesso',
      tracking: leadTracking
    };
  } catch (error) {
    console.error('❌ Erro ao criar rastreamento de estágio:', error.message);
    return {
      status: 'error',
      message: `Erro ao criar rastreamento de estágio: ${error.message}`
    };
  }
}

// Exportar todas as funções
module.exports = {
  searchLeadByPhone,
  refreshKommoToken,
  getPipelineDetails,
  getLeadDetails,
  getContactDetails,
  extractPhoneFromContact,
  getUserDetails,
  exchangeCodeForTokens,
  checkAuthStatus,
  revokeToken,
  getAccountInfo,
  createLeadStageTracking
}; 