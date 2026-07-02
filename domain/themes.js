'use strict';

/**
 * The single pool of suggested round themes (previously duplicated as two
 * divergent hardcoded arrays in the group-create and set-theme routes).
 */

const THEME_POOL = Object.freeze([
  'Rokk Klassík',
  "80's Popp",
  'Hip-Hop Smellir',
  'Suður-amerísk Tónlist',
  'Eurovision',
  'Íslensk Tónlist',
  'Kvikmyndatónlist',
  'Jólatónlist',
  'Sumarsmellir',
  'Country Classics',
  'Rock Legends',
  'Indie Gems',
  '90s Nostalgia',
  'One-Hit Wonders',
  'Electronic Dance',
  'K-pop',
]);

/**
 * Pick a random theme. `rng` is injectable so tests are deterministic.
 */
function pickRandomTheme(rng = Math.random) {
  return THEME_POOL[Math.floor(rng() * THEME_POOL.length)];
}

module.exports = { THEME_POOL, pickRandomTheme };
