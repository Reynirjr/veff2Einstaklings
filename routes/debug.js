const express = require('express');
const router = express.Router();
const { sequelize, User, Group, Round, Song, Vote, UserScore } = require('../models');
const authMiddleware = require('../middleware/authmiddleware');
const { Op } = require('sequelize');

router.get('/debug/fix-stuck-rounds', authMiddleware, async (req, res) => {
  try {
    const stuckRounds = await Round.findAll({
      where: {
        status: 'voting',
        votingClose: { [Op.lt]: new Date() }
      },
      include: [{ model: Group }]
    });
    
    const results = [];
    
    for (const round of stuckRounds) {
      try {
        const winningSong = await Song.findOne({
          where: { roundId: round.id },
          include: [
            { model: User, as: 'submitter' },
            { model: Vote, as: 'votes' }
          ],
          attributes: [
            'id', 'title', 'artist', 'submittedBy',
            [sequelize.fn('COUNT', sequelize.col('votes.id')), 'voteCount']
          ],
          group: ['Song.id', 'Song.title', 'Song.artist', 'Song.submittedBy', 'submitter.id'],
          order: [[sequelize.fn('COUNT', sequelize.col('votes.id')), 'DESC']]
        });
        
        if (winningSong) {
          round.status = 'finished';
          round.winnerId = winningSong.submittedBy;
          round.winningSongId = winningSong.id;
          await round.save();
          
          await sequelize.query(`
            INSERT INTO "UserScores" ("userId", "groupId", "score", "roundsWon", "createdAt", "updatedAt")
            VALUES (:userId, :groupId, 1, 1, NOW(), NOW())
            ON CONFLICT ("userId", "groupId") 
            DO UPDATE SET 
              "score" = "UserScores"."score" + 1,
              "roundsWon" = "UserScores"."roundsWon" + 1,
              "updatedAt" = NOW()
          `, {
            replacements: { 
              userId: winningSong.submittedBy, 
              groupId: round.groupId 
            },
            type: sequelize.QueryTypes.RAW
          });
          
          results.push({
            roundId: round.id,
            groupName: round.Group.name,
            winningSongTitle: winningSong.title,
            winnerUsername: winningSong.submitter.username,
            status: 'fixed'
          });
        } else {
          results.push({
            roundId: round.id,
            status: 'no_winner_found'
          });
        }
      } catch (error) {
        results.push({
          roundId: round.id,
          status: 'error',
          error: error.message
        });
      }
    }
    
    res.json({
      roundsFixed: results.length,
      details: results
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;