module.exports = (sequelize, DataTypes) => {
  const UserScore = sequelize.define('UserScore', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'Users',
        key: 'id'
      }
    },
    groupId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'Groups',
        key: 'id'
      }
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
    indexes: [
      {
        unique: true,
        fields: ['userId', 'groupId']
      }
    ]
  });
  
  UserScore.associate = function(models) {
    UserScore.belongsTo(models.User, { foreignKey: 'userId' });
    UserScore.belongsTo(models.Group, { foreignKey: 'groupId' });
  };
  
  return UserScore;
};