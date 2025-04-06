module.exports = (sequelize, DataTypes) => {
  const Group = sequelize.define('Group', {
    name: {
      type: DataTypes.STRING,
      allowNull: false
    },
    description: DataTypes.TEXT,
    created_by: {
      type: DataTypes.INTEGER,
      allowNull: false
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
    tableName: 'Groups'
  });

  Group.associate = function(models) {
    Group.belongsTo(models.User, { foreignKey: 'created_by', as: 'creator' });
    Group.belongsToMany(models.User, { 
      through: models.GroupUser, 
      foreignKey: 'groupId',
      otherKey: 'userId',
      as: 'members'
    });
    
    if (models.Song) {
      Group.hasMany(models.Song, { foreignKey: 'groupId', as: 'songs' });
    }
    
    if (models.Round) {
      Group.hasMany(models.Round, { foreignKey: 'groupId', as: 'rounds' });
    }

    Group.hasMany(models.UserScore, { foreignKey: 'groupId' });
  };

  return Group;
};
