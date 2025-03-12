const { Sequelize } = require('sequelize');

const sequelize = new Sequelize('veff2db', 'benja', 'mypassword', {
  host: 'localhost',
  dialect: 'postgres',
  logging: false,
});

module.exports = sequelize;
