const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Round = sequelize.define('Round', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  groupId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'Groups',
      key: 'id'
    }
  },
  roundNumber: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 1
  },
  theme: {
    type: DataTypes.STRING,
    allowNull: true
  },
  status: {
    type: DataTypes.ENUM('pending', 'active', 'voting', 'finished'),
    defaultValue: 'pending'
  },
  inputOpen: {
    type: DataTypes.DATE,
    allowNull: false
  },
  inputClose: {
    type: DataTypes.DATE,
    allowNull: false
  },
  votingOpen: {
    type: DataTypes.DATE,
    allowNull: false
  },
  votingClose: {
    type: DataTypes.DATE,
    allowNull: false
  }
}, {
  timestamps: true
});

Round.associate = (models) => {
  Round.belongsTo(models.Group, { foreignKey: 'groupId', as: 'group' });
  Round.hasMany(models.Song, { foreignKey: 'roundId', as: 'songs' });
};

module.exports = Round;
