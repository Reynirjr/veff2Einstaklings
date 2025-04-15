
function formatDateWithMilitaryTime(date) {
  if (!date) return '';
  
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  
  return `${day}/${month}/${year} ${hours}:${minutes}`;
}


function formatTimeOnly(date) {
  if (!date) return '';
  
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  
  return `${hours}:${minutes}`;
}


function formatDateTimeRange(startDate, endDate) {
  if (!startDate || !endDate) return '';
  
  const sameDay = startDate.getDate() === endDate.getDate() && 
                 startDate.getMonth() === endDate.getMonth() && 
                 startDate.getFullYear() === endDate.getFullYear();
  
  const day = String(startDate.getDate()).padStart(2, '0');
  const month = String(startDate.getMonth() + 1).padStart(2, '0');
  const year = startDate.getFullYear();
  
  const startHours = String(startDate.getHours()).padStart(2, '0');
  const startMinutes = String(startDate.getMinutes()).padStart(2, '0');
  
  const endHours = String(endDate.getHours()).padStart(2, '0');
  const endMinutes = String(endDate.getMinutes()).padStart(2, '0');
  
  if (sameDay) {
    return `${day}/${month}/${year} ${startHours}:${startMinutes}-${endHours}:${endMinutes}`;
  } else {
    const endDay = String(endDate.getDate()).padStart(2, '0');
    const endMonth = String(endDate.getMonth() + 1).padStart(2, '0');
    const endYear = endDate.getFullYear();
    
    return `${day}/${month}/${year} ${startHours}:${startMinutes} - ${endDay}/${endMonth}/${endYear} ${endHours}:${endMinutes}`;
  }
}

module.exports = {
  formatDateWithMilitaryTime,
  formatTimeOnly,
  formatDateTimeRange
};
