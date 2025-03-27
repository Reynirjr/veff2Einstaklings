const jwt = require('jsonwebtoken');

function authMiddleware(req, res, next) {
  const token = req.cookies.token;
  if (!token) {
    return res.redirect('/login?error=unauthorized');
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; 
    next();
  } catch (err) {
    console.error('JWT verification failed:', err);
    return res.redirect('/login?error=unauthorized');
  }
}

module.exports = authMiddleware;
