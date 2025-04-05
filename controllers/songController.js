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

exports.finalizeVoting = async (req, res) => {
  try {
    // 1. Identify the winning song (e.g., highest voteCount)
    // const winningSong = ...your logic here...

    // 2. Update the group's winnerId
    // await Group.update({ winnerId: winningSong.submittedBy }, { where: { id: winningSong.groupId } });

    // Redirect or respond
    res.redirect('/groups/' + winningSong.groupId);
  } catch (error) {
    console.error(error);
    res.status(500).send('Error finalizing voting');
  }
};

exports.getSongDetail = async (req, res) => {
  try {
    const songId = req.params.id;
    const userId = req.user.id;
    
    const song = await Song.findByPk(songId, {
      include: [
        { model: User, as: 'submitter' },
        { model: Group }
      ]
    });
    
    if (!song) {
      return res.status(404).render('error', { message: 'Song not found' });
    }
    
    // For now, a simple rendering - we'll enhance this later
    res.render('songDetail', { song });
  } catch (error) {
    console.error('Error getting song details:', error);
    res.status(500).render('error', { message: 'Server error' });
  }
};

exports.submitSong = async (req, res) => {
  try {
    const { title, artist } = req.body;
    const roundId = req.params.roundId;
    const userId = req.user.id;
    
    // Get the group ID from the round
    const round = await Round.findByPk(roundId);
    if (!round) {
      return res.status(404).render('error', { message: 'Round not found' });
    }
    
    // Create the song
    await Song.create({
      title,
      artist,
      roundId,
      groupId: round.groupId,
      submittedBy: userId
    });
    
    res.redirect(`/groups/${round.groupId}`);
  } catch (error) {
    console.error('Error submitting song:', error);
    res.status(500).render('error', { message: 'Error submitting song' });
  }
};

exports.submitVote = async (req, res) => {
  try {
    // Voting logic will go here
    res.status(200).send('Vote submitted');
  } catch (error) {
    console.error('Error submitting vote:', error);
    res.status(500).render('error', { message: 'Error submitting vote' });
  }
};

exports.getGroupVoting = async (req, res) => {
  try {
    // Group voting page logic will go here
    res.status(200).render('voting', { group: {}, songs: [] });
  } catch (error) {
    console.error('Error loading voting page:', error);
    res.status(500).render('error', { message: 'Error loading voting page' });
  }
};