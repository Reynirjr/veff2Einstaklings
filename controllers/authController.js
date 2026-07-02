'use strict';

const bcrypt = require('bcrypt');
const { validationResult } = require('express-validator');
const { User } = require('../models');
const { issueToken, clearToken } = require('../middleware/auth');

exports.getSignup = (req, res) => {
  res.render('signup', { errors: {}, formData: {} });
};

exports.getLogin = (req, res) => {
  res.render('login', {
    signupSuccess: req.query.signup === 'success',
    error: mapLoginError(req.query.error),
  });
};

exports.signup = async (req, res) => {
  const result = validationResult(req);
  if (!result.isEmpty()) {
    const errors = {};
    result.array().forEach((e) => {
      const key = e.path || e.param;
      if (!errors[key]) errors[key] = e.msg;
    });
    return res.status(400).render('signup', { errors, formData: req.body || {} });
  }

  const { email, password, username } = req.body;
  const existing = await User.findOne({ where: { email } });
  if (existing) {
    return res
      .status(400)
      .render('signup', { errors: { email: 'User already exists' }, formData: req.body });
  }

  const password_hash = await bcrypt.hash(password, 10);
  await User.create({ email, password_hash, username });
  res.redirect('/login?signup=success');
};

exports.login = async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ where: { email } });
  if (!user || !(await bcrypt.compare(password, user.password_hash))) {
    return res.redirect('/login?error=invalid');
  }
  issueToken(res, user);
  res.redirect('/');
};

exports.logout = (req, res) => {
  clearToken(res);
  res.redirect('/');
};

function mapLoginError(code) {
  switch (code) {
    case 'invalid':
      return 'Rangt netfang eða lykilorð.';
    case 'unauthorized':
      return 'Þú þarft að skrá þig inn.';
    default:
      return null;
  }
}
