'use strict';

const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { csrfProtection } = require('../middleware/csrf');
const asyncHandler = require('../lib/asyncHandler');
const userController = require('../controllers/userController');

const router = express.Router();
router.use(requireAuth);

router.get('/users/:id', asyncHandler(userController.getProfile));
router.get('/users/:id/edit', userController.getEditForm);

// The profile edit is multipart (XHR). It is skipped by the global CSRF guard,
// so we validate CSRF here *after* multer has parsed the request.
router.post(
  '/users/:id/edit',
  userController.uploadProfilePicture,
  csrfProtection,
  asyncHandler(userController.updateProfile)
);

module.exports = router;
