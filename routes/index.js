'use strict';

const express = require('express');
const asyncHandler = require('../lib/asyncHandler');
const homeController = require('../controllers/homeController');

const router = express.Router();

router.get('/', asyncHandler(homeController.home));
router.use(require('./auth.routes'));
router.use(require('./groups.routes'));
router.use(require('./rounds.routes'));
router.use(require('./songs.routes'));
router.use(require('./users.routes'));
router.use(require('./push.routes'));

module.exports = router;
