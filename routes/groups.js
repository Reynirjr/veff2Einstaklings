const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const bcrypt = require('bcrypt');

const authMiddleware = require('../middleware/authmiddleware'); 
const { Group, User, GroupUser } = require('../models');

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
      votingDay,
      votingOpenTime,
      votingCloseTime,
      votingRecurrence,
      theme,
      themeOption,
      groupPassword,
    } = req.body;

    let finalTheme = theme;
    if (themeOption === 'random') {
      const randomThemes = [
        'Rokk Klassík',
        '80\'s Popp', 
        'Hip-Hop Smellir', 
        'Akústískar Útgáfur', 
        'Eurovision Goðsagnir',
        'Íslensk Tónlist',
        'Kvikmyndatónlist',
        'Jólatónlist',
        'Sumarsmellir',
        'K-pop'
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
      votingDay,
      votingOpenTime,
      votingCloseTime,
      votingRecurrence,
      theme: finalTheme,
      passwordHash,
    });

    await GroupUser.create({
      groupId: group.id,
      userId: userId,
      role: 'admin'
    });

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
        { model: User, as: 'members' }
      ]
    });
    
    if (!group) {
      return res.status(404).send('Group not found');
    }
    
    const isMember = group.members.some(member => member.id === userId);
    
    res.render('group', { group, isMember });
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

module.exports = router;
