const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const bcrypt = require('bcrypt');
const { Op } = require('sequelize');

const sequelize = require('../config/database');
const authMiddleware = require('../middleware/authmiddleware'); 
const { Group, User, GroupUser, Song, Vote, Round } = require('../models');
const { getNextVotingDate } = require('../utils/dateUtils');

const createGroupLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, 
  max: 5, 
  message: 'Too many group creation attempts. Please try again later.',
});

router.get('/groups', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    
    const groups = await Group.findAll({
      include: [
        { model: User, as: 'creator' },
        { 
          model: User, 
          as: 'members',
          attributes: ['id'],  
        }
      ],
      order: [['createdAt', 'DESC']] 
    });
    
    const processedGroups = groups.map(group => {
      const plainGroup = group.get({ plain: true });
      plainGroup.isMember = plainGroup.members.some(member => member.id === userId);
      return plainGroup;
    });
    
    res.render('groups', { 
      groups: processedGroups,
      userId 
    });
  } catch (err) {
    console.error('Error fetching groups:', err);
    res.status(500).send('Error loading groups');
  }
});

router.get('/groups/create', authMiddleware, (req, res) => {
  res.render('createGroup'); 
});

router.post('/groups', authMiddleware, createGroupLimiter, async (req, res) => {
  try {
    const userId = req.user.id;
    const groupCount = await Group.count({ where: { created_by: userId } });
    if (groupCount >= 5) {
      return res.status(400).send('You already have 5 active groups.');
    }

    const {
      name,
      description,
      roundDate,
      inputOpenTime,
      votingOpenTime,
      votingCloseTime,
      votingRecurrence,
      theme,
      themeOption,
      groupPassword,
      votingMethod = 'single_vote',
    } = req.body;

    let finalTheme = theme;
    if (themeOption === 'random') {
      const randomThemes = [
        'Rokk Klassík',
        '80\'s Popp', 
        'Hip-Hop Smellir', 
        'Suður amerísk Tónlist', 
        'Eurovision',
        'Íslensk Tónlist',
        'Kvikmyndatónlist',
        'Jólatónlist',
        'Sumarsmellir',
        'Country Classics',
        'Rock Legends',
        'Indie Gems'
      ];
      finalTheme = randomThemes[Math.floor(Math.random() * randomThemes.length)];
    }

    let passwordHash = null;
    if (groupPassword && groupPassword.trim() !== '') {
      const salt = await bcrypt.genSalt(10);
      passwordHash = await bcrypt.hash(groupPassword, salt);
    }

    const group = await Group.create({
      name,
      description,
      created_by: userId,
      votingDay: new Date(roundDate).toLocaleString('en-us', {weekday: 'long'}).toLowerCase(),
      inputOpenTime,
      votingOpenTime,
      votingCloseTime,
      votingRecurrence,
      theme: finalTheme,
      passwordHash,
      votingMethod,
    });

    await GroupUser.create({
      groupId: group.id,
      userId: userId,
      role: 'admin'
    });

    const inputStart = new Date(roundDate);
    const votingStart = new Date(roundDate);
    const votingEnd = new Date(roundDate);
    
    const [inputOpenHour, inputOpenMin] = inputOpenTime.split(':').map(Number);
    const [votingOpenHour, votingOpenMin] = votingOpenTime.split(':').map(Number);
    const [votingCloseHour, votingCloseMin] = votingCloseTime.split(':').map(Number);
    
    inputStart.setHours(inputOpenHour, inputOpenMin, 0, 0);
    votingStart.setHours(votingOpenHour, votingOpenMin, 0, 0);
    votingEnd.setHours(votingCloseHour, votingCloseMin, 0, 0);
    
    const now = new Date();
    let initialStatus = 'pending';
    if (now >= inputStart && now < votingStart) {
      initialStatus = 'input';
    } else if (now >= votingStart && now < votingEnd) {
      initialStatus = 'voting';
    }
    
    const round = await Round.create({
      groupId: group.id,
      roundNumber: 1,
      inputOpen: inputStart,
      inputClose: votingStart, // Song submission closes when voting opens
      votingOpen: votingStart,
      votingClose: votingEnd,
      theme: finalTheme,
      status: initialStatus
    });

    req.flash('success', 'Group created successfully! You can now add songs or invite members.');
    return res.redirect(`/groups/${group.id}`);
  } catch (err) {
    console.error(err);
    return res.status(500).send('Error creating group');
  }
});

router.get('/groups/:id', authMiddleware, async (req, res) => {
  try {
    const groupId = req.params.id;
    const userId = req.user.id;

    const group = await Group.findByPk(groupId, {
      include: [
        { model: User, as: 'creator' },
        { model: User, as: 'members' },
        { 
          model: Round, 
          as: 'rounds',
          include: [
            {
              model: Song,
              as: 'songs',
              include: [
                { model: User, as: 'submitter', attributes: ['username'] },
                { model: Vote, as: 'votes' }
              ]
            }
          ]
        }
      ]
    });

    if (!group) {
      return res.status(404).send('Group not found');
    }

    let currentRound = null;
    let phase = null;
    let userSubmittedSong = null;
    let songsWithVotes = [];
    
    if (group.rounds && group.rounds.length > 0) {
      group.rounds.sort((a, b) => b.roundNumber - a.roundNumber);
      currentRound = group.rounds[0];
      
      const now = new Date();
      if (now < currentRound.inputOpen) {
        phase = 'pending';
      } else if (now >= currentRound.inputOpen && now <= currentRound.inputClose) {
        phase = 'input';
      } else if (now >= currentRound.votingOpen && now <= currentRound.votingClose) {
        phase = 'voting';
      } else {
        phase = 'finished';
      }
      
      if (currentRound.songs && currentRound.songs.length > 0) {
        userSubmittedSong = currentRound.songs.find(song => song.submittedBy === userId);
        
        if (phase === 'voting' || phase === 'finished') {
          songsWithVotes = await Song.findAll({
            where: { roundId: currentRound.id },
            include: [
              { model: User, as: 'submitter', attributes: ['username'] },
              { model: Vote, as: 'votes' }
            ],
            attributes: [
              'id', 'title', 'artist', 'submittedBy', 'createdAt',
              [sequelize.fn('COUNT', sequelize.col('votes.id')), 'voteCount'],
              [
                group.votingMethod === 'rating' 
                  ? sequelize.fn('AVG', sequelize.col('votes.value')) 
                  : sequelize.literal('0'),
                'averageRating'
              ],
              [sequelize.literal(`EXISTS(SELECT 1 FROM "Votes" WHERE "Votes"."songId" = "Song"."id" AND "Votes"."userId" = ${userId})`), 'userHasVoted']
            ],
            group: ['Song.id', 'submitter.id', 'votes.id'],
            order: [
              group.votingMethod === 'rating'
                ? [sequelize.literal('"averageRating"'), 'DESC'] // Add quotes to preserve case
                : [sequelize.fn('COUNT', sequelize.col('votes.id')), 'DESC']
            ]
          });
        }
      }
    }

    const isAdmin = await GroupUser.findOne({ 
      where: { 
        groupId, 
        userId, 
        role: 'admin' 
      } 
    });

    const isMember = group.members.some(member => member.id === userId);
    
    const votingDay = group.votingDay;
    const votingStartDate = getNextVotingDate(votingDay, group.votingOpenTime);
    const votingEndDate = new Date(votingStartDate);
    
    const closeTime = group.votingCloseTime.substring(0, 5); 
    const [closeHour, closeMin] = closeTime.split(':').map(Number);
    votingEndDate.setHours(closeHour, closeMin, 0, 0);
    
    if (votingEndDate < votingStartDate) {
      votingEndDate.setDate(votingEndDate.getDate() + 1);
    }
    
    res.render('group', { 
      group, 
      isMember, 
      userId,
      isAdmin: !!isAdmin,
      currentRound,
      phase,
      userSubmittedSong,
      rounds: group.rounds || [],
      songsWithVotes: songsWithVotes.map(song => song.get({ plain: true })),
      successMessage: req.flash('success'),
      errorMessage: req.flash('error'),
      votingStart: votingStartDate.getTime(),
      votingEnd: votingEndDate.getTime()
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('Error loading group');
  }
});

router.post('/groups/:id/join', authMiddleware, async (req, res) => {
  try {
    const groupId = req.params.id;
    const userId = req.user.id;

    const group = await Group.findByPk(groupId);
    if (!group) {
      return res.status(404).send('Group not found');
    }

    const memberCount = await GroupUser.count({ where: { groupId } });
    if (memberCount >= 50) {
      return res.status(400).send('This group is already at the 50 user limit.');
    }

    const alreadyMember = await GroupUser.findOne({ where: { groupId, userId } });
    if (alreadyMember) {
      return res.status(400).send('You are already a member of this group.');
    }

    if (group.passwordHash) {
      const { enteredPassword } = req.body;
      if (!enteredPassword) {
        return res.status(401).send('Password is required for this group.');
      }
      
      const isMatch = await bcrypt.compare(enteredPassword, group.passwordHash);
      if (!isMatch) {
        return res.status(401).send('Incorrect group password.');
      }
    }

    await GroupUser.create({ groupId, userId });

    res.redirect(`/groups/${groupId}`);
  } catch (err) {
    console.error(err);
    res.status(500).send('Error joining group');
  }
});

router.post('/groups/:id/songs', authMiddleware, async (req, res) => {
  try {
    const groupId = req.params.id;
    const userId = req.user.id;

    const membership = await GroupUser.findOne({ where: { groupId, userId } });
    if (!membership) {
      return res.status(403).send('YÞú ert ekki meðlimur í þessum hóp.');
    }

    const { title, artist } = req.body;
    
  
    await Song.create({
      title,
      artist,
      groupId,      
      submittedBy: userId,
    });

    res.redirect(`/groups/${groupId}`);
  } catch (err) {
    console.error(err);
    res.status(500).send('Error adding song');
  }
});

router.post('/songs/:songId/vote', authMiddleware, async (req, res) => {
  try {
    const songId = req.params.songId;
    const userId = req.user.id;
    
    const song = await Song.findByPk(songId);
    if (!song) {
      return res.status(404).send('Song not found');
    }
    
    const membership = await GroupUser.findOne({ 
      where: { 
        groupId: song.groupId, 
        userId 
      }
    });
    
    if (!membership) {
      return res.status(403).send('You are not a member of this group.');
    }

    const existingVote = await Vote.findOne({ 
      where: { 
        songId, 
        userId 
      }
    });
    
    if (existingVote) {
      await existingVote.destroy();
    } else {
      await Vote.create({ 
        songId, 
        userId, 
        value: 1 
      });
    }

    res.redirect(`/groups/${song.groupId}`);
  } catch (err) {
    console.error(err);
    res.status(500).send('Error processing vote');
  }
});

router.post('/groups/:id/delete', authMiddleware, async (req, res) => {
  try {
    const groupId = req.params.id;
    const userId = req.user.id;
    
    const group = await Group.findByPk(groupId);
    if (!group) {
      return res.status(404).send('Group not found');
    }
    
    if (group.created_by !== userId) {
      return res.status(403).send('You do not have permission to delete this group');
    }
    
    await GroupUser.destroy({ where: { groupId } });

    await group.destroy();
    
    res.redirect('/groups');
  } catch (err) {
    console.error('Error deleting group:', err);
    res.status(500).send('Error deleting group');
  }
});

module.exports = router;
