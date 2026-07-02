'use strict';

const express = require('express');
const rateLimit = require('express-rate-limit');
const { GroupUser } = require('../models');
const { requireAuth } = require('../middleware/auth');
const asyncHandler = require('../lib/asyncHandler');
const groupController = require('../controllers/groupController');
const roundController = require('../controllers/roundController');
const songController = require('../controllers/songController');

const router = express.Router();
router.use(requireAuth);

const createGroupLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: 'Too many group creation attempts. Please try again later.',
});

// Admin-only guard for a :id group.
const requireGroupAdmin = asyncHandler(async (req, res, next) => {
  const isAdmin = await GroupUser.findOne({
    where: { groupId: req.params.id, userId: req.user.id, role: 'admin' },
  });
  if (!isAdmin) {
    res.flash('error', 'You must be an admin to access this page.');
    return res.redirect(`/groups/${req.params.id}`);
  }
  next();
});

router.get('/groups', asyncHandler(groupController.list));
router.get('/groups/create', groupController.showCreate);
router.post('/groups', createGroupLimiter, asyncHandler(groupController.create));

router.get('/groups/:id', asyncHandler(groupController.show));
router.post('/groups/:id/join', asyncHandler(groupController.join));
router.post('/groups/:id/delete', asyncHandler(groupController.destroy));
router.post('/groups/:id/theme', asyncHandler(roundController.setNextTheme));
router.post('/groups/:id/rounds', requireGroupAdmin, asyncHandler(roundController.createRound));

router.get('/groups/:id/admin', requireGroupAdmin, asyncHandler(groupController.adminPanel));
router.post(
  '/groups/:id/members/:userId/remove',
  requireGroupAdmin,
  asyncHandler(groupController.removeMember)
);

router.get('/groups/:groupId/voting', asyncHandler(songController.getGroupVoting));

module.exports = router;
