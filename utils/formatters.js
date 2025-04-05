/**
 * Format a date to display in military time format (24-hour)
 * @param {Date} date - Date object to format
 * @returns {String} Formatted date with military time (e.g. "2023-05-15 14:30")
 */
function formatDateWithMilitaryTime(date) {
  if (!date) return '';
  
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  
  return `${day}/${month}/${year} ${hours}:${minutes}`;
}

/**
 * Format time only in military format
 * @param {Date} date - Date object to extract time from
 * @returns {String} Time string in 24-hour format (e.g. "14:30")
 */
function formatTimeOnly(date) {
  if (!date) return '';
  
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  
  return `${hours}:${minutes}`;
}

module.exports = {
  formatDateWithMilitaryTime,
  formatTimeOnly
};
