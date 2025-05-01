const axios = require('axios');
const openaiService = require('../services/OpenaiService');
const whatsappService = require('../services/WhatsappService');
const dashboardService = require('../services/DashboardService');

/**
 * Controlador para geração e envio de relatórios
 */
const ReportController = {
  /**
   * Gera um resumo do dashboard e envia para um grupo do WhatsApp
   * @param {Object} req - Requisição Express
   * @param {Object} res - Resposta Express
   */
  generateAndSendDashboardReport: async (req, res) => {
    try {
      const { groupId } = req.body;
      
      // Validar ID do grupo
      if (!groupId) {
        return res.status(400).json({
          success: false,
          message: 'ID do grupo do WhatsApp é obrigatório'
        });
      }

      console.log(`🔄 Iniciando geração de relatório para o grupo ${groupId}...`);
      
      // Obter dados do dashboard (usando o serviço diretamente)
      console.log('📊 Obtendo métricas do dashboard...');
      const dashboardData = await dashboardService.getAdMetrics();
      
      // Verificar se temos dados
      if (!dashboardData || !dashboardData.campaigns || dashboardData.campaigns.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Não há dados suficientes no dashboard para gerar um relatório'
        });
      }
      
      console.log('✅ Dados do dashboard obtidos com sucesso!');
      
      // Gerar resumo via OpenAI
      const summary = await openaiService.generateDashboardSummary(dashboardData);
      
      // Formatar cabeçalho do relatório
      const date = new Date().toLocaleDateString('pt-BR', { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      });
      
      const reportHeader = `*📊 RELATÓRIO DE CAMPANHAS*\n*Data:* ${date}\n\n`;
      const fullReport = reportHeader + summary;
      
      // Enviar mensagem via WhatsApp
      console.log('📱 Enviando relatório para o WhatsApp...');
      const whatsappResult = await whatsappService.sendGroupMessage(groupId, fullReport);
      
      if (!whatsappResult.success) {
        return res.status(500).json({
          success: false,
          message: 'Erro ao enviar relatório para o WhatsApp',
          error: whatsappResult.error
        });
      }
      
      // Resposta de sucesso
      console.log('🎉 Relatório gerado e enviado com sucesso!');
      return res.status(200).json({
        success: true,
        message: 'Relatório gerado e enviado com sucesso',
        summary: fullReport,
        whatsappResponse: whatsappResult.data
      });
    } catch (error) {
      console.error('❌ Erro ao gerar e enviar relatório:', error);
      return res.status(500).json({
        success: false,
        message: 'Erro ao gerar e enviar relatório',
        error: error.message
      });
    }
  }
};

module.exports = ReportController; 