const { Group, Round, Song } = require('../models');
const { Op } = require('sequelize');


function calculateNextRoundDate(lastRound, group) {
  const recurrence = group.votingRecurrence || 'none';
  const lastDate = new Date(lastRound.inputOpen);
  const nextDate = new Date(lastDate);
  
  if (recurrence === 'none') {
    return null;
  }
  
  if (recurrence === 'daily') {
    nextDate.setDate(nextDate.getDate() + 1);
  } else if (recurrence === 'weekly') {
    nextDate.setDate(nextDate.getDate() + 7);
  } else if (recurrence === 'biweekly') {
    nextDate.setDate(nextDate.getDate() + 14);
  } else if (recurrence === 'monthly') {
    nextDate.setMonth(nextDate.getMonth() + 1);
  }
  
  return nextDate;
}


async function scheduleNextRound(finishedRoundId) {
  try {
    const finishedRound = await Round.findByPk(finishedRoundId, {
      include: [{ model: Group, as: 'group' }]
    });
    
    if (!finishedRound || !finishedRound.group) {
      console.error(`Cannot schedule next round: Round ${finishedRoundId} or its group not found`);
      return null;
    }
    
    const group = finishedRound.group;
    
    if (group.votingRecurrence === 'none') {
      console.log(`Group ${group.id} has recurrence set to 'none'. Not scheduling a next round.`);
      return null;
    }
    
    const nextStartDate = calculateNextRoundDate(finishedRound, group);
    if (!nextStartDate) {
      return null;
    }
    
    const inputOpenTime = group.inputOpenTime || '00:00:00';
    const votingOpenTime = group.votingOpenTime || '08:00:00';
    const votingCloseTime = group.votingCloseTime || '12:00:00';
    
    const [inputOpenHour, inputOpenMin] = inputOpenTime.split(':').map(Number);
    const [votingOpenHour, votingOpenMin] = votingOpenTime.split(':').map(Number);
    const [votingCloseHour, votingCloseMin] = votingCloseTime.split(':').map(Number);
    
    const inputOpen = new Date(nextStartDate);
    inputOpen.setHours(inputOpenHour, inputOpenMin, 0, 0);
    
    const votingOpen = new Date(nextStartDate);
    votingOpen.setHours(votingOpenHour, votingOpenMin, 0, 0);
    
    const votingClose = new Date(nextStartDate);
    votingClose.setHours(votingCloseHour, votingCloseMin, 0, 0);
    
    if (votingClose < votingOpen) {
      votingClose.setDate(votingClose.getDate() + 1);
    }
    
    const newRound = await Round.create({
      groupId: group.id,
      roundNumber: finishedRound.roundNumber + 1,
      theme: group.theme,
      status: 'pending',
      inputOpen: inputOpen,
      inputClose: votingOpen,
      votingOpen: votingOpen,
      votingClose: votingClose
    });
    
    console.log(`New round ${newRound.id} (round #${newRound.roundNumber}) scheduled for group ${group.id}`);
    console.log(`Next round starts: ${inputOpen.toISOString()}`);
    
    return newRound;
  } catch (error) {
    console.error('Error scheduling next round:', error);
    return null;
  }
}

module.exports = {
  scheduleNextRound,
  calculateNextRoundDate
};