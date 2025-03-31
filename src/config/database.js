const { Sequelize } = require('sequelize');
require('dotenv').config();

const isTest = process.env.NODE_ENV === 'test';

// Use environment variables or default values
const DB_NAME = process.env.DB_NAME || 'talynk2';
const DB_USER = process.env.DB_USER || 'postgres';
const DB_PASS = process.env.DB_PASS || 'pll';
const DB_HOST = process.env.DB_HOST || 'localhost';

// Database configuration
const config = {
    development: {
        username: 'postgres',
        password: 'pll',
        database: 'talynk2',
        host: 'localhost',
        
        port: 5432,
        pool: {
            max: 5,
            min: 0,
            acquire: 30000,
            idle: 10000
        },
        logging: false
    },
    // test: {
    //     username: process.env.DB_USER,
    //     password: process.env.DB_PASS,
    //     database: process.env.DB_NAME,
    //     host: process.env.DB_HOST,
    //     dialect: "postgres",
    //     logging: false
    // },
    // production: {
    //     username: process.env.DB_USER,
    //     password: process.env.DB_PASS,
    //     database: process.env.DB_NAME,
    //     host: process.env.DB_HOST,
    //     dialect: "postgres",
    //     logging: false
    // }
};

// Get current environment
const env = process.env.NODE_ENV || 'development';
const dbConfig = config[env];

const DB = 'talynk2';
const USER = 'postgres';
const PASSWORD = 'pll';
const HOST = 'localhost';
const DIALECT = 'postgres';
const PORT = 5432;

// Create Sequelize instance
const sequelize = new Sequelize(
    DB,
    USER, 
    PASSWORD, 
    {
        host: HOST,
        dialect: DIALECT,
        port: PORT,
        logging: false,
        sync: true,
        // dialectOptions: {
        //     ssl: {
        //         require: false,
        //         rejectUnauthorized: false
        //     }
        // }
    }
);

// Test connection
sequelize.authenticate()
    .then(() => console.log('Database connection established successfully.'))
    .catch(err => console.error('Unable to connect to the database:', err))

module.exports = sequelize;

