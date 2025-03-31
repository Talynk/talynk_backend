'use strict';

const sequelize = require('../config/database');

// // Explicitly define the association between Post and Approver
// Post.belongsTo(Approver, { foreignKey: 'approver_id', as: 'approver' });
// Approver.hasMany(Post, { foreignKey: 'approver_id', as: 'approvedPosts' });

Object.values(sequelize.models).forEach(model => {
  if (model.associate) {
    model.associate(sequelize.models);
  }
});
