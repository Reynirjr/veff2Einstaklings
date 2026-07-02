'use strict';

const express = require('express');
const { requireAuth } = require('../middleware/auth');
const asyncHandler = require('../lib/asyncHandler');
const roundController = require('../controllers/roundController');

const router = express.Router();
router.use(requireAuth);

router.get('/rounds/:roundId', asyncHandler(roundController.show));

module.exports = router;
