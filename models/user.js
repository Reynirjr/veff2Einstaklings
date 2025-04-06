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
    },
    password_hash: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    username: {
      type: DataTypes.STRING,
      allowNull: false,
    },
  }, {
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
  };

  return User;
};
