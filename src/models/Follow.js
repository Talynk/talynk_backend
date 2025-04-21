'use strict';
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Follow = sequelize.define('Follow', {
  id: {
    type: DataTypes.UUID,
    primaryKey: true,
    defaultValue: DataTypes.UUIDV4
  },
  followerId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'users',
      key: 'id'
    }
  },
  followingId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'users',
      key: 'id'
    }
  },
  createdAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  },
  updatedAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  }
}, {
  tableName: 'follows',
  indexes: [
    {
      unique: true,
      fields: ['followerId', 'followingId']
    }
  ]
});

// Define associations in a separate function to be called after all models are loaded
Follow.associate = function(models) {
  Follow.belongsTo(models.User, {
    foreignKey: 'followerId',
    as: 'follower'
  });

  Follow.belongsTo(models.User, {
    foreignKey: 'followingId',
    as: 'following'
  });
};

module.exports = Follow; 