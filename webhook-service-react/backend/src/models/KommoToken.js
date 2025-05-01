const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const KommoToken = sequelize.define('KommoToken', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  account_id: {
    type: DataTypes.STRING(50),
    unique: true
  },
  access_token: {
    type: DataTypes.TEXT
  },
  refresh_token: {
    type: DataTypes.TEXT
  },
  expires_at: {
    type: DataTypes.DATE
  },
  domain: {
    type: DataTypes.STRING(255),
    defaultValue: 'kommo.com'
  }
}, {
  tableName: 'kommo_tokens',
  timestamps: true
});

module.exports = KommoToken; 