'use strict';
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Share = sequelize.define('Share', {
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
    sharedAt: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
    }
}, {
    tableName: 'shares',
    timestamps: false
});

// Define associations in a separate function to be called after all models are loaded
Share.associate = (models) => {
    Share.belongsTo(models.User, {
        foreignKey: 'userId',
        as: 'user'
    });
    Share.belongsTo(models.Post, {
        foreignKey: 'postId',
        as: 'post'
    });
};

module.exports = Share; 