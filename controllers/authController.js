const { User } = require('../models');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { validationResult } = require('express-validator');

exports.getSignup = (req, res) => {
    res.render('signup', { errors: {}, formData: {} });
};
  
exports.getLogin = (req, res) => {
  const signupSuccess = req.query.signup === 'success';
  const error = req.query.error;
  res.render('login', { signupSuccess, error });
};

exports.signup = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const errorObj = {};
    errors.array().forEach(err => {
      if (!errorObj[err.param]) {
        errorObj[err.param] = err.msg;
      }
    });
    return res.status(400).render('signup', { 
      errors: errorObj, 
      formData: req.body || {} 
    });
  }
  
  try {
    const { email, password, username } = req.body;
    
    const existingUser = await User.findOne({ where: { email } });
    if (existingUser) {
      return res.render('signup', { 
        errors: { email: 'User already exists' }, 
        formData: req.body || {} 
      });
    }
    
    const salt = await bcrypt.genSalt(10);
    const password_hash = await bcrypt.hash(password, salt);
    
    await User.create({
      email,
      password_hash,
      username
    });
    
    res.redirect('/login?signup=success');
  } catch (error) {
    console.error(error);
    res.render('signup', { 
      errors: { server: 'Server error, please try again' }, 
      formData: req.body || {} 
    });
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    
    const user = await User.findOne({ where: { email } });
    if (!user) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }
    
    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }
    
    const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET || 'your_jwt_secret', {
      expiresIn: '1h'
    });
    
    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        email: user.email,
        username: user.username
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};
