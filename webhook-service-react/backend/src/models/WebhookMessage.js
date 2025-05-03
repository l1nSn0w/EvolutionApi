const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const WebhookMessage = sequelize.define('WebhookMessage', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  telefone: {
    type: DataTypes.STRING(50),
    allowNull: false
  },
  nome: {
    type: DataTypes.STRING(100),
    allowNull: false
  },
  dispositivo: {
    type: DataTypes.STRING(20),
    allowNull: false
  },
  mensagem: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  source_id: {
    type: DataTypes.STRING(50),
    allowNull: true
  },
  title: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  url: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  encaminhado_make: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  date_time: {
    type: DataTypes.STRING(30),
    allowNull: true
  },
  ad_name: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  adset_name: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  adset_id: {
    type: DataTypes.STRING(50),
    allowNull: true
  },
  campaign_name: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  campaign_id: {
    type: DataTypes.STRING(50),
    allowNull: true
  },
  ctwa_clid: {
    type: DataTypes.STRING(255),
    allowNull: true,
    comment: 'Click ID gerado pelo Meta para anúncios Click-To-WhatsApp'
  }
}, {
  tableName: 'webhook_messages',
  timestamps: false
});

module.exports = WebhookMessage; 