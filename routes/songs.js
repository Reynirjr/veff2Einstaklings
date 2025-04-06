const express = require('express');
const router = express.Router();
const songController = require('../controllers/songController');
const authMiddleware = require('../middleware/authmiddleware');

router.get('/songs/:id', authMiddleware, songController.getSongDetail);

router.post('/rounds/:roundId/songs', authMiddleware, songController.submitSong);

router.post('/songs/:id/vote', authMiddleware, songController.submitVote);

router.get('/groups/:groupId/voting', authMiddleware, songController.getGroupVoting);

module.exports = router;