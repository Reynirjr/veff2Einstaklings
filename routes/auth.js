const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const authController = require('../controllers/authController');
const authMiddleware = require('../middleware/authmiddleware');


router.get('/logout', (req, res) => {
  res.clearCookie('token');
  res.redirect('/');
});
router.get('/groups', authMiddleware, (req, res) => {

  res.render('groups', { userId: req.user.id });
});

router.get('/signup', authController.getSignup);

router.post(
  '/signup',
  [
    body('email')
      .isEmail()
      .withMessage('Please enter a valid email.')
      .normalizeEmail(),
    body('username')
      .isLength({ min: 3, max: 20 })
      .withMessage('Username must be between 3 and 20 characters.')
      .trim()
      .escape(),
    body('password')
      .isLength({ min: 6 })
      .withMessage('Password must be at least 6 characters long.'),
    body('confirmPassword')
      .custom((value, { req }) => {
        if (value !== req.body.password) {
          console.log('Password mismatch:', value, req.body.password);
          return false;
        }
        return true;
      })
      .withMessage('Passwords do not match.'),
  ],
  authController.signup
);

router.get('/login', authController.getLogin);

router.post('/login', authController.login);

module.exports = router;
