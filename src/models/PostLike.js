'use strict';
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const PostLike = sequelize.define('PostLike', {
  user_id: {
    type: DataTypes.STRING(255),
    primaryKey: true,
    references: {
      model: 'users',
      key: 'username'
    }
  },
  post_id: {
    type: DataTypes.UUID,
    primaryKey: true,
    references: {
      model: 'posts',
      key: 'id'
    }
  },
  like_date: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  }
}, {
  tableName: 'post_likes',
  timestamps: false
});

// Define associations in a separate function to be called after all models are loaded
PostLike.associate = (models) => {
  PostLike.belongsTo(models.User, {
    foreignKey: 'user_id',
    targetKey: 'username'
  });
  PostLike.belongsTo(models.Post, {
    foreignKey: 'post_id',
    targetKey: 'id'
  });
};

module.exports = PostLike; 