const { Song, User, Group, Vote } = require('../models');

exports.list = async (req, res) => {
  try {
    const songs = await Song.findAll({
      include: [
        { model: User, attributes: ['id', 'username', 'email'] },
        { model: Group, attributes: ['id', 'name'] }
      ]
    });
    
    res.json(songs);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};