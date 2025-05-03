// Rota de callback do OAuth
router.get('/callback', async (req, res) => {
  try {
    // Logar todos os parâmetros recebidos
    console.log('Callback recebido com parâmetros:', req.query);
    
    // Verificar se temos o código de autorização
    const { code, referer, state } = req.query;
    if (!code) {
      console.error('Erro no callback: código de autorização não fornecido');
      // ... exisiting error response code ...
    }

    // Trocar o código por tokens
    console.log('Trocando código por tokens...');
    const tokens = await exchangeCodeForTokens(code, referer);
    if (!tokens) {
      console.error('Erro no callback: falha ao trocar código por tokens');
      // ... existing error response code ...
    }

    // Buscar informações da conta Kommo usando o token
    console.log('Obtendo informações da conta...');
    let accountInfo = { account_id: 'default' };
    try {
      const accountResponse = await axios.get('https://api.kommo.com/api/v4/account', {
        headers: { 'Authorization': `Bearer ${tokens.access_token}` }
      });
      
      console.log('Resposta da API de conta:', accountResponse.data);
      
      if (accountResponse.data && accountResponse.data.id) {
        accountInfo = {
          account_id: accountResponse.data.id.toString(),
          domain: referer || 'kommo.com'
        };
      }
    } catch (error) {
      console.error('Erro ao buscar informações da conta:', error.message);
    }

    // Salvar tokens no banco
    console.log('Salvando tokens no banco de dados...');
    await KommoToken.create({
      account_id: accountInfo.account_id,
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expires_at: tokens.expires_at,
      domain: accountInfo.domain
    });
    console.log('Tokens salvos com sucesso!');

    // Retornar uma página HTML de sucesso
    // ... existing success response code ...
  } catch (error) {
    console.error('Erro ao processar o callback:', error.message);
    // ... existing error response code ...
  }
}); 