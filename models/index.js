const User = require('./user');
const Group = require('./group');
const Song = require('./song');
const Vote = require('./vote');
const GroupUser = require('./groupUser');

const db = { User, Group, Song, Vote, GroupUser };

Object.values(db).forEach((model) => {
  if (model.associate) {
    model.associate(db);
  }
});

module.exports = db;
