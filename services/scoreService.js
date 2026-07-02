'use strict';

const sequelize = require('../config/database');

/**
 * Scoring — the one place that awards a win and reads the leaderboard.
 * (Replaces five divergent copies scattered across the old routes/controllers,
 * one of which reset the score instead of incrementing it.)
 */

/**
 * Atomically credit a user with one win in a group. Kept as raw SQL on purpose:
 * Postgres `INSERT … ON CONFLICT … DO UPDATE` is the cleanest race-free upsert.
 */
async function awardWin(userId, groupId, options = {}) {
  await sequelize.query(
    `
    INSERT INTO "UserScores" ("userId", "groupId", "score", "roundsWon", "createdAt", "updatedAt")
    VALUES (:userId, :groupId, 1, 1, NOW(), NOW())
    ON CONFLICT ("userId", "groupId")
    DO UPDATE SET
      "score" = "UserScores"."score" + 1,
      "roundsWon" = "UserScores"."roundsWon" + 1,
      "updatedAt" = NOW()
    `,
    { replacements: { userId, groupId }, transaction: options.transaction }
  );
}

/**
 * Members of a group ordered by rounds won (descending), with the profile bits
 * the group page needs.
 */
async function getLeaderboard(groupId) {
  return sequelize.query(
    `
    SELECT u.id AS "userId", u.username, u."profilePicture", u."profilePicturePosition",
           COALESCE(us."roundsWon", 0) AS "roundsWon"
    FROM "Users" u
    JOIN "GroupUsers" gu ON u.id = gu."userId"
    LEFT JOIN "UserScores" us ON u.id = us."userId" AND gu."groupId" = us."groupId"
    WHERE gu."groupId" = :groupId
    ORDER BY COALESCE(us."roundsWon", 0) DESC
    `,
    { replacements: { groupId }, type: sequelize.QueryTypes.SELECT }
  );
}

module.exports = { awardWin, getLeaderboard };
