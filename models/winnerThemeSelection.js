module.exports = (sequelize, DataTypes) => {
  const WinnerThemeSelection = sequelize.define('WinnerThemeSelection', {
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
    roundId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'Rounds',
        key: 'id'
      },
      unique: true
    },
    theme: {
      type: DataTypes.STRING,
      allowNull: false
    }
  }, {
    tableName: 'WinnerThemeSelections',
    timestamps: true
  });

  WinnerThemeSelection.associate = function(models) {
    WinnerThemeSelection.belongsTo(models.User, { foreignKey: 'userId' });
    WinnerThemeSelection.belongsTo(models.Round, { foreignKey: 'roundId' });
  };

  return WinnerThemeSelection;
};