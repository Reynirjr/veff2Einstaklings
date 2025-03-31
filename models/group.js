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
};

module.exports = Group;
