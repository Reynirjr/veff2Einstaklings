function flashMiddleware(req, res, next) {
  req.flash = function(type, message) {
    req.session = req.session || {};
    req.session.flash = req.session.flash || {};
    req.session.flash[type] = message;
  };

  res.locals.flash = {};
  if (req.session && req.session.flash) {
    res.locals.flash = req.session.flash;
    delete req.session.flash;
  }

  next();
}

module.exports = flashMiddleware;
