'use strict';
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const View = sequelize.define('View', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    userId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'Users',
            key: 'id'
        }
    },
    postId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'Posts',
            key: 'id'
        }
    },
    viewedAt: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
    }
}, {
    tableName: 'views',
    timestamps: false
});

// Define associations in a separate function to be called after all models are loaded
View.associate = (models) => {
    View.belongsTo(models.User, {
        foreignKey: 'userId'
    });
    View.belongsTo(models.Post, {
        foreignKey: 'postId'
    });
};

module.exports = View; 