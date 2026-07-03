'use strict';

/**
 * One browser's Web Push subscription for one user. A user can have several
 * (phone + work computer). The endpoint is globally unique per browser
 * registration; stale endpoints are pruned when a send returns 404/410.
 */
module.exports = (sequelize, DataTypes) => {
  const PushSubscription = sequelize.define(
    'PushSubscription',
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      userId: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      endpoint: {
        type: DataTypes.TEXT,
        allowNull: false,
        unique: true,
      },
      p256dh: {
        type: DataTypes.STRING(255),
        allowNull: false,
      },
      auth: {
        type: DataTypes.STRING(255),
        allowNull: false,
      },
    },
    {
      tableName: 'PushSubscriptions',
    }
  );

  PushSubscription.associate = (models) => {
    PushSubscription.belongsTo(models.User, {
      foreignKey: 'userId',
      as: 'user',
      onDelete: 'CASCADE',
    });
  };

  return PushSubscription;
};
