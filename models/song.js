module.exports = (sequelize, DataTypes) => {
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
      allowNull: false,
    },
    youtubeUrl: {  
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
    tableName: 'Songs',
    timestamps: true
  });

  Song.associate = function(models) {
    Song.belongsTo(models.User, { as: 'submitter', foreignKey: 'submittedBy' });
    Song.belongsTo(models.Group, { as: 'group', foreignKey: 'groupId' });
    Song.belongsTo(models.Round, { foreignKey: 'roundId' });
    Song.hasMany(models.Vote, { foreignKey: 'songId', as: 'votes' }); 
  };

  return Song;
};
