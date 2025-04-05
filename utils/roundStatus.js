const { Round, Song, Vote, Group } = require('../models');
const { Op, sequelize } = require('sequelize');

async function updateRoundsStatus() {
  try {
    const now = new Date();
    
    const inputClosedRounds = await Round.findAll({
      where: {
        status: 'active',
        inputClose: { [Op.lte]: now }, 
        votingClose: { [Op.gt]: now } 
      }
    });
    
    for (const round of inputClosedRounds) {
      await round.update({ status: 'voting' });
      console.log(`Round ${round.id} updated to voting status`);
    }
    
    const votingClosedRounds = await Round.findAll({
      where: {
        status: { [Op.in]: ['active', 'voting'] }, 
        votingClose: { [Op.lte]: now } 
      }
    });
    
    for (const round of votingClosedRounds) {
      await round.update({ status: 'finished' });
      await determineWinner(round.id);
      console.log(`Round ${round.id} updated to finished status`);
    }
    
  } catch (error) {
    console.error('Error updating rounds status:', error);
  }
}

async function determineWinner(roundId) {
  try {
    const round = await Round.findByPk(roundId, {
      include: [{ model: Group }]
    });
    
    if (!round) {
      console.error(`Round ${roundId} not found`);
      return;
    }
    
    let winnerQuery;
    const votingMethod = round.Group.votingMethod;
    
    if (votingMethod === 'single_vote') {
      winnerQuery = await Song.findAll({
        where: { roundId },
        include: [{ model: Vote, as: 'votes' }],
        attributes: [
          'id', 
          'title', 
          'artist', 
          'submittedBy',
          [sequelize.fn('COUNT', sequelize.col('votes.id')), 'voteCount']
        ],
        group: ['Song.id'],
        order: [[sequelize.literal('voteCount'), 'DESC']],
        limit: 1
      });
      
    } else if (votingMethod === 'top_3') {
  
      winnerQuery = await Song.findAll({
        where: { roundId },
        include: [{ 
          model: Vote, 
          as: 'votes',
          attributes: []
        }],
        attributes: [
          'id', 
          'title', 
          'artist', 
          'submittedBy',
          [
            sequelize.literal('SUM(CASE WHEN "votes"."value" = 1 THEN 3 WHEN "votes"."value" = 2 THEN 2 WHEN "votes"."value" = 3 THEN 1 ELSE 0 END)'),
            'points'
          ]
        ],
        group: ['Song.id'],
        order: [[sequelize.literal('points'), 'DESC']],
        limit: 1
      });
      
    } else if (votingMethod === 'rating') {
      winnerQuery = await Song.findAll({
        where: { roundId },
        include: [{ model: Vote, as: 'votes' }],
        attributes: [
          'id', 
          'title', 
          'artist', 
          'submittedBy',
          [sequelize.fn('AVG', sequelize.col('votes.value')), 'avgRating']
        ],
        group: ['Song.id'],
        order: [[sequelize.literal('avgRating'), 'DESC']],
        limit: 1
      });
    }
    
    if (winnerQuery && winnerQuery.length > 0) {
      const winningSong = winnerQuery[0];
      
      await Group.update(
        { winnerId: winningSong.submittedBy },
        { where: { id: round.groupId } }
      );
      
      console.log(`Winner determined for round ${roundId}: Song ID ${winningSong.id} by User ID ${winningSong.submittedBy}`);
    } else {
      console.log(`No winner could be determined for round ${roundId}`);
    }
    
  } catch (error) {
    console.error(`Error determining winner for round ${roundId}:`, error);
  }
}

module.exports = {
  updateRoundsStatus,
  determineWinner
};
