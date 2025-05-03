const express = require('express');
const router = express.Router();
const { 
  KOMMO_CLIENT_ID, 
  KOMMO_CLIENT_SECRET, 
  KOMMO_REDIRECT_URI,
  NGROK_URL
} = require('../config/kommo');
const KommoToken = require('../models/KommoToken');
const KommoService = require('../services/KommoService');
const KommoController = require('../controllers/KommoController');

// Rotas de autenticação e configuração
router.get('/config', (req, res) => {
  res.json({
    clientId: KOMMO_CLIENT_ID,
    redirectUri: KOMMO_REDIRECT_URI,
    ngrokUrl: NGROK_URL
  });
});

router.get('/status', async (req, res) => {
  try {
    const status = await KommoService.checkAuthStatus();
    res.json(status);
  } catch (error) {
    console.error('Error checking auth status:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/revoke-token', async (req, res) => {
  try {
    const { account_id } = req.query;
    const result = await KommoService.revokeToken(account_id);
    res.json(result);
  } catch (error) {
    console.error('Error revoking token:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/callback', async (req, res) => {
  try {
    const code = req.query.code;
    const referer = req.query.referer || req.headers.referer;

    if (!code) {
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
              <p class="mb-4">Código de autorização não fornecido.</p>
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

    // Trocar código por tokens
    const tokens = await KommoService.exchangeCodeForTokens(code, referer);
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

    // Buscar informações da conta
    const accountInfo = await KommoService.getAccountInfo(tokens.access_token, referer);

    // Salvar tokens no banco de dados
    await KommoToken.create({
      account_id: accountInfo.account_id,
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expires_at: tokens.expires_at,
      domain: accountInfo.domain
    });

    res.send(`
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
              color: #28a745;
              margin-bottom: 1rem;
            }
          </style>
        </head>
        <body>
          <div class="success-card">
            <i class="bi bi-check-circle-fill success-icon"></i>
            <h2 class="mb-3">Integração Realizada com Sucesso!</h2>
            <p class="mb-4">A integração com o Kommo foi configurada com sucesso.</p>
            <button class="btn btn-primary" onclick="window.close()">Fechar</button>
          </div>
          <script>
            // Fechar a janela após 3 segundos
            setTimeout(() => window.close(), 3000);
          </script>
        </body>
      </html>
    `);
  } catch (error) {
    console.error('Error in OAuth callback:', error);
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
            <p class="mb-4">${error.message}</p>
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

// Rotas da API do Kommo
router.get('/pipelines', KommoController.getPipelines);
router.get('/pipelines/:pipelineId/stages', KommoController.getPipelineStages);
router.get('/pipelines/:pipelineId/leads', KommoController.getPipelineLeads);
router.get('/pipelines/:pipelineId/stages/:stageId/leads', KommoController.getStageLeads);
router.get('/pipelines/:pipelineId/tracking-leads', KommoController.getPipelineLeadsFromTracking);

router.post('/webhook', KommoController.handleKommoWebhook);

module.exports = router; 