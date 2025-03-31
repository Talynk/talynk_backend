'use strict';
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Notification = sequelize.define('Notification', {
  notificationID: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  userID: {
    type: DataTypes.STRING(255),
    allowNull: false,
    references: {
      model: 'users',
      key: 'username'
    }
  },
  notification_text: {
    type: DataTypes.TEXT
  },
  notification_date: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  },
  is_read: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  }
}, {
  tableName: 'notifications',
  timestamps: false
});

// Define associations in a separate function to be called after all models are loaded
Notification.associate = (models) => {
  Notification.belongsTo(models.User, {
    foreignKey: 'userID',
    targetKey: 'username'
  });
};

module.exports = Notification; 