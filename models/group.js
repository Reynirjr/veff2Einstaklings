module.exports = (sequelize, DataTypes) => {
  const Group = sequelize.define(
    'Group',
    {
      name: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      description: DataTypes.TEXT,
      created_by: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      votingDay: {
        type: DataTypes.ENUM(
          'monday',
          'tuesday',
          'wednesday',
          'thursday',
          'friday',
          'saturday',
          'sunday'
        ),
        allowNull: false,
        defaultValue: 'friday',
      },
      inputOpenTime: {
        type: DataTypes.TIME,
        allowNull: false,
        defaultValue: '00:00:00',
      },
      inputCloseTime: {
        type: DataTypes.TIME,
        allowNull: false,
        defaultValue: '07:59:59',
      },
      votingOpenTime: {
        type: DataTypes.TIME,
        allowNull: false,
        defaultValue: '08:00:00',
      },
      votingCloseTime: {
        type: DataTypes.TIME,
        allowNull: false,
        defaultValue: '12:00:00',
      },
      votingRecurrence: {
        type: DataTypes.ENUM('none', 'daily', 'weekly', 'biweekly', 'monthly'),
        defaultValue: 'weekly',
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
    },
    {
      tableName: 'Groups',
    }
  );

  Group.associate = function (models) {
    Group.belongsTo(models.User, { foreignKey: 'created_by', as: 'creator' });
    Group.belongsToMany(models.User, {
      through: models.GroupUser,
      foreignKey: 'groupId',
      otherKey: 'userId',
      as: 'members',
    });
    Group.hasMany(models.Song, { foreignKey: 'groupId', as: 'songs', onDelete: 'CASCADE' });
    Group.hasMany(models.Round, { foreignKey: 'groupId', as: 'rounds', onDelete: 'CASCADE' });
    Group.hasMany(models.UserScore, { foreignKey: 'groupId', onDelete: 'CASCADE' });
    Group.hasMany(models.GroupUser, { foreignKey: 'groupId', onDelete: 'CASCADE' });
  };

  return Group;
};
