const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const bcrypt = require('bcrypt');
const { Op } = require('sequelize');

const sequelize = require('../config/database');
const authMiddleware = require('../middleware/authmiddleware'); 
const { Group, User, GroupUser, Song, Vote, Round, UserScore } = require('../models');
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
              { model: Vote, as: 'votes', attributes: [] }
            ],
            attributes: [
              'id', 'title', 'artist', 'submittedBy', 'createdAt',
              [sequelize.fn('COUNT', sequelize.col('votes.id')), 'voteCount'],
              [
                sequelize.fn('COALESCE', 
                  sequelize.fn('AVG', sequelize.col('votes.value')), 
                  0
                ), 
                'averageRating'
              ],
              [sequelize.literal(`EXISTS(SELECT 1 FROM "Votes" WHERE "Votes"."songId" = "Song"."id" AND "Votes"."userId" = ${userId})`), 'userHasVoted']
            ],
            group: ['Song.id', 'submitter.id', 'submitter.username'],
            order: [
              group.votingMethod === 'rating'
                ? [sequelize.literal('COALESCE(AVG("votes"."value"), 0) DESC')]
                : [sequelize.fn('COUNT', sequelize.col('votes.id')), 'DESC']
            ],
            subQuery: false,
            includeIgnoreAttributes: false,
            joinTableAttributes: [],
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

    let isWinner = false;
    let winningRound = null;
    let nextThemeSelected = true;
    
    if (currentRound && currentRound.status === 'finished' && currentRound.winnerId === userId) {
      isWinner = true;
      winningRound = {
        ...currentRound.get({ plain: true }),
        winningSong: await Song.findByPk(currentRound.winningSongId, { 
          attributes: ['id', 'title', 'artist'] 
        })
      };
      nextThemeSelected = currentRound.nextThemeSelected;
    }
    
    const leaderboard = await UserScore.findAll({
      where: { groupId },
      include: [{ model: User, attributes: ['username'] }],
      order: [
        ['score', 'DESC'],
        ['roundsWon', 'DESC']
      ]
    });
    
    const processedLeaderboard = leaderboard.map(entry => ({
      userId: entry.userId,
      username: entry.User.username,
      score: entry.score,
      roundsWon: entry.roundsWon
    }));
    
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
      votingEnd: votingEndDate.getTime(),
      isWinner,
      winningRound,
      nextThemeSelected,
      leaderboard: processedLeaderboard
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

const adminMiddleware = async (req, res, next) => {
  try {
    const groupId = req.params.id;
    const userId = req.user.id;
    
    const isAdmin = await GroupUser.findOne({ 
      where: { groupId, userId, role: 'admin' }
    });
    
    if (!isAdmin) {
      req.flash('error', 'You must be an admin to access this page');
      return res.redirect(`/groups/${groupId}`);
    }
    
    next();
  } catch (err) {
    console.error('Admin middleware error:', err);
    res.status(500).render('error', { message: 'Error checking admin status' });
  }
};

// Admin panel route
router.get('/groups/:id/admin', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const groupId = req.params.id;
    
    const group = await Group.findByPk(groupId, {
      include: [
        { model: User, as: 'creator' },
        { 
          model: User, 
          as: 'members',
          through: { attributes: ['role'] }
        }
      ]
    });
    
    if (!group) {
      return res.status(404).render('error', { message: 'Group not found' });
    }
    
    res.render('groupAdmin', { 
      group,
      successMessage: req.flash('success'),
      errorMessage: req.flash('error')
    });
  } catch (err) {
    console.error('Error loading admin panel:', err);
    res.status(500).render('error', { message: 'Error loading admin panel' });
  }
});

// Update group settings
router.post('/groups/:id/settings', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const groupId = req.params.id;
    const {
      name,
      description,
      theme,
      groupPassword,
      changePassword,
      votingMethod,
      votingDay,
      inputOpenTime,
      votingOpenTime,
      votingCloseTime
    } = req.body;
    
    const group = await Group.findByPk(groupId);
    if (!group) {
      return res.status(404).render('error', { message: 'Group not found' });
    }
    
    // Update basic info
    group.name = name || group.name;
    group.description = description || group.description;
    group.theme = theme || group.theme;
    group.votingMethod = votingMethod || group.votingMethod;
    
    // Update schedule if provided
    if (votingDay) group.votingDay = votingDay;
    if (inputOpenTime) group.inputOpenTime = inputOpenTime;
    if (votingOpenTime) group.votingOpenTime = votingOpenTime;
    if (votingCloseTime) group.votingCloseTime = votingCloseTime;
    
    // Update password if requested
    if (changePassword === 'true' && groupPassword) {
      const salt = await bcrypt.genSalt(10);
      group.passwordHash = await bcrypt.hash(groupPassword, salt);
    } else if (changePassword === 'remove') {
      group.passwordHash = null;
    }
    
    await group.save();
    
    req.flash('success', 'Group settings updated successfully');
    res.redirect(`/groups/${groupId}/admin`);
  } catch (err) {
    console.error('Error updating group settings:', err);
    req.flash('error', 'Error updating group settings');
    res.redirect(`/groups/${req.params.id}/admin`);
  }
});

// Remove member from group
router.post('/groups/:id/members/:userId/remove', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { id: groupId, userId: targetUserId } = req.params;
    const adminId = req.user.id;
    
    // Prevent admins from removing themselves
    if (parseInt(targetUserId) === adminId) {
      req.flash('error', 'You cannot remove yourself from the group');
      return res.redirect(`/groups/${groupId}/admin`);
    }
    
    // Check if target is group creator
    const group = await Group.findByPk(groupId);
    if (parseInt(targetUserId) === group.created_by) {
      req.flash('error', 'You cannot remove the group creator');
      return res.redirect(`/groups/${groupId}/admin`);
    }
    
    // Remove the user
    const removed = await GroupUser.destroy({ 
      where: { groupId, userId: targetUserId }
    });
    
    if (removed) {
      req.flash('success', 'Member removed successfully');
    } else {
      req.flash('error', 'Member not found');
    }
    
    res.redirect(`/groups/${groupId}/admin`);
  } catch (err) {
    console.error('Error removing member:', err);
    req.flash('error', 'Error removing member');
    res.redirect(`/groups/${req.params.id}/admin`);
  }
});

module.exports = router;
