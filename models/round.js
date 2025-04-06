module.exports = (sequelize, DataTypes) => {
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
      type: DataTypes.ENUM('pending', 'input', 'voting', 'finished'), 
      allowNull: false,
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
    },
    winnerId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'Users',
        key: 'id'
      }
    },
    winningSongId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'Songs',
        key: 'id'
      }
    },
    nextThemeSelected: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    }
  }, {
    timestamps: true
  });

  Round.associate = (models) => {
    Round.belongsTo(models.Group, { foreignKey: 'groupId', as: 'group' });
    Round.hasMany(models.Song, { foreignKey: 'roundId', as: 'songs' });
    Round.belongsTo(models.User, { as: 'winner', foreignKey: 'winnerId' });
    Round.belongsTo(models.Song, { as: 'winningSong', foreignKey: 'winningSongId' });
  };

  return Round;
};
