
function getNextVotingDate(votingDay, votingOpenTime) {
  const daysMap = {
    'sunday': 0,
    'monday': 1,
    'tuesday': 2,
    'wednesday': 3,
    'thursday': 4,
    'friday': 5,
    'saturday': 6
  };
  
  const targetDay = daysMap[votingDay.toLowerCase()];
  if (targetDay === undefined) {
    console.error(`Invalid voting day: ${votingDay}`);
    return new Date(); 
  }
  
  const today = new Date();
  const currentDay = today.getDay(); 
  
  let daysToAdd = (targetDay - currentDay + 7) % 7;
  
  if (daysToAdd === 0) {
    const timeComponents = votingOpenTime.split(':');
    const votingHour = parseInt(timeComponents[0], 10);
    const votingMinute = parseInt(timeComponents[1], 10);
    
    const votingTimeToday = new Date(today);
    votingTimeToday.setHours(votingHour, votingMinute, 0, 0);
    
    if (today < votingTimeToday) {
      daysToAdd = 0;
    } else {
      daysToAdd = 7;
    }
  }
  
  const resultDate = new Date(today);
  resultDate.setDate(today.getDate() + daysToAdd);
  
  if (votingOpenTime) {
    const [hours, minutes] = votingOpenTime.split(':').map(Number);
    resultDate.setHours(hours, minutes, 0, 0);
  }
  
  return resultDate;
}

module.exports = {
  getNextVotingDate
};
