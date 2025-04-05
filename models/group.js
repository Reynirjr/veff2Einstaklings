const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const User = require('./user'); 

const Group = sequelize.define('Group', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  description: {
    type: DataTypes.TEXT,
  },
  created_by: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'Users', 
      key: 'id'
    }
  },
  votingDay: {
    type: DataTypes.ENUM('monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'),
    allowNull: false,
    defaultValue: 'friday'
  },
  inputOpenTime: {
    type: DataTypes.TIME, 
    allowNull: false,
    defaultValue: '00:00:00'
  },
  inputCloseTime: {
    type: DataTypes.TIME,
    allowNull: false,
    defaultValue: '07:59:59'
  },
  votingOpenTime: {
    type: DataTypes.TIME, 
    allowNull: false,
    defaultValue: '08:00:00'
  },
  votingCloseTime: {
    type: DataTypes.TIME, 
    allowNull: false,
    defaultValue: '12:00:00'
  },
  votingRecurrence: {
    type: DataTypes.ENUM('none', 'weekly', 'biweekly', 'monthly'), 
    defaultValue: 'none',
  },
  theme: {
    type: DataTypes.STRING,
    allowNull: true, 
  },
  passwordHash: {
    type: DataTypes.STRING,
    allowNull: true,  
  },
  votingMethod: {
    type: DataTypes.ENUM('single_vote', 'top_3', 'rating'),
    allowNull: false,
    defaultValue: 'single_vote',
  },
  tiebreakInProgress: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  tiebreakSongs: {
    type: DataTypes.JSON,
    allowNull: true
  },
  tiebreakEndTime: {
    type: DataTypes.DATE,
    allowNull: true
  }
}, {
  timestamps: true,
});

Group.associate = (models) => {
  Group.belongsTo(models.User, { 
    foreignKey: 'created_by',
    as: 'creator' 
  });
  
  Group.belongsToMany(models.User, {
    through: 'GroupUser',
    foreignKey: 'groupId',
    otherKey: 'userId',
    as: 'members',
  });
  
  Group.hasMany(models.Song, {
    foreignKey: 'groupId',
    as: 'songs'
  });

  Group.hasMany(models.Round, {
    foreignKey: 'groupId',
    as: 'rounds'
  });
};

module.exports = Group;
