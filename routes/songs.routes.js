'use strict';

const express = require('express');
const { body } = require('express-validator');
const { requireAuth } = require('../middleware/auth');
const asyncHandler = require('../lib/asyncHandler');
const songController = require('../controllers/songController');

const router = express.Router();
router.use(requireAuth);

// The single definition of song submission (previously registered 3×).
router.post(
  '/rounds/:roundId/songs',
  [
    body('title').trim().isLength({ min: 1, max: 100 }).escape(),
    body('artist').trim().isLength({ min: 1, max: 100 }).escape(),
  ],
  asyncHandler(songController.submitSong)
);

router.get('/songs/:id', asyncHandler(songController.getSongDetail));
router.post('/songs/:id/vote', asyncHandler(songController.submitVote));

module.exports = router;
