'use strict';
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Notification = sequelize.define('Notification', {
  notification_id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  user_id: {
    type: DataTypes.UUID,
    allowNull: false,
    field:'user_id',
    references: {
      model: 'users',
      key: 'id'
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
  // underscored: true,
  tableName: 'notifications',
  timestamps: false
});

// Define associations in a separate function to be called after all models are loaded
Notification.associate = (models) => {
  Notification.belongsTo(models.User, {
    foreignKey: 'user_id',
    targetKey: 'id'
  });
};

module.exports = Notification; 

