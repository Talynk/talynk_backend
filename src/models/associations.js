'use strict';

const models = require('./index');

// // Explicitly define the association between Post and Approver
// Post.belongsTo(Approver, { foreignKey: 'approver_id', as: 'approver' });
// Approver.hasMany(Post, { foreignKey: 'approver_id', as: 'approvedPosts' });

// Load associations from each model
Object.values(models).forEach(model => {
  if (model && typeof model.associate === 'function') {
    try {
      model.associate(models);
      console.log(`Associations for ${model.name || 'unnamed model'} set up successfully`);
    } catch (error) {
      console.error(`Error setting up associations for ${model.name || 'unnamed model'}:`, error);
    }
  }
});
