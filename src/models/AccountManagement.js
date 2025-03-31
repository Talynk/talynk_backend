'use strict';
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const AccountManagement = sequelize.define('AccountManagement', {
  accountID: {
    type: DataTypes.STRING(255),
    primaryKey: true,
    references: {
      model: 'users',
      key: 'username'
    }
  },
  account_status: {
    type: DataTypes.STRING(50),
    validate: {
      isIn: [['active', 'freezed', 'deleted']]
    }
  },
  freeze_date: {
    type: DataTypes.DATE
  },
  delete_date: {
    type: DataTypes.DATE
  }
}, {
  tableName: 'account_management',
  timestamps: false
});

// Define associations in a separate function to be called after all models are loaded
AccountManagement.associate = (models) => {
  AccountManagement.belongsTo(models.User, {
    foreignKey: 'accountID',
    targetKey: 'username'
  });
};

module.exports = AccountManagement; 