const { Song, User, Group, Vote, Round, UserScore, sequelize } = require('../models');
const { Op } = require('sequelize'); // Add this line

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
    const roundId = req.params.roundId;
    
    const round = await Round.findByPk(roundId, {
      include: [{ model: Group, as: 'group' }]
    });
    
    if (!round) {
      return res.status(404).render('error', { message: 'Round not found' });
    }
    
    if (round.status !== 'voting') {
      return res.status(400).render('error', { message: 'Voting is not active for this round' });
    }
    
    // Find winning song based on voting method
    const group = round.group;
    let winningSong;
    
    if (group.votingMethod === 'rating') {
      // For rating, find song with highest average rating
      winningSong = await Song.findOne({
        where: { roundId },
        include: [
          { model: User, as: 'submitter' },
          { model: Vote, as: 'votes' }
        ],
        attributes: [
          'id', 'title', 'artist', 'submittedBy',
          [sequelize.fn('AVG', sequelize.col('votes.value')), 'averageRating'],
          [sequelize.fn('COUNT', sequelize.col('votes.id')), 'voteCount']
        ],
        group: ['Song.id', 'submitter.id'],
        order: [[sequelize.fn('AVG', sequelize.col('votes.value')), 'DESC']],
        having: sequelize.literal('COUNT("votes"."id") > 0')
      });
    } else {
      // For single vote or top 3, find song with most votes
      winningSong = await Song.findOne({
        where: { roundId },
        include: [
          { model: User, as: 'submitter' },
          { model: Vote, as: 'votes' }
        ],
        attributes: [
          'id', 'title', 'artist', 'submittedBy',
          [sequelize.fn('COUNT', sequelize.col('votes.id')), 'voteCount']
        ],
        group: ['Song.id', 'submitter.id'],
        order: [[sequelize.fn('COUNT', sequelize.col('votes.id')), 'DESC']]
      });
    }
    
    if (!winningSong) {
      req.flash('error', 'No votes were cast in this round');
      return res.redirect(`/groups/${round.groupId}`);
    }
    
    // Update round with winner info
    round.status = 'finished';
    round.winnerId = winningSong.submittedBy;
    round.winningSongId = winningSong.id;
    await round.save();
    
    // Update user score
    const [userScore, created] = await UserScore.findOrCreate({
      where: {
        userId: winningSong.submittedBy,
        groupId: round.groupId
      },
      defaults: {
        score: 1,
        roundsWon: 1
      }
    });
    
    if (!created) {
      userScore.score += 1;
      userScore.roundsWon += 1;
      await userScore.save();
    }
    
    req.flash('success', 'Voting has been finalized!');
    res.redirect(`/groups/${round.groupId}`);
  } catch (error) {
    console.error('Error finalizing voting:', error);
    res.status(500).render('error', { message: 'Error finalizing voting' });
  }
};

exports.getSongDetail = async (req, res) => {
  try {
    const songId = req.params.id;
    
    if (!songId || isNaN(parseInt(songId))) {
      return res.status(400).render('error', { message: 'Invalid song ID' });
    }
    
    const song = await Song.findByPk(songId, {
      include: [
        { model: User, as: 'submitter' },
        { 
          model: Group, 
          as: 'group',
          attributes: ['id', 'name', 'votingMethod', 'theme']
        }  
      ]
    });
    
    if (!song) {
      return res.status(404).render('error', { message: 'Song not found' });
    }
    
    const group = await Group.findByPk(song.groupId);
    if (!group) {
      return res.status(404).render('error', { message: 'Group not found' });
    }
    
    song.votingMethod = group.votingMethod;
    
    let youtubeVideoId = 'dQw4w9WgXcQ';
    if (song.youtubeUrl) {
      const patterns = [
        /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/,
        /(?:youtu\.be\/)([^"&?\/\s]{11})/
      ];
      
      for (const pattern of patterns) {
        const match = song.youtubeUrl.match(pattern);
        if (match && match[1]) {
          youtubeVideoId = match[1];
          break;
        }
      }
    }
    
    const userId = req.user ? req.user.id : null;
    const canVote = userId && (song.submittedBy !== userId);
    
    let userVote = null;
    if (userId) {
      userVote = await Vote.findOne({
        where: {
          songId: song.id,
          userId: userId
        }
      });
      console.log('User vote found:', userVote ? userVote.get({ plain: true }) : 'No vote');
    }
    
    let phase = 'voting';
    if (song.group) {  
      const now = new Date();
      const group = song.group;  
      
      if (group.inputOpenTime && group.inputCloseTime) {
        const inputOpenTime = new Date(group.inputOpenTime);
        const inputCloseTime = new Date(group.inputCloseTime);
        
        if (now < inputOpenTime) {
          phase = 'pending';
        } else if (now >= inputOpenTime && now < inputCloseTime) {
          phase = 'input';
        } else if (group.votingOpenTime && group.votingCloseTime) {
          const votingOpenTime = new Date(group.votingOpenTime);
          const votingCloseTime = new Date(group.votingCloseTime);
          
          if (now >= votingOpenTime && now < votingCloseTime) {
            phase = 'voting';
          } else if (now >= votingCloseTime) {
            phase = 'closed';
          }
        }
      }
    }
    
    const availableRanks = [1, 2, 3];

    // Mark this song as viewed if the user is logged in
    if (req.user) {
      // Use a cookie to track song views (simpler than creating a new DB table)
      const viewedSongs = req.cookies.viewedSongs ? JSON.parse(req.cookies.viewedSongs) : [];
      
      if (!viewedSongs.includes(songId)) {
        viewedSongs.push(songId);
        res.cookie('viewedSongs', JSON.stringify(viewedSongs), { 
          maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
          httpOnly: true 
        });
      }
    }
    
    res.render('song', { 
      song,
      group,
      youtubeVideoId,
      userId,
      canVote,
      userVote,
      phase,
      availableRanks
    });
  } catch (error) {
    console.error('Error getting song details:', error);
    res.render('error', { message: 'Failed to get song details' });
  }
};

exports.submitSong = async (req, res) => {
  try {
    const { title, artist, youtubeUrl } = req.body;  
    const roundId = req.params.roundId;
    const userId = req.user.id;
    
    const round = await Round.findByPk(roundId);
    if (!round) {
      return res.status(404).render('error', { message: 'Round not found' });
    }
    
    await Song.create({
      title,
      artist,
      youtubeUrl,  
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
    const songId = req.params.id;
    const userId = req.user.id;
    const { voteType, rating, returnTo } = req.body;
    
    const song = await Song.findByPk(songId, {
      include: [{ model: Group, as: 'group' }]
    });
    
    if (!song) {
      return res.status(404).render('error', { message: 'Song not found' });
    }
    
    const now = new Date();
    const group = song.group;
    
    if (!group.votingOpenTime || !group.votingCloseTime || 
        now < new Date(group.votingOpenTime) || 
        now > new Date(group.votingCloseTime)) {
      return res.status(403).render('error', { message: 'Voting is not currently open for this group' });
    }
    
    // Single vote logic
    if (group.votingMethod === 'single_vote') {
      const existingVote = await Vote.findOne({
        include: [{
          model: Song,
          as: 'song', // Add this alias
          where: { roundId: song.roundId }
        }],
        where: { userId: userId }
      });
      
      if (existingVote) {
        await existingVote.destroy();
      }
      
      await Vote.create({
        songId,
        userId,
        value: 1 
      });
    }
    // Rating vote logic
    else if (group.votingMethod === 'rating' && rating) {
      // Convert rating to number and validate
      const ratingValue = parseInt(rating);
      if (isNaN(ratingValue) || ratingValue < 1 || ratingValue > 10) {
        return res.status(400).render('error', { message: 'Invalid rating value' });
      }
      
      // Find if user already rated this song
      const existingVote = await Vote.findOne({
        where: { 
          songId: songId,
          userId: userId 
        }
      });
      
      // Update or create vote
      if (existingVote) {
        existingVote.value = ratingValue;
        await existingVote.save();
      } else {
        await Vote.create({
          songId,
          userId,
          value: ratingValue
        });
      }
    }
    
    console.log("Return to URL:", returnTo);
    const redirectUrl = returnTo ? 
      (returnTo.startsWith('/') ? returnTo : `/${returnTo}`) : 
      `/groups/${song.groupId}/voting`;
    return res.redirect(redirectUrl);
  } catch (error) {
    console.error('Error submitting vote:', error);
    res.status(500).render('error', { message: 'Error submitting vote' });
  }
};

exports.getGroupVoting = async (req, res) => {
  try {
    const groupId = req.params.groupId;
    
    const group = await Group.findByPk(groupId);
    if (!group) {
      return res.status(404).render('error', { message: 'Group not found' });
    }
    
    const currentRound = await Round.findOne({
      where: { 
        groupId,
      },
      order: [['createdAt', 'DESC']] 
    });
    
    const songs = currentRound ? await Song.findAll({
      where: { roundId: currentRound.id },
      include: [{ model: User, as: 'submitter' }]
    }) : [];
    
    // Get user votes for these songs
    const userVotes = {};
    if (req.user) {
      const votes = await Vote.findAll({
        where: {
          userId: req.user.id,
          songId: {
            [Op.in]: songs.map(song => song.id) 
          }
        }
      });
      
      votes.forEach(vote => {
        userVotes[vote.songId] = vote.value;
      });
    }
    
    // Get viewed songs from cookie
    const viewedSongs = req.cookies.viewedSongs ? JSON.parse(req.cookies.viewedSongs) : [];
    
    // Mark songs as watched/voted
    const processedSongs = songs.map(song => {
      const plainSong = song.get({ plain: true });
      plainSong.isWatched = viewedSongs.includes(song.id.toString());
      plainSong.userVote = userVotes[song.id] !== undefined ? userVotes[song.id] : null;
      return plainSong;
    });
    
    const votingMethod = group.votingMethod || 'single_vote';
    
    let phase = 'pending';
    
    const now = new Date();
    
    if (group.inputOpenTime && group.inputCloseTime) {
      const inputOpenTime = new Date(group.inputOpenTime);
      const inputCloseTime = new Date(group.inputCloseTime);
      
      if (now >= inputOpenTime && now < inputCloseTime) {
        phase = 'input';
      } else if (group.votingOpenTime && group.votingCloseTime) {
        const votingOpenTime = new Date(group.votingOpenTime);
        const votingCloseTime = new Date(group.votingCloseTime);
        
        if (now >= votingOpenTime && now < votingCloseTime) {
          phase = 'voting';
        } else if (now >= votingCloseTime) {
          phase = 'closed';
        }
      }
    }
    
    res.render('voting', { 
      group, 
      songs: processedSongs, 
      currentRound: currentRound || {},
      votingMethod,
      phase 
    });
  } catch (error) {
    console.error('Error loading voting page:', error);
    res.status(500).render('error', { message: 'Error loading voting page' });
  }
};

