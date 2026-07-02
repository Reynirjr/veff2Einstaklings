'use strict';

/**
 * Full schema for Tónaleikarnir (production is migration-only; development uses
 * sequelize.sync). Mirrors the models in /models, including ON DELETE rules so
 * deleting a group cascades cleanly.
 *
 * @type {import('sequelize-cli').Migration}
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    const { INTEGER, STRING, TEXT, BOOLEAN, DATE, TIME, ENUM } = Sequelize;
    const timestamps = {
      createdAt: { type: DATE, allowNull: false },
      updatedAt: { type: DATE, allowNull: false },
    };

    await queryInterface.createTable('Users', {
      id: { type: INTEGER, primaryKey: true, autoIncrement: true },
      email: { type: STRING, allowNull: false, unique: true },
      password_hash: { type: STRING, allowNull: false },
      username: { type: STRING, allowNull: false, unique: true },
      profilePicture: { type: STRING },
      bio: { type: TEXT },
      profilePicturePosition: { type: TEXT },
      ...timestamps,
    });

    await queryInterface.createTable('Groups', {
      id: { type: INTEGER, primaryKey: true, autoIncrement: true },
      name: { type: STRING, allowNull: false },
      description: { type: TEXT },
      created_by: {
        type: INTEGER,
        allowNull: false,
        references: { model: 'Users', key: 'id' },
        onDelete: 'CASCADE',
      },
      votingDay: {
        type: ENUM('monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'),
        allowNull: false,
        defaultValue: 'friday',
      },
      inputOpenTime: { type: TIME, allowNull: false, defaultValue: '00:00:00' },
      inputCloseTime: { type: TIME, allowNull: false, defaultValue: '07:59:59' },
      votingOpenTime: { type: TIME, allowNull: false, defaultValue: '08:00:00' },
      votingCloseTime: { type: TIME, allowNull: false, defaultValue: '12:00:00' },
      votingRecurrence: {
        type: ENUM('none', 'daily', 'weekly', 'biweekly', 'monthly'),
        defaultValue: 'weekly',
      },
      theme: { type: STRING },
      passwordHash: { type: STRING },
      votingMethod: {
        type: ENUM('single_vote', 'top_3', 'rating'),
        allowNull: false,
        defaultValue: 'single_vote',
      },
      ...timestamps,
    });

    await queryInterface.createTable('GroupUsers', {
      groupId: {
        type: INTEGER,
        primaryKey: true,
        allowNull: false,
        references: { model: 'Groups', key: 'id' },
        onDelete: 'CASCADE',
      },
      userId: {
        type: INTEGER,
        primaryKey: true,
        allowNull: false,
        references: { model: 'Users', key: 'id' },
        onDelete: 'CASCADE',
      },
      role: { type: STRING, defaultValue: 'member' },
      joinedAt: { type: DATE, defaultValue: Sequelize.fn('NOW') },
      ...timestamps,
    });

    await queryInterface.createTable('Rounds', {
      id: { type: INTEGER, primaryKey: true, autoIncrement: true },
      groupId: {
        type: INTEGER,
        allowNull: false,
        references: { model: 'Groups', key: 'id' },
        onDelete: 'CASCADE',
      },
      roundNumber: { type: INTEGER, allowNull: false, defaultValue: 1 },
      theme: { type: STRING },
      status: {
        type: ENUM('pending', 'input', 'voting', 'finished'),
        allowNull: false,
        defaultValue: 'pending',
      },
      inputOpen: { type: DATE, allowNull: false },
      inputClose: { type: DATE, allowNull: false },
      votingOpen: { type: DATE, allowNull: false },
      votingClose: { type: DATE, allowNull: false },
      winnerId: {
        type: INTEGER,
        references: { model: 'Users', key: 'id' },
        onDelete: 'SET NULL',
      },
      // FK to Songs added after Songs exists (circular reference).
      winningSongId: { type: INTEGER },
      nextThemeSelected: { type: BOOLEAN, defaultValue: false },
      ...timestamps,
    });

    await queryInterface.createTable('Songs', {
      id: { type: INTEGER, primaryKey: true, autoIncrement: true },
      title: { type: STRING, allowNull: false },
      artist: { type: STRING, allowNull: false },
      youtubeUrl: { type: STRING },
      groupId: {
        type: INTEGER,
        allowNull: false,
        references: { model: 'Groups', key: 'id' },
        onDelete: 'CASCADE',
      },
      submittedBy: {
        type: INTEGER,
        allowNull: false,
        references: { model: 'Users', key: 'id' },
        onDelete: 'CASCADE',
      },
      roundId: {
        type: INTEGER,
        references: { model: 'Rounds', key: 'id' },
        onDelete: 'SET NULL',
      },
      ...timestamps,
    });

    await queryInterface.addConstraint('Rounds', {
      fields: ['winningSongId'],
      type: 'foreign key',
      name: 'Rounds_winningSongId_fkey',
      references: { table: 'Songs', field: 'id' },
      onDelete: 'SET NULL',
    });

    await queryInterface.createTable('Votes', {
      id: { type: INTEGER, primaryKey: true, autoIncrement: true },
      value: { type: INTEGER, allowNull: false },
      userId: {
        type: INTEGER,
        allowNull: false,
        references: { model: 'Users', key: 'id' },
        onDelete: 'CASCADE',
      },
      songId: {
        type: INTEGER,
        allowNull: false,
        references: { model: 'Songs', key: 'id' },
        onDelete: 'CASCADE',
      },
      ...timestamps,
    });
    await queryInterface.addConstraint('Votes', {
      fields: ['userId', 'songId'],
      type: 'unique',
      name: 'Votes_userId_songId_unique',
    });

    await queryInterface.createTable('UserScores', {
      userId: {
        type: INTEGER,
        primaryKey: true,
        allowNull: false,
        references: { model: 'Users', key: 'id' },
        onDelete: 'CASCADE',
      },
      groupId: {
        type: INTEGER,
        primaryKey: true,
        allowNull: false,
        references: { model: 'Groups', key: 'id' },
        onDelete: 'CASCADE',
      },
      score: { type: INTEGER, allowNull: false, defaultValue: 0 },
      roundsWon: { type: INTEGER, allowNull: false, defaultValue: 0 },
      ...timestamps,
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('UserScores');
    await queryInterface.dropTable('Votes');
    await queryInterface.removeConstraint('Rounds', 'Rounds_winningSongId_fkey').catch(() => {});
    await queryInterface.dropTable('Songs');
    await queryInterface.dropTable('Rounds');
    await queryInterface.dropTable('GroupUsers');
    await queryInterface.dropTable('Groups');
    await queryInterface.dropTable('Users');
  },
};
