const { updateRoundsStatus } = require('../utils/roundStatus');

async function roundStatusMiddleware(req, res, next) {
  if (req.path.startsWith('/rounds') || req.path.startsWith('/groups')) {
    await updateRoundsStatus();
  }
  next();
}

module.exports = roundStatusMiddleware;
