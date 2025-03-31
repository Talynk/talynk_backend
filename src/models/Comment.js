'use strict';
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Comment = sequelize.define('Comment', {
  comment_id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  commentor_id: {
    type: DataTypes.STRING(255),
    allowNull: false,
    references: {
      model: 'users',
      key: 'username'
    }
  },
  comment_date: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  },
  post_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'posts',
      key: 'id'
    }
  },
  comment_text: {
    type: DataTypes.TEXT
  },
  comment_reports: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  }
}, {
  tableName: 'comments',
  timestamps: false
});

// Define associations in a separate function to be called after all models are loaded
Comment.associate = (models) => {
  Comment.belongsTo(models.User, {
    foreignKey: 'commentor_id',
    targetKey: 'username'
  });
  Comment.belongsTo(models.Post, {
    foreignKey: 'post_id',
    targetKey: 'id'
  });
};

module.exports = Comment; 