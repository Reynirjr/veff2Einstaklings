const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Song = sequelize.define('Song', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  group_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  submitted_by: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  youtube_url: {
    type: DataTypes.STRING,
    allowNull: false,
  },
}, {
  timestamps: true,
});

module.exports = Song;
