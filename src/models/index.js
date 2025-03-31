// 'use strict';

// const { Sequelize, DataTypes } = require('sequelize');
// const sequelize = require('../config/database');
// const fs = require('fs');
// const path = require('path');
// const basename = path.basename(__filename);

// const models = {};

// // First, load all models
// fs.readdirSync(__dirname)
//     .filter(file => {
//         return (
//             file.indexOf('.') !== 0 &&
//             file !== basename &&
//             file.slice(-3) === '.js'
//         );
//     })
//     .forEach(file => {
//         try {
//             const modelPath = path.join(__dirname, file);
//             const model = require(modelPath)(sequelize, DataTypes);
//             if (model.name) {
//                 models[model.name] = model;
//                 console.log(`✓ Loaded model: ${model.name}`);
//             }
//         } catch (error) {
//             console.error(`✗ Error loading model from ${file}:`, error.message);
//         }
//     });

// // Then, set up associations after all models are loaded
// Object.keys(models).forEach(modelName => {
//     if (typeof models[modelName].associate === 'function') {
//         try {
//             models[modelName].associate(models);
//             console.log(`✓ Set up associations for: ${modelName}`);
//         } catch (error) {
//             console.error(`✗ Error setting up associations for ${modelName}:`, error.message);
//         }
//     }
// });
// // Test database connection
// sequelize.authenticate()
//     .then(() => {
//         console.log('✓ PostgreSQL database connection established successfully.');
//     })
//     .catch(err => {
//         console.error('✗ Unable to connect to PostgreSQL database:', err.message);
//     });

// // Sync models with database (in development only)
// if (process.env.NODE_ENV === 'development') {
//     sequelize.sync({ alter: true })
//         .then(() => {
//             console.log('✓ Database synchronized');
//         })
//         .catch(err => {
//             console.error('✗ Error synchronizing database:', err.message);
//         });
// }

// // Export models and sequelize instance
// module.exports = {
//     sequelize,
//     Sequelize,
//     ...models
// };

