'use strict';

const express = require('express');
const asyncHandler = require('../lib/asyncHandler');
const { requireAuth } = require('../middleware/auth');
const pushController = require('../controllers/pushController');

const router = express.Router();

router.use(requireAuth);
router.post('/push/subscribe', asyncHandler(pushController.subscribe));
router.post('/push/unsubscribe', asyncHandler(pushController.unsubscribe));

module.exports = router;
