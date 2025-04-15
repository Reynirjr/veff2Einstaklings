module.exports = (sequelize, DataTypes) => {
  const UserScore = sequelize.define('UserScore', {
    userId: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      allowNull: false
    },
    groupId: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      allowNull: false
    },
    score: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0
    },
    roundsWon: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0
    }
  }, {
    tableName: 'UserScores',
    timestamps: true
  });

  UserScore.associate = function(models) {
    UserScore.belongsTo(models.User, { foreignKey: 'userId' });
    UserScore.belongsTo(models.Group, { foreignKey: 'groupId' });
  };

  return UserScore;
};