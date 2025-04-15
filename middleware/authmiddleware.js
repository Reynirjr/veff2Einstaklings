const jwt = require('jsonwebtoken');
const { User } = require('../models');

async function authMiddleware(req, res, next) {
  try {
    const token = req.cookies.token;
    
    if (!token) {
      return res.redirect('/login?error=unauthorized');
    }
    
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findByPk(decoded.id);
    
    if (!user) {
      res.clearCookie('token');
      return res.redirect('/login?error=user_not_found');
    }
    
    req.user = user;
    res.locals.user = user;
    next();
  } catch (error) {
    console.error('Auth error:', error);
    res.clearCookie('token');
    res.redirect('/login?error=invalid_token');
  }
}

module.exports = authMiddleware;
