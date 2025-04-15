const { Round, Group } = require('../models');
const { Op } = require('sequelize');
const { finalizeRound } = require('../utils/roundStatus');

const roundStatusMiddleware = async (req, res, next) => {
  try {
    const now = new Date();
    
    const expiredRounds = await Round.findAll({
      where: {
        status: 'voting',
        votingClose: { [Op.lt]: now }
      },
      include: [{ model: Group, as: 'group' }]
    });
    
    for (const round of expiredRounds) {
      await finalizeRound(round);
    }
    
    next();
  } catch (error) {
    console.error('Error in round status middleware:', error);
    next();
  }
};

module.exports = roundStatusMiddleware;
