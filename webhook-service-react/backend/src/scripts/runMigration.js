const { Sequelize } = require('sequelize');
const config = require('../config/database');

async function runMigration() {
  const sequelize = new Sequelize(config.database, config.username, config.password, {
    host: config.host,
    dialect: config.dialect
  });

  try {
    // Importar a migração
    const migration = require('../migrations/20240320_add_price_to_lead_tracking');

    // Executar a migração
    console.log('🔄 Executando migração para adicionar coluna price...');
    await migration.up(sequelize.getQueryInterface(), Sequelize);
    console.log('✅ Migração concluída com sucesso!');

  } catch (error) {
    console.error('❌ Erro ao executar migração:', error);
  } finally {
    await sequelize.close();
  }
}

// Executar a migração
runMigration(); 