'use strict';

const { Group, Round } = require('../models');
const { pickRandomTheme } = require('../domain/themes');

/**
 * The round winner chooses the theme for the next round. One implementation
 * (the old code had two divergent copies with different random-theme lists).
 */

class ThemeError extends Error {}

/**
 * @param {object} round a Round instance
 * @param {number} userId the caller
 * @param {{themeOption?: string, theme?: string}} choice
 * @returns {Promise<string>} the chosen theme
 */
async function setNextTheme(round, userId, choice) {
  if (round.winnerId !== userId) {
    throw new ThemeError('Only the round winner can set the next theme.');
  }
  if (round.nextThemeSelected) {
    throw new ThemeError('The theme has already been set.');
  }

  const theme =
    choice.themeOption === 'random' ? pickRandomTheme() : (choice.theme || '').trim();
  if (!theme) throw new ThemeError('Please provide a theme.');

  await Group.update({ theme }, { where: { id: round.groupId } });
  // The next round is usually created (with the old theme copied onto it)
  // before the winner gets to choose — propagate the choice onto it too.
  await Round.update(
    { theme },
    { where: { groupId: round.groupId, roundNumber: round.roundNumber + 1 } }
  );
  round.nextThemeSelected = true;
  await round.save();

  return theme;
}

module.exports = { setNextTheme, ThemeError };
