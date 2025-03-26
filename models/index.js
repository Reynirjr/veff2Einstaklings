const sequelize = require('../config/database');
const User = require('./user');
const Group = require('./group');
const Song = require('./song');
const Vote = require('./vote');


Group.belongsTo(User, { foreignKey: 'created_by' });
User.hasMany(Group, { foreignKey: 'created_by' });

Song.belongsTo(Group, { foreignKey: 'group_id' });
Song.belongsTo(User, { foreignKey: 'submitted_by' });

Vote.belongsTo(Song, { foreignKey: 'song_id' });
Vote.belongsTo(User, { foreignKey: 'user_id' });


module.exports = {
  sequelize,
  User,
  Group,
  Song,
  Vote,
};
