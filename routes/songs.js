const express = require('express');
const router = express.Router();
const songController = require('../controllers/songController');
const authMiddleware = require('../middleware/authmiddleware');

// Song detail page with YouTube embed
router.get('/:id', authMiddleware, songController.getSongDetail);

// Submit a song to a round
router.post('/rounds/:roundId/songs', authMiddleware, songController.submitSong);

// Vote for a song
router.post('/:id/vote', authMiddleware, songController.submitVote);

// Group voting page (list of songs)
router.get('/groups/:groupId/voting', authMiddleware, songController.getGroupVoting);

module.exports = router;