'use strict';

const bcrypt = require('bcrypt');
const sequelize = require('../config/database');
const { Group, GroupUser, Round, Song, Vote, UserScore } = require('../models');
const { pickRandomTheme } = require('../domain/themes');
const roundService = require('./roundService');

/**
 * Group lifecycle: create (with its first round), join, and delete (cascade).
 */

class GroupError extends Error {}

const MAX_GROUPS_PER_USER = 5;
const MAX_MEMBERS_PER_GROUP = 50;

/**
 * Create a group, add the creator as admin, and schedule its first round.
 * `form` mirrors the create-group form fields.
 */
async function createGroupWithFirstRound(userId, form) {
  const existing = await Group.count({ where: { created_by: userId } });
  if (existing >= MAX_GROUPS_PER_USER) {
    throw new GroupError(`You already have ${MAX_GROUPS_PER_USER} groups.`);
  }

  const theme =
    form.themeOption === 'random' ? pickRandomTheme() : form.theme || null;

  let passwordHash = null;
  if (form.groupPassword && form.groupPassword.trim() !== '') {
    passwordHash = await bcrypt.hash(form.groupPassword, 10);
  }

  const startDate = form.roundDate ? new Date(form.roundDate) : new Date();
  const votingDay = startDate
    .toLocaleString('en-US', { weekday: 'long' })
    .toLowerCase();

  return sequelize.transaction(async (transaction) => {
    const group = await Group.create(
      {
        name: form.name,
        description: form.description,
        created_by: userId,
        votingDay,
        inputOpenTime: form.inputOpenTime,
        votingOpenTime: form.votingOpenTime,
        votingCloseTime: form.votingCloseTime,
        votingRecurrence: form.votingRecurrence,
        theme,
        passwordHash,
        votingMethod: form.votingMethod || 'single_vote',
      },
      { transaction }
    );
    await GroupUser.create({ groupId: group.id, userId, role: 'admin' }, { transaction });
    // Create the first round in the same transaction so we never commit a group
    // with no round.
    await roundService.createFirstRound(group, startDate, new Date(), { transaction });
    return group;
  });
}

/**
 * Join a group (password-checked when private, membership-capped).
 * `group` is a Group instance.
 */
async function joinGroup(group, userId, enteredPassword) {
  const memberCount = await GroupUser.count({ where: { groupId: group.id } });
  if (memberCount >= MAX_MEMBERS_PER_GROUP) {
    throw new GroupError(`This group is at the ${MAX_MEMBERS_PER_GROUP} member limit.`);
  }

  const already = await GroupUser.findOne({
    where: { groupId: group.id, userId },
  });
  if (already) throw new GroupError('You are already a member of this group.');

  if (group.passwordHash) {
    if (!enteredPassword) throw new GroupError('Password is required for this group.');
    const ok = await bcrypt.compare(enteredPassword, group.passwordHash);
    if (!ok) throw new GroupError('Incorrect group password.');
  }

  return GroupUser.create({ groupId: group.id, userId });
}

/**
 * Delete a group and everything under it, in FK-safe order, in one transaction.
 * Replaces the hand-rolled raw-SQL cascade the delete route used to run.
 */
async function deleteGroupCascade(groupId) {
  return sequelize.transaction(async (transaction) => {
    const songIds = (
      await Song.findAll({ where: { groupId }, attributes: ['id'], transaction })
    ).map((s) => s.id);

    // Break the Round<->Song reference cycle before deleting either side.
    await Round.update(
      { winningSongId: null, winnerId: null },
      { where: { groupId }, transaction }
    );
    if (songIds.length > 0) {
      await Vote.destroy({ where: { songId: songIds }, transaction });
    }
    await Song.destroy({ where: { groupId }, transaction });
    await Round.destroy({ where: { groupId }, transaction });
    await UserScore.destroy({ where: { groupId }, transaction });
    await GroupUser.destroy({ where: { groupId }, transaction });
    await Group.destroy({ where: { id: groupId }, transaction });
  });
}

module.exports = {
  createGroupWithFirstRound,
  joinGroup,
  deleteGroupCascade,
  GroupError,
  MAX_GROUPS_PER_USER,
  MAX_MEMBERS_PER_GROUP,
};
