const { Round, Song, Vote, User, Group } = require('../models');
const sequelize = require('../config/database');

async function finalizeRound(round) {
  try {
    const group = await Group.findByPk(round.groupId);
    if (!group) return;
    
    let winningSong = null;
    
    if (group.votingMethod === 'rating' || group.votingMethod === 'top_3') {
      try {
        const songs = await Song.findAll({
          where: { roundId: round.id },
          include: [
            { model: User, as: 'submitter' },
            { model: Vote, as: 'votes' }
          ]
        });
        
        if (songs.length === 0) return;
        
        if (group.votingMethod === 'rating') {
          let highestRating = 0;
          let winnerId = null;
          
          for (const song of songs) {
            if (song.votes.length === 0) continue;
            
            const totalRating = song.votes.reduce((sum, vote) => sum + vote.value, 0);
            const avgRating = totalRating / song.votes.length;
            
            if (avgRating > highestRating) {
              highestRating = avgRating;
              winnerId = song.id;
            }
          }
          
          if (winnerId) {
            winningSong = songs.find(s => s.id === winnerId);
          }
        } else if (group.votingMethod === 'top_3') {
          let highestPoints = 0;
          let winnerId = null;
          
          for (const song of songs) {
            let points = 0;
            
            song.votes.forEach(vote => {
              const pointValue = 4 - vote.value;
              points += pointValue;
            });
            
            if (points > highestPoints) {
              highestPoints = points;
              winnerId = song.id;
            }
          }
          
          if (winnerId) {
            winningSong = songs.find(s => s.id === winnerId);
          }
        }
      } catch (error) {
        console.error(`Error calculating winner:`, error);
      }
    } else {
      try {
        const result = await sequelize.query(`
          SELECT s.id, s.title, s.artist, s."submittedBy", COUNT(v.id) as vote_count
          FROM "Songs" s
          LEFT JOIN "Votes" v ON s.id = v."songId"
          WHERE s."roundId" = :roundId
          GROUP BY s.id, s.title, s.artist, s."submittedBy"
          ORDER BY vote_count DESC
          LIMIT 1
        `, {
          replacements: { roundId: round.id },
          type: sequelize.QueryTypes.SELECT
        });
        
        if (result && result.length > 0) {
          const winnerData = result[0];
          winningSong = await Song.findByPk(winnerData.id, {
            include: [{ model: User, as: 'submitter' }]
          });
        }
      } catch (error) {
        console.error(`Error finding winner:`, error);
      }
    }
    
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
    }
  } catch (error) {
    console.error(`Error finalizing round:`, error);
  }
}

const { Op } = require('sequelize');

async function checkRoundStatuses() {
  const now = new Date();
  
  try {
    const inputRounds = await Round.findAll({
      where: {
        status: 'pending',
        inputOpen: { [Op.lte]: now }
      }
    });
    
    for (const round of inputRounds) {
      round.status = 'input';
      await round.save();
    }
    
    const votingRounds = await Round.findAll({
      where: {
        status: 'input',
        votingOpen: { [Op.lte]: now }
      }
    });
    
    for (const round of votingRounds) {
      round.status = 'voting';
      await round.save();
    }
    
    const finishedRounds = await Round.findAll({
      where: {
        status: 'voting',
        votingClose: { [Op.lte]: now }
      },
      include: [{ model: Group, as: 'group' }]
    });
    
    for (const round of finishedRounds) {
      await finalizeRound(round);
    }

    const finishedRoundsWithoutNextRound = await Round.findAll({
      where: {
        status: 'finished'
      },
      include: [
        { 
          model: Group, 
          as: 'group',
          where: {
            votingRecurrence: {
              [Op.not]: 'none'
            }
          }
        }
      ]
    });
    
    for (const finishedRound of finishedRoundsWithoutNextRound) {
      const existingNextRound = await Round.findOne({
        where: {
          groupId: finishedRound.groupId,
          roundNumber: finishedRound.roundNumber + 1
        }
      });
      
      if (!existingNextRound) {
        await createNextRound(finishedRound);
      }
    }

    const groupsWithoutRounds = await Group.findAll({
      include: [{
        model: Round,
        as: 'rounds',
        required: false
      }],
      where: sequelize.literal('(SELECT COUNT("Rounds"."id") FROM "Rounds" WHERE "Rounds"."groupId" = "Group"."id") = 0')
    });
    
    
    for (const group of groupsWithoutRounds) {
      await createFirstRound(group);
    }
  } catch (error) {
    console.error('Error checking round statuses:', error);
  }
}

async function createNextRound(finishedRound) {
  try {
    const group = finishedRound.group || 
                 await Group.findByPk(finishedRound.groupId);
    
    if (!group) {
      console.error(`Group ${finishedRound.groupId} not found when creating next round`);
      return;
    }
    
    
    let nextInputOpen;
    const votingDay = group.votingDay || 'friday'; 
    
    switch (group.votingRecurrence) {
      case 'daily':
        nextInputOpen = new Date(finishedRound.inputOpen);
        nextInputOpen.setDate(nextInputOpen.getDate() + 1);
        break;
        
      case 'weekly':
        nextInputOpen = new Date(finishedRound.inputOpen);
        nextInputOpen.setDate(nextInputOpen.getDate() + 7);
        break;
        
      case 'biweekly':
        nextInputOpen = new Date(finishedRound.inputOpen);
        nextInputOpen.setDate(nextInputOpen.getDate() + 14);
        break;
        
      case 'monthly':
        nextInputOpen = new Date(finishedRound.inputOpen);
        nextInputOpen.setMonth(nextInputOpen.getMonth() + 1);
        break;
        
      default:
        return;
    }
    
    const nextInputClose = new Date(nextInputOpen);
    const nextVotingOpen = new Date(nextInputOpen);
    const nextVotingClose = new Date(nextInputOpen);
    
    const [inputOpenHour, inputOpenMin] = group.inputOpenTime.split(':').map(Number);
    const [votingOpenHour, votingOpenMin] = group.votingOpenTime.split(':').map(Number);
    const [votingCloseHour, votingCloseMin] = group.votingCloseTime.split(':').map(Number);
    
    nextInputOpen.setHours(inputOpenHour, inputOpenMin, 0, 0);
    nextVotingOpen.setHours(votingOpenHour, votingOpenMin, 0, 0);
    nextVotingClose.setHours(votingCloseHour, votingCloseMin, 0, 0);
    
    await Round.create({
      groupId: group.id,
      roundNumber: finishedRound.roundNumber + 1,
      theme: group.theme,
      inputOpen: nextInputOpen,
      inputClose: nextVotingOpen,
      votingOpen: nextVotingOpen,
      votingClose: nextVotingClose,
      status: 'pending'
    });
    
  } catch (error) {
    console.error('Error creating next round:', error);
  }
}

async function createFirstRound(group) {
  try {
    
    const now = new Date();
    let inputOpen = new Date();
    let initialStatus = 'pending';
    
    const [inputOpenHour, inputOpenMin] = group.inputOpenTime.split(':').map(Number);
    const [votingOpenHour, votingOpenMin] = group.votingOpenTime.split(':').map(Number);
    const [votingCloseHour, votingCloseMin] = group.votingCloseTime.split(':').map(Number);
    
    inputOpen.setHours(inputOpenHour, inputOpenMin, 0, 0);
    
    const votingOpen = new Date(inputOpen);
    votingOpen.setHours(votingOpenHour, votingOpenMin, 0, 0);
    
    const votingClose = new Date(inputOpen);
    votingClose.setHours(votingCloseHour, votingCloseMin, 0, 0);
    
    if (votingClose < votingOpen) {
      votingClose.setDate(votingClose.getDate() + 1);
    }
    
    if (now >= inputOpen && now < votingOpen) {
      initialStatus = 'input';
    } else if (now >= votingOpen && now < votingClose) {
      initialStatus = 'voting';
    }
    
    await Round.create({
      groupId: group.id,
      roundNumber: 1,
      theme: group.theme,
      inputOpen,
      inputClose: votingOpen,
      votingOpen,
      votingClose,
      status: initialStatus
    });
    
  } catch (error) {
    console.error('Error creating first round for group:', error);
  }
}

function startRoundStatusChecker() {
  
  checkRoundStatuses();
  
  return setInterval(checkRoundStatuses, 60000);
}

module.exports = { 
  finalizeRound, 
  checkRoundStatuses, 
  startRoundStatusChecker, 
  createNextRound, 
  createFirstRound 
};
