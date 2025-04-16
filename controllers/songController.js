const { Song, User, Group, Vote, Round, UserScore, sequelize } = require('../models');
const { Op } = require('sequelize'); 

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
    
    const group = round.group;
    let winningSong;
    
    if (group.votingMethod === 'rating') {
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
    } else if (group.votingMethod === 'top_3') {
      const songs = await Song.findAll({
        where: { roundId },
        include: [
          { model: User, as: 'submitter' },
          { model: Vote, as: 'votes' }
        ]
      });
      
      let highestPoints = 0;
      let winningId = null;
      
      const songPoints = {};
      
      for (const song of songs) {
        songPoints[song.id] = {
          id: song.id,
          title: song.title,
          artist: song.artist,
          submittedBy: song.submittedBy,
          points: 0,
          votes: []
        };
        
        song.votes.forEach(vote => {
          const pointValue = 4 - vote.value; 
          songPoints[song.id].points += pointValue;
          songPoints[song.id].votes.push({
            userId: vote.userId,
            rank: vote.value,
            points: pointValue
          });
        });
        
        console.log(`Song: ${song.title} by ${song.artist} - Total points: ${songPoints[song.id].points}`);
        
        if (songPoints[song.id].points > highestPoints) {
          highestPoints = songPoints[song.id].points;
          winningId = song.id;
        }
      }
      
      console.log('Points summary:');
      Object.values(songPoints).forEach(song => {
        console.log(`${song.title}: ${song.points} points`);
      });
      
      if (winningId) {
        winningSong = await Song.findByPk(winningId, {
          include: [{ model: User, as: 'submitter' }]
        });
        
        console.log(`Winning song: ${winningSong.title} with ${highestPoints} points`);
      }
    } else {
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
        group: ['Song.id', 'Song.title', 'Song.artist', 'Song.submittedBy', 'submitter.id'],
        order: [[sequelize.fn('COUNT', sequelize.col('votes.id')), 'DESC']]
      });
    }
    
    console.log('========== FINALIZING VOTING ==========');
    console.log('Round ID:', roundId);
    console.log('Voting method:', group.votingMethod);
    console.log('Winner song data:', winningSong ? {
      id: winningSong.id,
      title: winningSong.title,
      artist: winningSong.artist,
      submittedBy: winningSong.submittedBy
    } : 'No winner found');
    
    if (!winningSong) {
      req.flash('error', 'No votes were cast in this round');
      return res.redirect(`/groups/${round.groupId}`);
    }
    
    if (winningSong) {
   
      
      round.status = 'finished';
      round.winnerId = winningSong.submittedBy;
      round.winningSongId = winningSong.id;
      await round.save();
      
      const updatedRound = await Round.findByPk(round.id);
    
      const winnerId = winningSong.submittedBy;

      try {
        const [userScore, created] = await UserScore.findOrCreate({
          where: {
            userId: winnerId,
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
          console.log(`uppfært`);
        } else {
          console.log(`uppfært`);
        }
      } catch (error) {
        console.error('naði ekki að uppfæra', error);
      }
    }
    
    req.flash('YAY, Kosningar finalized');
    res.redirect(`/groups/${round.groupId}`);
  } catch (error) {
    console.error('Error finalizing voting:', error);
    res.status(500).render('error', { message: 'Error finalizing voting' });
  }
};

exports.getSongDetail = async (req, res) => {
  try {
    const songId = req.params.id;
    const userId = req.user ? req.user.id : null;
    
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
    
    const canVote = userId && (song.submittedBy !== userId);
    
    let userVote = null;
    let availableRanks = [1, 2, 3];
    
    if (userId) {
      userVote = await Vote.findOne({
        where: {
          songId: song.id,
          userId: userId
        }
      });
      
      if (userVote) {
        userVote = userVote.value;
      }
      
      if (song.votingMethod === 'top_3') {
        const round = await Round.findOne({
          where: { id: song.roundId }
        });
        
        if (round) {
          const songsInRound = await Song.findAll({
            where: { roundId: round.id },
            attributes: ['id']
          });
          
          const userVotes = await Vote.findAll({
            where: {
              userId: userId,
              songId: {
                [Op.in]: songsInRound.map(s => s.id)
              }
            }
          });
          
          availableRanks = [1, 2, 3].filter(rank => 
            !userVotes.some(vote => 
              vote.value === rank && vote.songId !== parseInt(song.id)
            )
          );
        }
      }
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

    if (req.user) {
      const viewedSongs = req.cookies.viewedSongs ? JSON.parse(req.cookies.viewedSongs) : [];
      
      if (!viewedSongs.includes(songId)) {
        viewedSongs.push(songId);
        res.cookie('viewedSongs', JSON.stringify(viewedSongs), { 
          maxAge: 30 * 24 * 60 * 60 * 1000, 
          httpOnly: true 
        });
      }
    }
    
    const roundSongs = await Song.findAll({
      where: { 
        roundId: song.roundId,
        ...(userId ? { submittedBy: { [Op.ne]: userId } } : {})
      },
      order: [['id', 'ASC']],
      attributes: ['id', 'title']
    });
    
    const currentIndex = roundSongs.findIndex(s => s.id === song.id);
    const prevSong = currentIndex > 0 ? roundSongs[currentIndex - 1] : null;
    const nextSong = currentIndex < roundSongs.length - 1 ? roundSongs[currentIndex + 1] : null;
    
    const round = await Round.findByPk(song.roundId);
    const isVotingPhase = round && round.status === 'voting';
    
    res.render('song', { 
      song,
      group,
      youtubeVideoId,
      userId,
      canVote,
      userVote,
      phase,
      availableRanks,
      prevSong,
      nextSong,
      isVotingPhase  
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
    const { voteType, rating, rank, returnTo } = req.body;
    
    const song = await Song.findByPk(songId, {
      include: [{ model: Group, as: 'group' }]
    });
    
    if (!song) {
      return res.status(404).render('error', { message: 'Song not found' });
    }
    
    const now = new Date();
    const group = song.group;
    
    if (group.votingMethod === 'single_vote') {
      await sequelize.query(`
        DELETE FROM "Votes" 
        WHERE "userId" = :userId AND "songId" IN 
          (SELECT id FROM "Songs" WHERE "roundId" = :roundId)
      `, {
        replacements: { 
          userId, 
          roundId: song.roundId 
        }
      });
      
      await Vote.create({
        songId,
        userId,
        value: 1
      });
      
      console.log(`Vote recorded: User ${userId} voted for song ${songId}`);
    }
    
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
    const userId = req.user ? req.user.id : null;
    
    const group = await Group.findByPk(groupId);
    if (!group) {
      return res.status(404).render('error', { message: 'Group not found' });
    }
    
    const currentRound = await Round.findOne({
      where: { groupId },
      order: [['createdAt', 'DESC']] 
    });
    
    const songs = currentRound ? await Song.findAll({
      where: { 
        roundId: currentRound.id,
        ...(userId ? { submittedBy: { [Op.ne]: userId } } : {}) 
      },
      include: [{ model: User, as: 'submitter' }]
    }) : [];
    
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
    
    const viewedSongs = req.cookies.viewedSongs ? JSON.parse(req.cookies.viewedSongs) : [];
    
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

