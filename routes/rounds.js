const express = require('express');
const router = express.Router();
const { Round, Group, Song, Vote, User, GroupUser } = require('../models');
const { Op } = require('sequelize');
const authMiddleware = require('../middleware/authmiddleware');
const sequelize = require('../config/database');

router.get('/rounds/:roundId', authMiddleware, async (req, res) => {
    try {
        const { roundId } = req.params;
        const userId = req.user.id;

        const round = await Round.findByPk(roundId, {
            include: [
                { model: Group },
                {
                    model: Song,
                    as: 'songs',
                    include: [
                        { model: User, as: 'submitter', attributes: ['username'] },
                        { model: Vote, as: 'votes' }
                    ]
                }
            ]
        });

        if (!round) {
            return res.status(404).send('Round not found');
        }

        const isGroupMember = await GroupUser.findOne({
            where: { groupId: round.groupId, userId }
        });
        if (!isGroupMember) {
            return res.status(403).send('You are not a member of this group');
        }

        const userSubmittedSong = round.songs.find(
            song => song.submittedBy === userId
        );

        const now = new Date();
        let phase = 'pending';
        if (now >= round.inputOpen && now <= round.inputClose) {
            phase = 'input';
        } else if (now >= round.votingOpen && now <= round.votingClose) {
            phase = 'voting';
        } else if (now > round.votingClose) {
            phase = 'finished';
        }

        let songsWithVotes = [];
        if (phase === 'voting' || phase === 'finished') {
            songsWithVotes = await Song.findAll({
                where: { roundId },
                include: [
                    { model: User, as: 'submitter', attributes: ['username'] },
                    { model: Vote, as: 'votes' }
                ],
                attributes: [
                    'id',
                    'title',
                    'artist',
                    'submittedBy',
                    'createdAt',
                    [sequelize.fn('COUNT', sequelize.col('votes.id')), 'voteCount'],
                    [
                        sequelize.literal(
                            `EXISTS(SELECT 1 FROM "Votes" WHERE "Votes"."songId" = "Song"."id" AND "Votes"."userId" = ${userId})`
                        ),
                        'userHasVoted'
                    ]
                ],
                group: ['Song.id', 'submitter.id', 'votes.id'],
                order: [[sequelize.fn('COUNT', sequelize.col('votes.id')), 'DESC']]
            });
        }

        res.render('round', {
            round,
            phase,
            userSubmittedSong,
            userId,
            songsWithVotes: songsWithVotes.map(song => song.get({ plain: true }))
        });
    } catch (err) {
        console.error(err);
        res.status(500).send('Error loading round');
    }
});

router.post('/rounds/:roundId/songs', authMiddleware, async (req, res) => {
    try {
        const { roundId } = req.params;
        const userId = req.user.id;
        const now = new Date();

        const round = await Round.findByPk(roundId, { include: [Group] });
        if (!round) {
            return res.status(404).send('Round not found');
        }

        if (now < round.inputOpen || now > round.inputClose) {
            return res.status(400).send('It is not the input period for this round.');
        }

        if (round.status !== 'input') {
            return res.status(400).send(
                'Song submission is not currently open for this round.'
            );
        }

        const existingSong = await Song.findOne({
            where: { roundId, submittedBy: userId }
        });
        if (existingSong) {
            return res.status(400).send('You have already added a song this round.');
        }

        const { title, artist } = req.body;
        await Song.create({
            title,
            artist,
            roundId,
            groupId: round.groupId,
            submittedBy: userId
        });

        res.redirect(`/rounds/${roundId}`);
    } catch (err) {
        console.error(err);
        res.status(500).send('Error adding song');
    }
});

router.post('/groups/:id/rounds', authMiddleware, async (req, res) => {
    try {
        const groupId = req.params.id;
        const userId = req.user.id;
        
        const group = await Group.findByPk(groupId, {
            include: [{ model: User, as: 'creator' }]
        });
        
        if (!group) {
            return res.status(404).render('error', { message: 'Group not found' });
        }
        
        if (group.created_by !== userId) {
            const isAdmin = await GroupUser.findOne({ 
                where: { groupId, userId, role: 'admin' } 
            });
            
            if (!isAdmin) {
                return res.status(403).render('error', { message: 'You must be an admin to create new rounds' });
            }
        }
        
        const latestRound = await Round.findOne({
            where: { groupId },
            order: [['roundNumber', 'DESC']]
        });
        
        const newRoundNumber = latestRound ? latestRound.roundNumber + 1 : 1;
        
        let startDate;
        if (req.body.startDate) {
            startDate = new Date(req.body.startDate);
        } else {
            startDate = new Date();
            startDate.setDate(startDate.getDate() + 1);
        }
        
        const inputOpenHour = parseInt(group.inputOpenTime.split(':')[0]);
        const inputOpenMin = parseInt(group.inputOpenTime.split(':')[1]);
        
        const votingOpenHour = parseInt(group.votingOpenTime.split(':')[0]);
        const votingOpenMin = parseInt(group.votingOpenTime.split(':')[1]);
        
        const votingCloseHour = parseInt(group.votingCloseTime.split(':')[0]);
        const votingCloseMin = parseInt(group.votingCloseTime.split(':')[1]);
        
        const inputOpen = new Date(startDate);
        inputOpen.setHours(inputOpenHour, inputOpenMin, 0, 0);
        
        const votingOpen = new Date(startDate);
        votingOpen.setHours(votingOpenHour, votingOpenMin, 0, 0);
        
        const votingClose = new Date(startDate);
        votingClose.setHours(votingCloseHour, votingCloseMin, 0, 0);
        
        if (votingClose < votingOpen) {
            votingClose.setDate(votingClose.getDate() + 1);
        }
        
        const now = new Date();
        let initialStatus = 'pending';
        
        if (now >= inputOpen && now < votingOpen) {
            initialStatus = 'input';
        } else if (now >= votingOpen && now < votingClose) {
            initialStatus = 'voting';
        }
        
        await Round.create({
            groupId,
            roundNumber: newRoundNumber,
            inputOpen,
            inputClose: votingOpen,
            votingOpen,
            votingClose,
            theme: group.theme,
            status: initialStatus
        });
        
        req.flash('success', `Round #${newRoundNumber} created successfully!`);
        res.redirect(`/groups/${groupId}`);
    } catch (error) {
        console.error('Error creating round:', error);
        res.status(500).render('error', { message: 'Error creating round' });
    }
});

router.post('/rounds/:id/theme', authMiddleware, async (req, res) => {
    try {
        const roundId = req.params.id;
        const userId = req.user.id;
        const { theme } = req.body;
        
        
        const round = await Round.findByPk(roundId, {
            include: [{ model: Group, as: 'group' }]
        });
        
        if (!round) {
            return res.status(404).render('error', { message: 'Round not found' });
        }
        
        if (round.winnerId !== userId) {
            return res.status(403).render('error', { message: 'Only the round winner can set the theme' });
        }
        
        if (round.nextThemeSelected) {
            return res.status(400).render('error', { message: 'Theme has already been set' });
        }
        
        const group = round.group;
        group.theme = theme;
        await group.save();
        
        round.nextThemeSelected = true;
        await round.save();
        
        req.flash('success', 'You have set the theme for the next round!');
        res.redirect(`/groups/${round.groupId}`);
    } catch (error) {
        console.error('Error setting round theme:', error);
        res.status(500).render('error', { message: 'Error setting round theme' });
    }
});

router.post('/rounds/:id/update-times', authMiddleware, async (req, res) => {
  try {
    const isJson = req.get('Content-Type') === 'application/json';
    
    const roundId = req.params.id;
    const { inputOpen, inputClose, votingClose, groupId } = req.body;
    const userId = req.user.id;
    
    const round = await Round.findByPk(roundId, {
      include: [{ model: Group, as: 'group' }]
    });
    
    if (!round) {
      console.error('Round not found:', roundId);
      if (isJson) {
        return res.status(404).json({ error: 'Round not found' });
      } else {
        req.flash('error', 'Round not found');
        return res.redirect('/groups');
      }
    }
    
    
    const isAdmin = await GroupUser.findOne({
      where: {
        groupId: round.groupId,
        userId,
        role: 'admin'
      }
    });
    
    if (!isAdmin && round.group.created_by !== userId) {
      console.error('User not admin:', userId);
      if (isJson) {
        return res.status(403).json({ error: 'You must be an admin to update round times' });
      } else {
        req.flash('error', 'You must be an admin to update round times');
        return res.redirect(`/groups/${round.groupId}`);
      }
    }
    
    const inputOpenDate = new Date(inputOpen);
    const inputCloseDate = new Date(inputClose);
    const votingOpenDate = new Date(inputClose); 
    const votingCloseDate = new Date(votingClose);
    
   
    
    if (inputOpenDate >= inputCloseDate) {
      if (isJson) {
        return res.status(400).json({ error: 'Song submission open time must be before close time' });
      } else {
        req.flash('error', 'Song submission open time must be before close time');
        return res.redirect(`/groups/${round.groupId}/admin`);
      }
    }
    
    if (votingOpenDate >= votingCloseDate) {
      if (isJson) {
        return res.status(400).json({ error: 'Voting open time must be before close time' });
      } else {
        req.flash('error', 'Voting open time must be before close time');
        return res.redirect(`/groups/${round.groupId}/admin`);
      }
    }
    
    round.inputOpen = inputOpenDate;
    round.inputClose = inputCloseDate;
    round.votingOpen = votingOpenDate; 
    round.votingClose = votingCloseDate;
    
    const now = new Date();
    
    if (now < inputOpenDate) {
      round.status = 'pending';
    } else if (now >= inputOpenDate && now < votingOpenDate) {
      round.status = 'input';
    } else if (now >= votingOpenDate && now < votingCloseDate) {
      round.status = 'voting';
    } else if (now >= votingCloseDate && round.status !== 'finished') {
      round.status = 'finished';
    }
    
    await round.save();
    
    if (isJson) {
      return res.json({ success: 'Round times updated successfully' });
    } else {
      req.flash('success', 'Round times updated successfully');
      return res.redirect(`/groups/${round.groupId}/admin`);
    }
  } catch (error) {
    console.error('Error updating round times:', error);
    
    if (req.get('Content-Type') === 'application/json') {
      return res.status(500).json({ error: 'Error updating round times: ' + error.message });
    } else {
      req.flash('error', 'Error updating round times: ' + error.message);
      return res.redirect(`/groups/${req.body.groupId || ''}/admin`);
    }
  }
});


router.post('/rounds/:id/finalize', authMiddleware, async (req, res) => {
  try {
    const roundId = req.params.id;
    
    const round = await Round.findByPk(roundId, {
      include: [{ model: Group, as: 'group' }]
    });
    
    if (!round) {
      req.flash('error', 'Round not found');
      return res.redirect('/groups');
    }
    
    
    if (round.status === 'finished' && round.winnerId && round.winningSongId) {
      return res.redirect(`/groups/${round.groupId}`);
    }
    
    const songsWithVotes = await Song.findAll({
      where: { roundId },
      include: [
        { model: User, as: 'submitter' },
        { model: Vote, as: 'votes' }
      ]
    });
    
    let maxVotes = 0;
    let winningSong = null;
    
    songsWithVotes.forEach(song => {
      const voteCount = song.votes ? song.votes.length : 0;
      if (voteCount > maxVotes) {
        maxVotes = voteCount;
        winningSong = song;
      }
    });
    
    if (winningSong && maxVotes > 0) {
      round.status = 'finished';
      round.winnerId = winningSong.submittedBy;
      round.winningSongId = winningSong.id;
      await round.save();
      
      await sequelize.query(`
        INSERT INTO "UserScores" ("userId", "groupId", "score", "roundsWon", "createdAt", "updatedAt")
        VALUES (:userId, :groupId, 1, 1, NOW(), NOW())
        ON CONFLICT ("userId", "groupId") 
        DO UPDATE SET 
          "score" = "UserScores"."score" + 1,
          "roundsWon" = "UserScores"."roundsWon" + 1,
          "updatedAt" = NOW()
      `, {
        replacements: { 
          userId: winningSong.submittedBy, 
          groupId: round.groupId 
        }
      });
      
      req.flash('success', 'Niðurstöður eru tilbúnar! Sigurvegari hefur verið krýndur.');
    } else {
      round.status = 'finished';
      await round.save();
      req.flash('info', 'Umferð lokið, en engin atkvæði voru greidd.');
    }
    
    return res.redirect(`/groups/${round.groupId}`);
  } catch (error) {
    console.error('Error showing results:', error);
    req.flash('error', 'Villa kom upp við að sýna niðurstöður');
    return res.redirect('/groups');
  }
});

router.get('/rounds/:roundId/finalize-voting', authMiddleware, async (req, res) => {
  try {
    const roundId = req.params.roundId;
    
    const songController = require('../controllers/songController');
    
    req.params.roundId = roundId;
    await songController.finalizeVoting(req, res);
  } catch (error) {
    console.error('Error redirecting to finalize voting:', error);
    res.status(500).render('error', { message: 'Error finalizing voting' });
  }
});

module.exports = router;
