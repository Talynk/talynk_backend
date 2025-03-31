'use strict';
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Post = sequelize.define('Post', {
  id: {
    type: DataTypes.UUID,
    primaryKey: true,
    defaultValue: DataTypes.UUIDV4
  },
  title: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  video_url: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  status: {
    type: DataTypes.ENUM('pending', 'approved', 'rejected'),
    defaultValue: 'pending'
  },
  user_id: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: 'users',
      key: 'id'
    }
  },
  approver_id: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: 'approvers',
      key: 'id'
    }
  },
  admin_id: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: 'admins',
      key: 'id'
    }
  },
  approved_at: {
    type: DataTypes.DATE,
    allowNull: true
  },
  unique_traceability_id: {
    type: DataTypes.STRING(255),
    unique: true,
    allowNull: true
  },
  views: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  likes: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  shares: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  category_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'categories',
      key: 'id'
    }
  }
}, {
  tableName: 'posts',
  timestamps: true,
  underscored: true
});

// Define associations in a separate function to be called after all models are loaded
Post.associate = (models) => {
  Post.belongsTo(models.User, {
    foreignKey: 'user_id',
    as: 'user'
  });
  Post.belongsTo(models.Approver, {
    foreignKey: 'approver_id',
    as: 'approver'
  });
  Post.belongsTo(models.Admin, {
    foreignKey: 'admin_id',
    as: 'admin'
  });
  Post.belongsTo(models.Category, {
    foreignKey: 'category_id',
    as: 'category'
  });
  Post.hasMany(models.Comment, {
    foreignKey: 'post_id'
  });
  Post.hasMany(models.PostLike, {
    foreignKey: 'post_id'
  });
};

module.exports = Post; 