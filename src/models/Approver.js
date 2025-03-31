'use strict';
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Approver = sequelize.define('Approver', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  username: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true
  },
  email: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
    validate: {
      isEmail: true
    }
  },
  password: {
    type: DataTypes.STRING,
    allowNull: false
  },
  role: {
    type: DataTypes.STRING,
    defaultValue: 'approver'
  },
  status: {
    type: DataTypes.ENUM('active', 'inactive'),
    defaultValue: 'active'
  },
  registeredBy: {
    type: DataTypes.STRING,
    references: {
      model: 'admins',
      key: 'username'
    }
  },
  can_view_approved: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  can_view_pending: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  can_view_all_accounts: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  lastLoginAt: {
    type: DataTypes.DATE
  }
}, {
  tableName: 'approvers',
  timestamps: true
});

// Define associations in a separate function to be called after all models are loaded
Approver.associate = (models) => {
  Approver.belongsTo(models.Admin, {
    foreignKey: 'registeredBy',
    as: 'registeredByAdmin'
  });
  Approver.hasMany(models.Post, {
    foreignKey: 'approver_id',
    as: 'approvedPosts'
  });
};

module.exports = Approver; 