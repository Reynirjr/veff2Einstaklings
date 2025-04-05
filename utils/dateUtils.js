/**
 * Get the next date for voting based on day and time
 * @param {string} day - Day of the week (e.g., 'friday')
 * @param {string} timeStr - Time string in format 'HH:MM'
 * @returns {Date} The next voting date
 */
function getNextVotingDate(day, timeStr) {
  const dayMap = {
    sunday: 0,
    monday: 1,
    tuesday: 2,
    wednesday: 3,
    thursday: 4,
    friday: 5,
    saturday: 6,
  };
  
  const [hours, minutes] = timeStr.split(':').map(Number);
  const now = new Date();
  
  const result = new Date(now);
  result.setHours(hours, minutes, 0, 0);

  const targetDayNum = dayMap[day.toLowerCase()];
  

  while (result.getDay() !== targetDayNum || result < now) {
    result.setDate(result.getDate() + 1);
    result.setHours(hours, minutes, 0, 0);
  }
  
  return result;
}

module.exports = {
  getNextVotingDate
};
