const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Song = sequelize.define('Song', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  title: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  artist: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  groupId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'Groups',
      key: 'id'
    }
  },
  submittedBy: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'Users',
      key: 'id'
    }
  },
  roundId: {
    type: DataTypes.INTEGER,
    allowNull: true, 
    references: {
      model: 'Rounds',
      key: 'id'
    }
  }
}, {
  timestamps: true
});

Song.associate = (models) => {
  Song.belongsTo(models.Group, { foreignKey: 'groupId', as: 'group' });
  Song.belongsTo(models.User, { foreignKey: 'submittedBy', as: 'submitter' });
  Song.belongsTo(models.Round, { foreignKey: 'roundId', as: 'round' });
  Song.hasMany(models.Vote, { foreignKey: 'songId', as: 'votes' });
};

module.exports = Song;
