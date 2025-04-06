module.exports = (sequelize, DataTypes) => {
  const GroupUser = sequelize.define('GroupUser', {
    groupId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      primaryKey: true, 
      references: {
        model: 'Groups',
        key: 'id'
      }
    },
    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      primaryKey: true,
      references: {
        model: 'Users',
        key: 'id'
      }
    },
    role: {
      type: DataTypes.STRING,
      defaultValue: 'member',
      validate: {
        isIn: [['member', 'admin']]
      }
    },
    joinedAt: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW
    }
  }, {
    timestamps: true,
    tableName: 'GroupUsers',
    indexes: [
      {
        unique: true,
        fields: ['groupId', 'userId']
      }
    ]
  });

  return GroupUser;
};
