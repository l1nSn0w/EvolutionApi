const { Sequelize } = require('sequelize');
require('dotenv').config();

const sequelize = new Sequelize(
  process.env.DB_NAME || 'evolution',
  process.env.DB_USER || 'user',
  process.env.DB_PASS || 'pass',
  {
    host: process.env.DB_HOST || 'postgres', // Nome do serviço no docker-compose
    port: process.env.DB_PORT || 5432,
    dialect: 'postgres',
    logging: false,
    timezone: '-03:00', // Timezone do Brasil
    define: {
      timestamps: true,
      underscored: true
    }
  }
);

module.exports = sequelize; 