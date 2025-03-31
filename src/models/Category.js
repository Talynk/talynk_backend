'use strict';
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Category = sequelize.define('Category', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true
  },
  description: {
    type: DataTypes.TEXT
  },
  status: {
    type: DataTypes.ENUM('active', 'inactive'),
    defaultValue: 'active'
  }
}, {
  tableName: 'categories',
  timestamps: false  // Disable timestamps since columns don't exist
});

// Define associations in a separate function to be called after all models are loaded
Category.associate = (models) => {
  Category.hasMany(models.Post, {
    foreignKey: 'categoryId',
    as: 'posts'
  });
};

module.exports = Category; 