'use strict';

const express = require('express');
const { body } = require('express-validator');
const authController = require('../controllers/authController');
const asyncHandler = require('../lib/asyncHandler');

const router = express.Router();

router.get('/login', authController.getLogin);
router.post('/login', asyncHandler(authController.login));
router.get('/logout', authController.logout);

router.get('/signup', authController.getSignup);
router.post(
  '/signup',
  [
    body('email').isEmail().withMessage('Please enter a valid email.').normalizeEmail(),
    body('username')
      .isLength({ min: 3, max: 20 })
      .withMessage('Username must be 3–20 characters.')
      .trim()
      .escape(),
    body('password')
      .isLength({ min: 8 })
      .withMessage('Password must be at least 8 characters.')
      .matches(/[a-z]/)
      .withMessage('Password must contain a lowercase letter.')
      .matches(/[A-Z]/)
      .withMessage('Password must contain an uppercase letter.')
      .matches(/[0-9]/)
      .withMessage('Password must contain a number.'),
    body('confirmPassword')
      .custom((value, { req }) => value === req.body.password)
      .withMessage('Passwords do not match.'),
  ],
  asyncHandler(authController.signup)
);

module.exports = router;
