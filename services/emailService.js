'use strict';

const nodemailer = require('nodemailer');
const { Op } = require('sequelize');
const { config } = require('../config/env');
const { Round, Group, User, RoundReminder } = require('../models');
const { formatTimeOnly } = require('../lib/viewHelpers');

/**
 * Day-of reminder emails: on the morning of a round's day (default 09:00,
 * server clock = UTC = Icelandic time) every group member gets one email with
 * the day's schedule and theme.
 *
 * Disabled (no-op) until SMTP is configured. Idempotent across restarts via
 * the RoundReminders table — one row per round, sent exactly once.
 */

const enabled = !!(config.email.host && config.email.user && config.email.pass);

let transporter = null;
if (enabled) {
  transporter = nodemailer.createTransport({
    host: config.email.host,
    port: config.email.port,
    secure: config.email.port === 465,
    auth: { user: config.email.user, pass: config.email.pass },
  });
} else {
  console.log('Reminder emails disabled (SMTP not configured).');
}

function sameDay(a, b) {
  const da = new Date(a);
  const db = new Date(b);
  return (
    da.getFullYear() === db.getFullYear() &&
    da.getMonth() === db.getMonth() &&
    da.getDate() === db.getDate()
  );
}

function reminderHtml(group, round) {
  const groupUrl = `${config.appUrl}/groups/${group.id}`;
  return `
  <div style="font-family: 'Segoe UI', sans-serif; max-width: 520px; margin: 0 auto; color: #1d3557;">
    <h2 style="color: #457b9d;">🎵 Tónaleikarnir eru í dag!</h2>
    <p><strong>${group.name}</strong> — umferð #${round.roundNumber}</p>
    ${round.theme ? `<p style="font-size: 1.1em;">Þema dagsins: <strong>${round.theme}</strong></p>` : ''}
    <table style="border-collapse: collapse; margin: 1em 0;">
      <tr>
        <td style="padding: 6px 12px 6px 0;">🎵 Innsendingar:</td>
        <td style="padding: 6px 0;"><strong>${formatTimeOnly(round.inputOpen)}–${formatTimeOnly(round.inputClose)}</strong></td>
      </tr>
      <tr>
        <td style="padding: 6px 12px 6px 0;">🗳️ Kosning:</td>
        <td style="padding: 6px 0;"><strong>${formatTimeOnly(round.votingOpen)}–${formatTimeOnly(round.votingClose)}</strong></td>
      </tr>
    </table>
    <p style="margin: 1.5em 0;">
      <a href="${groupUrl}"
         style="background: #457b9d; color: #ffffff; padding: 10px 24px; border-radius: 6px; text-decoration: none; font-weight: 600;">
        Opna hópinn
      </a>
    </p>
    <p style="font-size: 0.85em; opacity: 0.7;">Þú færð þennan póst af því þú ert meðlimur í hópnum ${group.name} á Tónaleikunum.</p>
  </div>`;
}

async function sendReminderForRound(round, group) {
  const members = group.members || [];
  await Promise.all(
    members.map(async (member) => {
      if (!member.email) return;
      try {
        await transporter.sendMail({
          from: `"Tónaleikarnir" <${config.email.from}>`,
          to: member.email,
          subject: `🎵 Tónaleikarnir í dag — ${group.name}${round.theme ? ` (þema: ${round.theme})` : ''}`,
          html: reminderHtml(group, round),
        });
      } catch (err) {
        console.error(`Reminder email to ${member.email} failed:`, err.message);
      }
    })
  );
  console.log(`[email] Day-of reminder sent for round ${round.id} (${group.name}, ${members.length} members).`);
}

/**
 * Called every minute by the round job. After the reminder hour, sends the
 * day-of email for every round happening today that hasn't been reminded yet.
 * Never throws.
 */
async function sendDailyReminders(now = new Date()) {
  if (!enabled) return;
  if (now.getHours() < config.email.reminderHour) return;

  try {
    const rounds = await Round.findAll({
      where: { status: { [Op.ne]: 'finished' } },
      include: [
        {
          model: Group,
          as: 'group',
          include: [{ model: User, as: 'members', attributes: ['email', 'username'] }],
        },
      ],
    });

    for (const round of rounds) {
      if (!round.group) continue;
      if (!sameDay(round.inputOpen, now)) continue; // not today's round
      if (new Date(round.votingClose) <= now) continue; // day's action already over

      // findOrCreate is the idempotency lock: only the creator sends.
      const [, created] = await RoundReminder.findOrCreate({ where: { roundId: round.id } });
      if (!created) continue;

      await sendReminderForRound(round, round.group);
    }
  } catch (err) {
    console.error('[email] sendDailyReminders failed:', err.message);
  }
}

module.exports = { enabled, sendDailyReminders };
