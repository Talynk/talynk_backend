'use strict';
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Subscription = sequelize.define('Subscription', {
  subscriber_id: {
    type: DataTypes.UUID,
    primaryKey: true,
    references: {
      model: 'users',
      key: 'id'
    }
  },
  subscribed_to: {
    type: DataTypes.UUID,
    primaryKey: true,
    references: {
      model: 'users',
      key: 'id'
    }
  },
  subscription_date: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  }
}, {
  tableName: 'subscriptions',
  timestamps: false
});

// Define associations in a separate function to be called after all models are loaded
Subscription.associate = (models) => {
  Subscription.belongsTo(models.User, {
    foreignKey: 'subscriber_id',
    as: 'subscriber'
  });
  Subscription.belongsTo(models.User, {
    foreignKey: 'subscribed_to',
    as: 'subscribedTo'
  });
};

module.exports = Subscription; 