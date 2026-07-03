'use strict';

const webpush = require('web-push');
const { config } = require('../config/env');
const { PushSubscription, GroupUser } = require('../models');

/**
 * Web Push notifications (VAPID). Fires on round-lifecycle transitions so
 * members hear about new submission windows, voting opening and results —
 * without keeping a tab open.
 *
 * Disabled entirely (no-op sends) when the VAPID keys are not configured,
 * so dev environments work without any setup.
 */

const enabled = !!(config.vapid.publicKey && config.vapid.privateKey);
if (enabled) {
  webpush.setVapidDetails(config.vapid.subject, config.vapid.publicKey, config.vapid.privateKey);
} else {
  console.log('Web Push disabled (VAPID keys not configured).');
}

/** Store (or refresh) a browser subscription for a user. */
async function saveSubscription(userId, subscription) {
  const { endpoint, keys } = subscription || {};
  if (!endpoint || !keys || !keys.p256dh || !keys.auth) {
    throw new Error('Invalid push subscription.');
  }
  // Same browser re-subscribing (possibly as another user) → replace in place.
  const [row, created] = await PushSubscription.findOrCreate({
    where: { endpoint },
    defaults: { userId, p256dh: keys.p256dh, auth: keys.auth },
  });
  if (!created) {
    await row.update({ userId, p256dh: keys.p256dh, auth: keys.auth });
  }
  return row;
}

async function removeSubscription(endpoint) {
  if (!endpoint) return 0;
  return PushSubscription.destroy({ where: { endpoint } });
}

/**
 * Send a payload to every subscription of the given users. Expired/revoked
 * subscriptions (404/410) are deleted as we go. Never throws — a failed
 * notification must not break the round lifecycle.
 */
async function notifyUsers(userIds, payload) {
  if (!enabled || !userIds || userIds.length === 0) return;

  const subs = await PushSubscription.findAll({ where: { userId: userIds } });
  const body = JSON.stringify(payload);

  await Promise.all(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          body
        );
      } catch (err) {
        if (err.statusCode === 404 || err.statusCode === 410) {
          await sub.destroy().catch(() => {});
        } else {
          console.error('Push send failed:', err.statusCode || err.message);
        }
      }
    })
  );
}

/**
 * Notify every member of a group. `excludeUserId` skips one member (e.g. the
 * winner already staring at their own confetti).
 */
async function notifyGroupMembers(groupId, payload, { excludeUserId = null } = {}) {
  if (!enabled) return;
  try {
    const members = await GroupUser.findAll({ where: { groupId }, attributes: ['userId'] });
    const userIds = members
      .map((m) => m.userId)
      .filter((id) => id !== excludeUserId);
    await notifyUsers(userIds, payload);
  } catch (err) {
    console.error('Push notify failed:', err.message);
  }
}

module.exports = {
  enabled,
  saveSubscription,
  removeSubscription,
  notifyUsers,
  notifyGroupMembers,
};
