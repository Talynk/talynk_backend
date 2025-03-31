'use strict';
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const RecentSearch = sequelize.define('RecentSearch', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  user_id: {
    type: DataTypes.STRING(255),
    references: {
      model: 'users',
      key: 'username'
    }
  },
  search_term: {
    type: DataTypes.TEXT
  },
  search_date: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  }
}, {
  tableName: 'recent_searches',
  timestamps: false
});

// Define associations in a separate function to be called after all models are loaded
RecentSearch.associate = (models) => {
  RecentSearch.belongsTo(models.User, {
    foreignKey: 'userID',
    targetKey: 'username'
  });
};

module.exports = RecentSearch; 