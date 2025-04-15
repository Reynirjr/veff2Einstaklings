'use strict';

const fs = require('fs');
const path = require('path');
const Sequelize = require('sequelize');
const basename = path.basename(__filename);
const env = process.env.NODE_ENV || 'development';
const db = {};

let config;
try {
  config = require('../config/config.js')[env];
} catch (e) {
  console.warn('Config file not found or invalid, using environment variables directly');
  require('dotenv').config();
  config = {
    username: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    dialect: 'postgres'
  };
}

let sequelize;
if (process.env.DATABASE_URL && env === 'production') {
  sequelize = new Sequelize(process.env.DATABASE_URL, {
    dialect: 'postgres',
    dialectOptions: {
      ssl: {
        require: true,
        rejectUnauthorized: false 
      }
    },
    logging: false 
  });
} else if (config.use_env_variable) {
  sequelize = new Sequelize(process.env[config.use_env_variable], config);
} else {
  sequelize = new Sequelize(
    config.database, 
    config.username, 
    config.password, 
    config
  );
}

const modelFiles = fs.readdirSync(__dirname)
  .filter(file => {
    return (file.indexOf('.') !== 0 && file !== basename && file.slice(-3) === '.js');
  });

for (const file of modelFiles) {
  const modelPath = path.join(__dirname, file);
  const model = require(modelPath);
  
  if (model.init) {
    model.init(sequelize, Sequelize.DataTypes);
    db[model.name] = model;
  }
  else if (typeof model === 'function') {
    try {
      const modelInstance = model(sequelize, Sequelize.DataTypes);
      if (modelInstance) {
        db[modelInstance.name] = modelInstance;
      }
    } catch (error) {
      console.error(`Error initializing model from file ${file}:`, error);
    }
  }
}

// Check in your models/index.js that associations are properly defined
// Example:
User.belongsToMany(Group, { through: 'GroupUser', foreignKey: 'userId' });
Group.belongsToMany(User, { through: 'GroupUser', foreignKey: 'groupId' });

Object.keys(db).forEach(modelName => {
  if (db[modelName].associate) {
    db[modelName].associate(db);
  }
});

db.sequelize = sequelize;
db.Sequelize = Sequelize;

module.exports = db;
