const axios = require('axios');
const KommoToken = require('../models/KommoToken');

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

module.exports = {
  searchLeadByPhone,
  refreshKommoToken,
  getPipelineDetails,
  getLeadDetails,
  getContactDetails,
  extractPhoneFromContact,
  getUserDetails
}; 