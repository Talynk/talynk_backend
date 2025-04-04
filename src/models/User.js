'use strict';
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const User = sequelize.define('User', {
  id: {
    type: DataTypes.UUID,
    primaryKey: true,
    defaultValue: DataTypes.UUIDV4
  },
  username: {
    type: DataTypes.STRING(255),
    allowNull: false,
    unique: true
  },
  email: {
    type: DataTypes.STRING(255),
    allowNull: false,
    unique: true,
    validate: {
      isEmail: true
    }
  },
  phone1: {
    type: DataTypes.STRING(15)
  },
  phone2: {
    type: DataTypes.STRING(15)
  },
  posts_count: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  total_profile_views: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  user_facial_image: {
    type: DataTypes.BLOB
  },
  selected_category: {
    type: DataTypes.STRING(255)
  },
  password: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  notification: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  recent_searches: {
    type: DataTypes.JSON,
  },
  likes: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  subscribers: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  remember_me: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  status: {
    type: DataTypes.STRING(255),
    defaultValue: 'active'
  },
  role: {
    type: DataTypes.STRING(255),
    defaultValue: 'user'
  },
  profile_picture: {
    type: DataTypes.STRING(255)
  },
  bio: {
    type: DataTypes.TEXT
  },
  last_login: {
    type: DataTypes.DATE
  },
  createdAt: {
    type: DataTypes.DATE
  },
  updatedAt : {
    type: DataTypes.DATE
  }

}, {
  tableName: 'users',
  timestamps: false,
  // underscored: true
});

// Define associations in a separate function to be called after all models are loaded
User.associate = (models) => {
  User.hasMany(models.Post, {
    foreignKey: 'user_id',
    as: 'posts'
  });

  
  User.hasMany(models.Comment, {
    foreignKey: 'userID',
    sourceKey: 'username'
  });
  
  User.hasMany(models.PostLike, {
    foreignKey: 'user_id',
    sourceKey: 'username'
  });
  
  User.hasMany(models.Notification, {
    foreignKey: 'userID',
    sourceKey: 'username'
  });
  
  User.hasMany(models.RecentSearch, {
    foreignKey: 'userID',
    sourceKey: 'username'
  });
};

// sequelize.sync()
//   .then(() => console.log('User model synced with database'))
//   .catch((err) => console.log('Error syncing the model:', err));

module.exports = User;
