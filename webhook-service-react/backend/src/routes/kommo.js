const express = require('express');
const router = express.Router();
const axios = require('axios');
const { 
  KOMMO_CLIENT_ID, 
  KOMMO_CLIENT_SECRET, 
  KOMMO_REDIRECT_URI,
  NGROK_URL
} = require('../config/kommo');
const KommoToken = require('../models/KommoToken');
const LeadTracking = require('../models/LeadTracking');

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

// Rota para fornecer a configuração do Kommo para o frontend
router.get('/config', (req, res) => {
  res.json({
    clientId: KOMMO_CLIENT_ID,
    redirectUri: KOMMO_REDIRECT_URI,
    ngrokUrl: NGROK_URL
  });
});

// Rota para verificar o status da autenticação
router.get('/status', async (req, res) => {
  try {
    // Buscar token existente
    const token = await KommoToken.findOne();
    
    if (token) {
      // Verificar se o token está expirado
      const isExpired = new Date() > new Date(token.expires_at);
      
      // Enviar informações do token para o frontend
      res.json({
        isAuthenticated: !isExpired,
        tokenInfo: {
          account_id: token.account_id,
          domain: token.domain,
          expires_at: token.expires_at,
          created_at: token.createdAt,
          updated_at: token.updatedAt
        }
      });
    } else {
      res.json({ isAuthenticated: false });
    }
  } catch (error) {
    console.error('Error checking auth status:', error);
    res.status(500).json({ error: error.message });
  }
});

// Rota para revogar token
router.get('/revoke-token', async (req, res) => {
  try {
    const { account_id } = req.query;
    
    if (!account_id) {
      return res.status(400).json({ error: 'Account ID is required' });
    }
    
    // Encontrar e excluir o token
    await KommoToken.destroy({ where: { account_id } });
    
    res.json({ success: true, message: 'Token revoked successfully' });
  } catch (error) {
    console.error('Error revoking token:', error);
    res.status(500).json({ error: error.message });
  }
});

// Rota de callback do OAuth
router.get('/callback', async (req, res) => {
  try {
    const code = req.query.code;
    const referer = req.query.referer || req.headers.referer;

    console.log('codeeee', code);
    console.log('referer', referer);
    
    if (!code) {
      return res.status(400).json({ error: 'Authorization code is required' });
    }
    
    // Trocar o código por tokens
    const tokens = await exchangeCodeForTokens(code, referer);
    
    if (!tokens) {
      return res.status(400).send(`
        <html>
          <head>
            <title>Erro na Autenticação</title>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.2.3/dist/css/bootstrap.min.css" rel="stylesheet">
            <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.10.0/font/bootstrap-icons.css">
            <style>
              body {
                display: flex;
                justify-content: center;
                align-items: center;
                min-height: 100vh;
                background-color: #f8f9fa;
                font-family: Arial, sans-serif;
              }
              .error-card {
                max-width: 500px;
                padding: 2rem;
                border-radius: 10px;
                box-shadow: 0 4px 15px rgba(0,0,0,0.1);
                text-align: center;
                background-color: white;
              }
              .error-icon {
                font-size: 4rem;
                color: #dc3545;
                margin-bottom: 1rem;
              }
            </style>
          </head>
          <body>
            <div class="error-card">
              <i class="bi bi-exclamation-circle-fill error-icon"></i>
              <h2 class="mb-3">Erro na Autenticação</h2>
              <p class="mb-4">Não foi possível trocar o código por tokens de acesso.</p>
              <button class="btn btn-primary" onclick="window.close()">Fechar</button>
            </div>
            <script>
              // Fechar a janela após 3 segundos
              setTimeout(() => window.close(), 3000);
            </script>
          </body>
        </html>
      `);
    }

    // Salvar tokens no banco
    await KommoToken.create({
      account_id: tokens.account_id,
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expires_at: tokens.expires_at,
      domain: tokens.domain
    });

    // Buscar informações da conta Kommo usando o token
    let accountInfo = { account_id: 'default' };
    try {
      const accountResponse = await axios.get('https://api.kommo.com/api/v4/account', {
        headers: { 'Authorization': `Bearer ${tokens.access_token}` }
      });
      
      if (accountResponse.data && accountResponse.data.id) {
        accountInfo = {
          account_id: accountResponse.data.id.toString(),
          domain: referer || 'kommo.com'
        };
      }
    } catch (error) {
      console.error('Error fetching account info:', error);
    }

    // Retornar uma página HTML de sucesso
    return res.send(`
      <html>
        <head>
          <title>Integração Realizada com Sucesso!</title>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.2.3/dist/css/bootstrap.min.css" rel="stylesheet">
          <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.10.0/font/bootstrap-icons.css">
          <style>
            body {
              display: flex;
              justify-content: center;
              align-items: center;
              min-height: 100vh;
              background-color: #f8f9fa;
              font-family: Arial, sans-serif;
            }
            .success-card {
              max-width: 500px;
              padding: 2rem;
              border-radius: 10px;
              box-shadow: 0 4px 15px rgba(0,0,0,0.1);
              text-align: center;
              background-color: white;
            }
            .success-icon {
              font-size: 4rem;
              color: #198754;
              margin-bottom: 1rem;
              animation: success-pulse 2s infinite;
            }
            @keyframes success-pulse {
              0% { transform: scale(1); opacity: 1; }
              50% { transform: scale(1.1); opacity: 0.8; }
              100% { transform: scale(1); opacity: 1; }
            }
            .btn-primary {
              background-color: #0d6efd;
              border-color: #0d6efd;
              padding: 0.5rem 1.5rem;
              font-weight: 500;
              border-radius: 8px;
            }
            .debug-info {
              margin-top: 20px;
              text-align: left;
              font-size: 12px;
              color: #666;
              display: none;
            }
            .show-debug {
              cursor: pointer;
              color: #999;
              text-decoration: underline;
              font-size: 12px;
              margin-top: 10px;
            }
          </style>
        </head>
        <body>
          <div class="success-card">
            <i class="bi bi-check-circle-fill success-icon"></i>
            <h2 class="mb-3">Integração Realizada com Sucesso!</h2>
            <p class="mb-4">Sua conta Kommo foi conectada com sucesso.</p>
            <button class="btn btn-primary" onclick="handleClose()">Fechar e Voltar</button>
            
            <p class="show-debug mt-3" onclick="document.querySelector('.debug-info').style.display='block'">
              Mostrar informações de debug
            </p>
            
            <div class="debug-info">
              <p>window.opener: <span id="has-opener"></span></p>
              <p>window.parent: <span id="has-parent"></span></p>
              <p>Referer: ${referer || 'Não informado'}</p>
              <p>Account ID: ${accountInfo.account_id}</p>
            </div>
          </div>
          <script>
            // Informações de debug
            document.getElementById('has-opener').textContent = window.opener ? 'Sim' : 'Não';
            document.getElementById('has-parent').textContent = window.parent !== window ? 'Sim' : 'Não';
            
            // Função para fechar a janela e navegar de volta
            function handleClose() {
              console.log('Tentando fechar e redirecionar...');
              
              try {
                // Tentar recarregar a página pai
                if (window.opener) {
                  console.log('window.opener existe, tentando recarregar');
                  window.opener.location.reload();
                } 
                else if (window.parent && window.parent !== window) {
                  console.log('window.parent existe, tentando recarregar');
                  window.parent.location.reload();
                }
                else {
                  console.log('Navegando para a raiz');
                  window.location.href = '/';
                }
              } catch (e) {
                console.error('Erro ao redirecionar:', e);
              }
              
              // Tentar fechar a janela se for um popup
              try {
                window.close();
              } catch (e) {
                console.error('Erro ao fechar janela:', e);
              }
            }
            
            // Tentar recarregar a página pai automaticamente após 3 segundos
            setTimeout(handleClose, 3000);
          </script>
        </body>
      </html>
    `);
  } catch (error) {
    console.error('Error in callback:', error);
    res.status(500).send(`
      <html>
        <head>
          <title>Erro na Autenticação</title>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.2.3/dist/css/bootstrap.min.css" rel="stylesheet">
          <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.10.0/font/bootstrap-icons.css">
          <style>
            body {
              display: flex;
              justify-content: center;
              align-items: center;
              min-height: 100vh;
              background-color: #f8f9fa;
              font-family: Arial, sans-serif;
            }
            .error-card {
              max-width: 500px;
              padding: 2rem;
              border-radius: 10px;
              box-shadow: 0 4px 15px rgba(0,0,0,0.1);
              text-align: center;
              background-color: white;
            }
            .error-icon {
              font-size: 4rem;
              color: #dc3545;
              margin-bottom: 1rem;
            }
          </style>
        </head>
        <body>
          <div class="error-card">
            <i class="bi bi-exclamation-circle-fill error-icon"></i>
            <h2 class="mb-3">Erro na Autenticação</h2>
            <p class="mb-4">Ocorreu um erro durante o processo de autenticação.</p>
            <p class="small text-muted mb-4">${error.message}</p>
            <button class="btn btn-primary" onclick="window.close()">Fechar</button>
          </div>
          <script>
            // Fechar a janela após 3 segundos
            setTimeout(() => window.close(), 3000);
          </script>
        </body>
      </html>
    `);
  }
});

// Rota para obter URL de autenticação
router.get('/auth-url', (req, res) => {
  const authUrl = `https://kommo.com/oauth2/authorize?client_id=${KOMMO_CLIENT_ID}&redirect_uri=${KOMMO_REDIRECT_URI}&response_type=code`;
  res.json({ auth_url: authUrl });
});

// Rota para webhook do Kommo
router.post('/webhook', async (req, res) => {
  try {
    const data = req.body;
    console.log('Received Kommo webhook:', data);

    // Processar o webhook
    if (data.lead_id && data.phone) {
      await LeadTracking.create({
        lead_id: data.lead_id,
        phone: data.phone,
        event_type: data.event_type || 'update',
        source_id: data.source_id,
        previous_pipeline_id: data.previous_pipeline_id,
        previous_pipeline_name: data.previous_pipeline_name,
        previous_status_id: data.previous_status_id,
        previous_status_name: data.previous_status_name,
        current_pipeline_id: data.current_pipeline_id,
        current_pipeline_name: data.current_pipeline_name,
        current_status_id: data.current_status_id,
        current_status_name: data.current_status_name,
        lead_situation: data.lead_situation
      });
    }

    res.status(200).json({ success: true });
  } catch (error) {
    console.error('Error processing Kommo webhook:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router; 