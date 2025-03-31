'use strict';
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Ad = sequelize.define('Ad', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  title: {
    type: DataTypes.STRING,
    allowNull: false
  },
  content: {
    type: DataTypes.TEXT
  },
  status: {
    type: DataTypes.STRING(255),
    defaultValue: 'active'
  },
  userId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'users',
      key: 'id'
    }
  },
  startDate: {
    type: DataTypes.DATE
  },
  endDate: {
    type: DataTypes.DATE
  }
}, {
  tableName: 'ads',
  timestamps: true
});

// Define associations in a separate function to be called after all models are loaded
Ad.associate = (models) => {
  Ad.belongsTo(models.User, {
    foreignKey: {
      name: 'userId',
      allowNull: false,
      onDelete: 'CASCADE'
    },
    as: 'user'
  });
};

module.exports = Ad; 