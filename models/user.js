module.exports = (sequelize, DataTypes) => {
  const User = sequelize.define('User', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    email: {
      type: DataTypes.STRING,
      unique: true,
      allowNull: false,
      validate: {
        isEmail: true
      }
    },
    password_hash: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    username: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true
    },
    profilePicture: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    bio: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    profilePicturePosition: {
      type: DataTypes.TEXT,
      allowNull: true
    }
  }, {
    tableName: 'Users',
    timestamps: true, 
  });

  User.associate = (models) => {
    User.hasMany(models.Group, { 
      foreignKey: 'created_by', 
      as: 'createdGroups' 
    });
    
    User.belongsToMany(models.Group, {
      through: models.GroupUser, 
      foreignKey: 'userId',
      otherKey: 'groupId',
      as: 'joinedGroups',
    });

    User.hasMany(models.UserScore, { foreignKey: 'userId' });
  };

  return User;
};
