'use strict';

/**
 * Formatting helpers exposed to EJS templates via res.locals. Pure and
 * presentation-only (date formatting + profile-image positioning).
 */

const pad = (n) => String(n).padStart(2, '0');

function formatDateWithMilitaryTime(date) {
  if (!date) return '';
  const d = new Date(date);
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`;
}

function formatTimeOnly(date) {
  if (!date) return '';
  const d = new Date(date);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function formatDateTimeRange(startDate, endDate) {
  if (!startDate || !endDate) return '';
  const s = new Date(startDate);
  const e = new Date(endDate);
  const sameDay =
    s.getDate() === e.getDate() &&
    s.getMonth() === e.getMonth() &&
    s.getFullYear() === e.getFullYear();

  const datePart = `${pad(s.getDate())}/${pad(s.getMonth() + 1)}/${s.getFullYear()}`;
  const sTime = `${pad(s.getHours())}:${pad(s.getMinutes())}`;
  const eTime = `${pad(e.getHours())}:${pad(e.getMinutes())}`;

  if (sameDay) return `${datePart} ${sTime}-${eTime}`;
  const endDatePart = `${pad(e.getDate())}/${pad(e.getMonth() + 1)}/${e.getFullYear()}`;
  return `${datePart} ${sTime} - ${endDatePart} ${eTime}`;
}

/**
 * Inline CSS to position a profile picture inside its frame, scaled per context.
 */
function getImagePositionStyle(positionJson, context = 'profile') {
  try {
    if (!positionJson) return '';
    const position = JSON.parse(positionJson);

    const SIZES = { profile: 150, avatar: 36, winner: 60 };
    const scale = (SIZES[context] || SIZES.profile) / SIZES.profile;

    const x = (position.x || 0) * scale;
    const y = (position.y || 0) * scale;
    let zoom = position.zoom || 100;
    if (context !== 'profile') zoom = Math.max(zoom * scale, 100);

    return `width: ${zoom}%; height: auto; transform: translate(${x}px, ${y}px);`;
  } catch (err) {
    return '';
  }
}

/** Extract the 11-char YouTube video id from any of the usual URL shapes. */
const YT_PATTERNS = [
  /(?:youtube\.com\/(?:[^/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?/\s]{11})/,
  /(?:youtu\.be\/)([^"&?/\s]{11})/,
];

function extractYouTubeId(url) {
  if (!url) return '';
  for (const pattern of YT_PATTERNS) {
    const match = url.match(pattern);
    if (match && match[1]) return match[1];
  }
  return '';
}

module.exports = {
  formatDateWithMilitaryTime,
  formatTimeOnly,
  formatDateTimeRange,
  getImagePositionStyle,
  extractYouTubeId,
};
