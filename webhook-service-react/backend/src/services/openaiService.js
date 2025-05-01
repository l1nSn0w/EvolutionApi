const axios = require('axios');
const { OPENAI_API_KEY, OPENAI_MODEL } = require('../config/openai');

/**
 * Serviço para interagir com a API da OpenAI
 */
const openaiService = {
  /**
   * Gera um resumo formatado dos dados do dashboard usando o ChatGPT
   * @param {Object} dashboardData - Dados do dashboard
   * @returns {Promise<string>} Resumo formatado
   */
  generateDashboardSummary: async (dashboardData) => {
    try {
      console.log('🤖 Gerando resumo do dashboard via ChatGPT...');
      
      // Criar um prompt detalhado para o ChatGPT
      const prompt = `
Você é um especialista em marketing digital e análise de dados. Preciso que você crie um resumo do desempenho das nossas campanhas de anúncios com base nos dados abaixo.

O resumo deve ser bem formatado para envio no WhatsApp, com emojis adequados, organizado em seções claras, e destacando as métricas mais importantes.

Use negrito para títulos e métricas principais. Mantenha o resumo informativo mas conciso (máximo de 15 linhas).

Aqui estão os dados do nosso dashboard:
${JSON.stringify(dashboardData, null, 2)}

Por favor, inclua:
- Número total de leads e taxa de conversão
- Desempenho das campanhas mais relevantes
- Desempenho dos conjuntos de anúncios
- Top anúncios por taxa de conversão
- Desempenho dos atendentes
- Qualquer insight importante que você observe nos dados

Formate o texto para ficar agradável de ler no WhatsApp.
`;

      // Chamada para a API da OpenAI
      const response = await axios.post(
        'https://api.openai.com/v1/chat/completions',
        {
          model: OPENAI_MODEL,
          messages: [
            { role: "system", content: "Você é um assistente especializado em análise de dados de marketing e publicidade." },
            { role: "user", content: prompt }
          ],
          temperature: 0.7,
          max_tokens: 1000
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${OPENAI_API_KEY}`
          }
        }
      );

      // Extrair o resumo da resposta
      const summary = response.data.choices[0].message.content;
      console.log('✅ Resumo gerado com sucesso!');
      
      return summary;
    } catch (error) {
      console.error('❌ Erro ao gerar resumo do dashboard:', error.message);
      
      // Se temos uma resposta da API com erro
      if (error.response) {
        console.error('📄 Detalhes do erro:', error.response.data);
        throw new Error(`Erro na API da OpenAI: ${error.response.data.error?.message || 'Erro desconhecido'}`);
      }

      // Erro de conexão ou outro tipo
      throw new Error(`Erro ao interagir com a API da OpenAI: ${error.message}`);
    }
  }
};

module.exports = openaiService; 