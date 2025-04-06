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

router.post('/groups/:groupId/rounds', authMiddleware, async (req, res) => {
    try {
        const { groupId } = req.params;
        const userId = req.user.id;
        const group = await Group.findByPk(groupId);
        if (!group) {
            return res.status(404).send('Group not found');
        }

        if (group.created_by !== userId) {
            const isAdmin = await GroupUser.findOne({
                where: { groupId, userId, role: 'admin' }
            });
            if (!isAdmin) {
                return res.status(403).send('Only group admins can create new rounds');
            }
        }

        const roundCount = await Round.count({ where: { groupId } });

        const { inputStartDate, theme } = req.body;
        const inputStart = new Date(inputStartDate);
        const inputEnd = new Date(inputStartDate);
        const votingStart = new Date(inputStartDate);
        const votingEnd = new Date(inputStartDate);

        const [inputOpenHour, inputOpenMin] = group.inputOpenTime
            .split(':')
            .map(Number);
        const [inputCloseHour, inputCloseMin] = group.inputCloseTime
            .split(':')
            .map(Number);
        const [votingOpenHour, votingOpenMin] = group.votingOpenTime
            .split(':')
            .map(Number);
        const [votingCloseHour, votingCloseMin] = group.votingCloseTime
            .split(':')
            .map(Number);

        inputStart.setHours(inputOpenHour, inputOpenMin, 0, 0);
        inputEnd.setHours(inputCloseHour, inputCloseMin, 0, 0);
        votingStart.setHours(votingOpenHour, votingOpenMin, 0, 0);
        votingEnd.setHours(votingCloseHour, votingCloseMin, 0, 0);

        if (votingOpenHour < inputCloseHour) {
            votingStart.setDate(votingStart.getDate() + 1);
            votingEnd.setDate(votingEnd.getDate() + 1);
        }

        const round = await Round.create({
            groupId,
            roundNumber: roundCount + 1,
            inputOpen: inputStart,
            inputClose: inputEnd,
            votingOpen: votingStart,
            votingClose: votingEnd,
            status: 'pending',
            theme
        });

        res.redirect(`/rounds/${round.id}`);
    } catch (err) {
        console.error(err);
        res.status(500).send('Error creating new round');
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
        
        // Check if this user is the winner
        if (round.winnerId !== userId) {
            return res.status(403).render('error', { message: 'Only the round winner can set the theme' });
        }
        
        // Check if theme is already set
        if (round.nextThemeSelected) {
            return res.status(400).render('error', { message: 'Theme has already been set' });
        }
        
        // Update the group theme
        const group = round.group;
        group.theme = theme;
        await group.save();
        
        // Mark theme as selected
        round.nextThemeSelected = true;
        await round.save();
        
        req.flash('success', 'You have set the theme for the next round!');
        res.redirect(`/groups/${round.groupId}`);
    } catch (error) {
        console.error('Error setting round theme:', error);
        res.status(500).render('error', { message: 'Error setting round theme' });
    }
});

module.exports = router;
