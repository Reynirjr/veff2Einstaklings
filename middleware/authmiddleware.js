const jwt = require('jsonwebtoken');
const { User } = require('../models');

async function authMiddleware(req, res, next) {
  const token = req.cookies.token;
  if (!token) {
    return res.redirect('/login?error=unauthorized');
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    const user = await User.findByPk(decoded.id);
    if (!user) {
      return res.redirect('/login?error=invalid_user');
    }
    
    req.user = user;
    next();
  } catch (err) {
    console.error('JWT verification failed:', err);
    return res.redirect('/login?error=unauthorized');
  }
}

module.exports = authMiddleware;
