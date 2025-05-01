const { DataTypes } = require('sequelize');

module.exports = {
  up: async (queryInterface, Sequelize) => {
    try {
      await queryInterface.addColumn('lead_tracking', 'price', {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true
      });
      console.log('✅ Coluna price adicionada com sucesso à tabela lead_tracking');
    } catch (error) {
      console.error('❌ Erro ao adicionar coluna price:', error);
      throw error;
    }
  },

  down: async (queryInterface, Sequelize) => {
    try {
      await queryInterface.removeColumn('lead_tracking', 'price');
      console.log('✅ Coluna price removida com sucesso da tabela lead_tracking');
    } catch (error) {
      console.error('❌ Erro ao remover coluna price:', error);
      throw error;
    }
  }
}; 