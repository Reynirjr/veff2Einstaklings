const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const bcrypt = require('bcrypt');
const { Op } = require('sequelize');

const sequelize = require('../config/database');
const authMiddleware = require('../middleware/authmiddleware'); 
const { Group, User, GroupUser, Song, Vote, Round, UserScore } = require('../models');
const { getNextVotingDate } = require('../utils/dateUtils');
const { getImagePositionStyle } = require('../utils/imageHelpers');

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
      userId,
      page: 'groups'
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
      inputClose: votingStart,
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

router.get('/groups/:id', async (req, res) => {
  try {
    const groupId = req.params.id;
    const userId = req.user.id;

    const now = new Date();
    const expiredRound = await Round.findOne({
      where: {
        groupId: groupId,
        status: 'voting',
        votingClose: {
          [Op.lt]: now
        }
      },
      include: [{ model: Group, as: 'group' }]
    });
    
    if (expiredRound && !req.query.finalized) {
      const { finalizeRound } = require('../utils/roundStatus');
      await finalizeRound(expiredRound);
      return res.redirect(`/groups/${groupId}?finalized=true`);
    }

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
            },
            {
              model: User,
              as: 'winner',
              required: false
            },
            {
              model: Song,
              as: 'winningSong',
              required: false,
              include: [
                { model: User, as: 'submitter', attributes: ['username'] }
              ]
            }
          ]
        }
      ]
    });

    if (!group) {
      return res.status(404).send('Group not found');
    }

    const isMember = group.members.some(member => member.id === userId);
    
    if (group.passwordHash && !isMember) {
      return res.render('groupJoin', { 
        group: {
          id: group.id,
          name: group.name,
          creatorName: group.creator ? group.creator.username : 'Unknown'
        },
        successMessage: req.flash('success'),
        errorMessage: req.flash('error')
      });
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
          const songs = await Song.findAll({
            where: { roundId: currentRound.id },
            include: [
              { model: User, as: 'submitter', attributes: ['username'] },
              { model: Vote, as: 'votes' }
            ]
          });
          
          songsWithVotes = songs.map(song => {
            const plainSong = typeof song.get === 'function' ? song.get({ plain: true }) : song;
            plainSong.voteCount = plainSong.votes ? plainSong.votes.length : 0;
            return plainSong;
          });
          
          songsWithVotes.sort((a, b) => b.voteCount - a.voteCount);
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

    const votingDay = group.votingDay;
    const votingStartDate = getNextVotingDate(votingDay, group.votingOpenTime);
    const votingEndDate = new Date(votingStartDate);
    
    const closeTime = group.votingCloseTime.substring(0, 5); 
    const [closeHour, closeMin] = closeTime.split(':').map(Number);
    votingEndDate.setHours(closeHour, closeMin, 0, 0);
    
    if (votingEndDate < votingStartDate) {
      votingEndDate.setDate(votingEndDate.getDate() + 1);
    }

    const leaderboard = await sequelize.query(`
      SELECT u.id as "userId", u.username, u."profilePicture", u."profilePicturePosition", 
             COALESCE(us."roundsWon", 0) as "roundsWon"
      FROM "Users" u
      JOIN "GroupUsers" gu ON u.id = gu."userId"
      LEFT JOIN "UserScores" us ON u.id = us."userId" AND gu."groupId" = us."groupId"
      WHERE gu."groupId" = :groupId
      ORDER BY COALESCE(us."roundsWon", 0) DESC
    `, {
      replacements: { groupId },
      type: sequelize.QueryTypes.SELECT
    });

    let nextRound = null;
    if (currentRound && currentRound.status === 'finished') {
      nextRound = await Round.findOne({
        where: {
          groupId: groupId,
          status: 'pending',
          roundNumber: currentRound.roundNumber + 1
        },
        order: [['inputOpen', 'ASC']]
      });
    }

    let isWinner = false;
    let winningRound = null;
    let nextThemeSelected = false;

    if (currentRound && currentRound.winnerId === userId) {
      isWinner = true;
      winningRound = currentRound;
      nextThemeSelected = !!currentRound.nextThemeSelected;
    }
    
    const { formatDateWithMilitaryTime, formatDateTimeRange } = require('../utils/formatters');

    res.render('group', { 
      group, 
      isMember, 
      userId,
      isAdmin: !!isAdmin,
      currentRound,
      phase,
      userSubmittedSong,
      rounds: group.rounds || [],
      songsWithVotes,
      successMessage: req.flash('success'),
      errorMessage: req.flash('error'),
      votingStart: votingStartDate.getTime(),
      votingEnd: votingEndDate.getTime(),
      isWinner,
      winningRound,
      nextThemeSelected,
      leaderboard,
      nextRound,
      formatDateWithMilitaryTime,
      formatDateTimeRange,
      page: 'group',
      getImagePositionStyle
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
    
    await sequelize.query(`
      DELETE FROM "WinnerThemeSelections"
      WHERE "roundId" IN (SELECT id FROM "Rounds" WHERE "groupId" = :groupId)
    `, {
      replacements: { groupId }
    });
    
    await sequelize.query(`
      DELETE FROM "Votes"
      WHERE "songId" IN (SELECT id FROM "Songs" WHERE "groupId" = :groupId)
    `, {
      replacements: { groupId }
    });
    
    await sequelize.query(`
      UPDATE "Rounds" 
      SET "winningSongId" = NULL, "winnerId" = NULL
      WHERE "groupId" = :groupId
    `, {
      replacements: { groupId }
    });
    
    await UserScore.destroy({ where: { groupId } });
    
    await Song.destroy({ where: { groupId } });
    
    await Round.destroy({ where: { groupId } });
    
    await GroupUser.destroy({ where: { groupId } });
    
    await group.destroy();
    
    req.flash('success', 'Group deleted successfully');
    res.redirect('/groups');
  } catch (err) {
    console.error('Error deleting group:', err);
    req.flash('error', 'Error deleting group. Please try again.');
    res.redirect(`/groups/${req.params.id}`);
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

router.get('/groups/:id/admin', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const groupId = req.params.id;
    const userId = req.user.id;
    
    const group = await Group.findByPk(groupId, {
      include: [
        { model: User, as: 'creator' },
        { 
          model: User, 
          as: 'members',
          through: { attributes: ['role'] }
        },
        {
          model: Round,
          as: 'rounds',
          order: [['roundNumber', 'DESC']]
        }
      ]
    });
    
    if (!group) {
      return res.status(404).render('error', { message: 'Group not found' });
    }
    
    res.render('groupAdmin', { 
      group,
      userId,
      rounds: group.rounds || [],
      successMessage: req.flash('success'),
      errorMessage: req.flash('error'),
      page: 'admin'
    });
  } catch (err) {
    console.error('Error loading admin panel:', err);
    res.status(500).render('error', { message: 'Error loading admin panel' });
  }
});

router.post('/groups/:id/settings', authMiddleware, adminMiddleware, async (req, res) => {
  req.flash('info', 'Group settings updates are currently disabled');
  return res.redirect(`/groups/${req.params.id}/admin`);
});

router.post('/groups/:id/members/:userId/remove', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { id: groupId, userId: targetUserId } = req.params;
    const adminId = req.user.id;
    
    if (parseInt(targetUserId) === adminId) {
      req.flash('error', 'You cannot remove yourself from the group');
      return res.redirect(`/groups/${groupId}/admin`);
    }
    
    const group = await Group.findByPk(groupId);
    if (parseInt(targetUserId) === group.created_by) {
      req.flash('error', 'You cannot remove the group creator');
      return res.redirect(`/groups/${groupId}/admin`);
    }
    
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

router.post('/groups/:id/theme', authMiddleware, async (req, res) => {
  try {
    const groupId = req.params.id;
    const userId = req.user.id;
    const { roundId, themeOption, theme } = req.body;
    
    const round = await Round.findByPk(roundId);
    if (!round) {
      return res.redirect(`/groups/${groupId}`);
    }
    
    if (parseInt(round.winnerId) !== parseInt(userId)) {
      return res.redirect(`/groups/${groupId}`);
    }
    
    let newTheme = theme;
    if (themeOption === 'random') {
      const themes = [
        'Pop Classics', '80s Hits', '90s Nostalgia', 'Rock Anthems', 
        'Hip Hop Classics', 'Electronic Dance', 'Jazz Standards',
        'Country Classics', 'Indie Gems', 'Movie Soundtracks',
        'One-Hit Wonders', 'Eurovision', 'Folk Music', 'Blues',
        'Reggae Vibes', 'Latin Beats', 'K-pop', 'Classical Masterpieces'
      ];
      newTheme = themes[Math.floor(Math.random() * themes.length)];
    }
    
    await sequelize.query(`
      UPDATE "Rounds"
      SET "nextThemeSelected" = true,
          "updatedAt" = NOW()
      WHERE "id" = :roundId
    `, {
      replacements: { roundId }
    });
    
    
    await Group.update(
      { theme: newTheme },
      { where: { id: groupId } }
    );
    
    req.flash('success', `Þema næstu umferðar verður: ${newTheme}`);
    return res.redirect(`/groups/${groupId}`);
  } catch (err) {
    console.error('Error setting theme:', err);
    req.flash('error', 'Error setting theme');
    return res.redirect(`/groups/${req.params.id}`);
  }
});

router.post('/groups/:id/debug/force-win', authMiddleware, async (req, res) => {
  try {
    const groupId = req.params.id;
    const userId = req.user.id;
    
    const isAdmin = await GroupUser.findOne({
      where: { 
        groupId,
        userId, 
        role: 'admin'
      }
    });
    
    if (!isAdmin) {
      req.flash('error', 'Admin access required');
      return res.redirect(`/groups/${groupId}`);
    }
    
    const round = await Round.findOne({
      where: { 
        groupId,
        status: 'finished'
      },
      order: [['createdAt', 'DESC']]
    });
    
    if (!round) {
      req.flash('error', 'No finished round found to repair');
      return res.redirect(`/groups/${groupId}`);
    }
        
    const songs = await Song.findAll({
      where: { roundId: round.id },
      include: [
        { model: User, as: 'submitter' },
        { model: Vote, as: 'votes' }
      ]
    });
    
    let maxVotes = -1;
    let winningSong = null;
    
    songs.forEach(song => {
      const voteCount = song.votes ? song.votes.length : 0;
      console.log(`Song ${song.id} "${song.title}" has ${voteCount} votes`);
      
      if (voteCount > maxVotes) {
        maxVotes = voteCount;
        winningSong = song;
      }
    });
    
    if (!winningSong) {
      req.flash('error', 'No songs found for this round');
      return res.redirect(`/groups/${groupId}`);
    }
    
    console.log(`Winner identified: Song ${winningSong.id} "${winningSong.title}" with ${maxVotes} votes`);
    
    await sequelize.query(`
      UPDATE "Rounds"
      SET "winnerId" = :winnerId,
          "winningSongId" = :winningSongId,
          "nextThemeSelected" = false,
          "updatedAt" = NOW()
      WHERE "id" = :roundId
    `, {
      replacements: { 
        roundId: round.id,
        winnerId: winningSong.submittedBy,
        winningSongId: winningSong.id
      }
    });
    
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
        groupId: groupId 
      }
    });
    
    const [scores] = await sequelize.query(`
      SELECT * FROM "UserScores" WHERE "userId" = :userId AND "groupId" = :groupId
    `, {
      replacements: {
        userId: winningSong.submittedBy,
        groupId
      }
    });
    
    
    req.flash('success', 'Winner updated successfully!');
    return res.redirect(`/groups/${groupId}`);
  } catch (error) {
    console.error('Error fixing round:', error);
    req.flash('error', 'Server error while fixing round');
    return res.redirect(`/groups/${req.params.id}`);
  }
});

router.get('/groups/:id/countdown', authMiddleware, async (req, res) => {
  try {
    const groupId = req.params.id;
    const group = await Group.findByPk(groupId);
    
    if (!group) {
      return res.status(404).json({ error: 'Group not found' });
    }
    
    const currentRound = await Round.findOne({
      where: { groupId },
      order: [['roundNumber', 'DESC']]
    });
    
    const votingDay = group.votingDay;
    const nextVotingDate = getNextVotingDate(votingDay, group.votingOpenTime);
    
    const result = {
      votingDay: group.votingDay,
      inputOpenTime: group.inputOpenTime,
      votingOpenTime: group.votingOpenTime,
      votingCloseTime: group.votingCloseTime,
      
      nextVotingDate: nextVotingDate.toISOString(),
      
      currentRound: currentRound ? {
        id: currentRound.id,
        status: currentRound.status,
        roundNumber: currentRound.roundNumber,
        inputOpen: currentRound.inputOpen,
        inputClose: currentRound.inputClose,
        votingOpen: currentRound.votingOpen,
        votingClose: currentRound.votingClose
      } : null
    };
    
    if (currentRound) {
      result.nextInputOpen = currentRound.inputOpen;
      result.nextVotingOpen = currentRound.votingOpen;
      result.votingEnd = currentRound.votingClose;
    } else {
      const nextInputOpen = new Date(nextVotingDate);
      const nextVotingOpen = new Date(nextVotingDate);
      const nextVotingClose = new Date(nextVotingDate);
      
      const [inputOpenHour, inputOpenMin] = group.inputOpenTime.split(':').map(Number);
      const [votingOpenHour, votingOpenMin] = group.votingOpenTime.split(':').map(Number);
      const [votingCloseHour, votingCloseMin] = group.votingCloseTime.split(':').map(Number);
      
      nextInputOpen.setHours(inputOpenHour, inputOpenMin, 0, 0);
      nextVotingOpen.setHours(votingOpenHour, votingOpenMin, 0, 0);
      nextVotingClose.setHours(votingCloseHour, votingCloseMin, 0, 0);
      
      result.nextInputOpen = nextInputOpen.toISOString();
      result.nextVotingOpen = nextVotingOpen.toISOString();
      result.votingEnd = nextVotingClose.toISOString();
    }
    
    res.json(result);
  } catch (err) {
    console.error('Error getting countdown info:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/groups/:id/finalize-winner', authMiddleware, async (req, res) => {
  try {
    const groupId = req.params.id;
    const { songId, userId, roundId } = req.body;
    
    console.log(`Sigurlag songId: ${songId}, userId: ${userId}`);
    
    await sequelize.query(`
      UPDATE "Rounds"
      SET "winnerId" = :userId,
          "winningSongId" = :songId,
          "nextThemeSelected" = false,
          "updatedAt" = NOW()
      WHERE "id" = :roundId
    `, {
      replacements: { 
        roundId,
        userId,
        songId
      }
    });
    
    await sequelize.query(`
      DELETE FROM "UserScores"
      WHERE "userId" = :userId AND "groupId" = :groupId
    `, {
      replacements: {
        userId,
        groupId
      }
    });
    
    await sequelize.query(`
      INSERT INTO "UserScores" ("userId", "groupId", "score", "roundsWon", "createdAt", "updatedAt")
      VALUES (:userId, :groupId, 1, 1, NOW(), NOW())
    `, {
      replacements: {
        userId,
        groupId
      }
    });
    
    const [scores] = await sequelize.query(`
      SELECT * FROM "UserScores" WHERE "userId" = :userId AND "groupId" = :groupId
    `, {
      replacements: {
        userId,
        groupId
      }
    });
    
    
    req.flash('success', 'Vinningshafi hefur verið uppfærður!');
    return res.redirect(`/groups/${groupId}`);
  } catch (error) {
    console.error('Error updating winner:', error);
    req.flash('error', 'Villa kom upp við að uppfæra vinningshafa');
    return res.redirect(`/groups/${req.params.id}`);
  }
});

router.post('/groups/:id/rounds', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const groupId = req.params.id;
    const { roundStatus } = require('../utils/roundStatus');
    
    const group = await Group.findByPk(groupId);
    if (!group) {
      req.flash('error', 'Group not found');
      return res.redirect('/groups');
    }
    
    await roundStatus.createFirstRound(group);
    
    req.flash('success', 'New round scheduled successfully');
    return res.redirect(`/groups/${groupId}`);
  } catch (err) {
    console.error('Error creating round:', err);
    req.flash('error', 'Error creating round');
    return res.redirect(`/groups/${req.params.id}`);
  }
});

module.exports = router;
