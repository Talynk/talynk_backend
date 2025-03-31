'use strict';
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Admin = sequelize.define('Admin', {
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
    defaultValue: 'admin'
  },
  status: {
    type: DataTypes.ENUM('active', 'inactive'),
    defaultValue: 'active'
  },
  permissions: {
    type: DataTypes.JSON,
    defaultValue: []
  },
  can_view_approved: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  can_view_pending: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  can_view_rejected: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  ads_management: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  can_view_all_approvers: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  can_register_approvers: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  can_manage_all_accounts: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  lastLoginAt: {
    type: DataTypes.DATE
  }
}, {
  tableName: 'admins',
  timestamps: true
});

// Define associations in a separate function to be called after all models are loaded
Admin.associate = (models) => {
  // Check if models exist before creating associations
  if (models.Post) {
    Admin.hasMany(models.Post, {
      foreignKey: 'adminId',
      as: 'posts'
    });
  }

  if (models.Approver) {
    Admin.hasMany(models.Approver, {
      foreignKey: 'registeredBy',
      as: 'approvers'
    });
  }
};

module.exports = Admin; 
