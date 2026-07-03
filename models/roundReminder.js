'use strict';

/**
 * Marks that the day-of reminder email went out for a round. The unique
 * roundId makes the daily email job idempotent across restarts/redeploys.
 */
module.exports = (sequelize, DataTypes) => {
  const RoundReminder = sequelize.define(
    'RoundReminder',
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      roundId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        unique: true,
      },
    },
    {
      tableName: 'RoundReminders',
    }
  );

  RoundReminder.associate = (models) => {
    RoundReminder.belongsTo(models.Round, {
      foreignKey: 'roundId',
      as: 'round',
      onDelete: 'CASCADE',
    });
  };

  return RoundReminder;
};
