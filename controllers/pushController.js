'use strict';

const pushService = require('../services/pushService');

/** POST /push/subscribe — store this browser's push subscription (JSON). */
exports.subscribe = async (req, res) => {
  try {
    await pushService.saveSubscription(req.user.id, req.body.subscription);
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ ok: false, error: err.message });
  }
};

/** POST /push/unsubscribe — forget this browser's subscription. */
exports.unsubscribe = async (req, res) => {
  await pushService.removeSubscription(
    req.body.subscription ? req.body.subscription.endpoint : req.body.endpoint
  );
  res.json({ ok: true });
};
