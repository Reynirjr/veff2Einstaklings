
function getImagePositionStyle(positionJson, context = 'profile') {
  try {
    if (!positionJson) return '';
    
    const position = JSON.parse(positionJson);
    
    const PROFILE_SIZE = 150; 
    const AVATAR_SIZE = 36;  
    const WINNER_SIZE = 60;
    
    let scalingFactor = 1;
    if (context === 'avatar') {
      scalingFactor = AVATAR_SIZE / PROFILE_SIZE;
    } else if (context === 'winner') {
      scalingFactor = WINNER_SIZE / PROFILE_SIZE;
    }
    
    const x = position.x * scalingFactor;
    const y = position.y * scalingFactor;
    
    let zoom = position.zoom || 100;
    if (context !== 'profile') {
     
      const minZoom = 100;
      zoom = Math.max(zoom * scalingFactor, minZoom);
    }
    
    return `width: ${zoom}%; height: auto; transform: translate(${x}px, ${y}px);`;
  } catch (err) {
    console.error('Error parsing image position:', err);
    return '';
  }
}

module.exports = {
  getImagePositionStyle
};