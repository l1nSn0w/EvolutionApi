const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const WebhookMessage = require('./WebhookMessage');

const LeadTracking = sequelize.define('LeadTracking', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  message_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: WebhookMessage,
      key: 'id'
    }
  },
  lead_id: {
    type: DataTypes.STRING(50),
    allowNull: false
  },
  phone: {
    type: DataTypes.STRING(50)
  },
  event_type: {
    type: DataTypes.STRING(50),
    allowNull: false
  },
  source_id: {
    type: DataTypes.STRING(50),
    allowNull: true
  },
  previous_pipeline_id: {
    type: DataTypes.STRING(50),
    allowNull: true
  },
  previous_pipeline_name: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  previous_status_id: {
    type: DataTypes.STRING(50),
    allowNull: true
  },
  previous_status_name: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  current_pipeline_id: {
    type: DataTypes.STRING(50),
    allowNull: true
  },
  current_pipeline_name: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  current_status_id: {
    type: DataTypes.STRING(50),
    allowNull: true
  },
  current_status_name: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  lead_situation: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  price: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true
  },
  responsible_user_id: {
    type: DataTypes.STRING(50),
    allowNull: true
  },
  responsible_user_name: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  event_time: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  },
  is_manually_created: {
    type: DataTypes.BOOLEAN,
    allowNull: true
  }
}, {
  tableName: 'lead_tracking',
  timestamps: false
});

// Definir relacionamento
LeadTracking.belongsTo(WebhookMessage, { foreignKey: 'message_id' });
WebhookMessage.hasMany(LeadTracking, { foreignKey: 'message_id' });

module.exports = LeadTracking; 