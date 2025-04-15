
const { Round, Group } = require('../models');
const { Op } = require('sequelize');
const { finalizeRound } = require('../utils/roundStatus');

module.exports = async (req, res, next) => {
  try {
    const groupIdMatch = req.path.match(/^\/groups\/(\d+)$/);
    
    if (groupIdMatch && req.method === 'GET') {
      const groupId = parseInt(groupIdMatch[1]);
      const now = new Date();
      
      const expiredRounds = await Round.findAll({
        where: {
          groupId: groupId,
          status: 'voting',
          votingClose: { [Op.lt]: now }
        },
        include: [{ model: Group, as: 'group' }]
      });
      
      if (expiredRounds.length > 0) {
        for (const round of expiredRounds) {
          await finalizeRound(round);
        }
        
        if (!req.query.finalized) {
          return res.redirect(`/groups/${groupId}?finalized=true`);
        }
      }
    }
    
    next();
  } catch (error) {
    console.error('Error in round check middleware:', error);
    next();
  }
};