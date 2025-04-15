const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authmiddleware');
const { User, Song, Group, Round, Vote } = require('../models');
const userController = require('../controllers/userController');
const csrf = require('csurf');
const csrfProtection = csrf({ cookie: true });

router.get('/users/:id', async (req, res) => {
  try {
    const userId = req.params.id;
    const user = await User.findByPk(userId);
    
    if (!user) {
      req.flash('error', 'Notandi fannst ekki');
      return res.redirect('/');
    }
    
    const userSongs = await Song.findAll({
      where: { submittedBy: userId },
      include: [
        { model: Group, as: 'group' },
        { model: Round, as: 'Round' } 
      ],
      order: [['createdAt', 'DESC']]
    });
    
    const winningSongs = userSongs.filter(song => 
      song.Round && song.Round.winningSongId === song.id
    );
    
    const userGroups = await user.getJoinedGroups({
      through: { attributes: ['role'] }
    });

    function getImagePositionStyle(positionJson) {
      try {
        const position = JSON.parse(positionJson);
        return `width: ${position.zoom}%; height: auto; transform: translate(${position.x}px, ${position.y}px);`;
      } catch (err) {
        console.error('Error parsing image position:', err);
        return '';
      }
    }
    
    res.render('userProfile', {
      profileUser: user,
      userSongs,
      winningSongs,
      userGroups,
      isOwnProfile: req.user && req.user.id === parseInt(userId),
      page: 'profile',
      getImagePositionStyle: getImagePositionStyle
    });
  } catch (error) {
    console.error('Error fetching user profile:', error);
    req.flash('error', 'Villa kom upp við að sækja notandasíðu');
    res.redirect('/');
  }
});

router.get('/users/:id/edit', csrfProtection, authMiddleware, (req, res) => {
  if (req.user.id !== parseInt(req.params.id)) {
    return res.status(403).render('error', { message: 'You can only edit your own profile' });
  }
  
  function getRandomColor(username) {
    let hash = 0;
    for (let i = 0; i < username.length; i++) {
      hash = username.charCodeAt(i) + ((hash << 5) - hash);
    }
    let color = '#';
    for (let i = 0; i < 3; i++) {
      const value = (hash >> (i * 8)) & 0xFF;
      color += ('00' + value.toString(16)).substr(-2);
    }
    return color;
  }
  
  res.render('editProfile', { 
    user: req.user,
    csrfToken: req.csrfToken(),
    getRandomColor: getRandomColor,  
    errorMessage: req.flash('error'),
    successMessage: req.flash('success'),
    page: 'profile'
  });
});

router.post('/users/:id/edit', 
  authMiddleware,
  (req, res, next) => {
    if (!req.is('multipart/form-data')) {
      return csrfProtection(req, res, next);
    }
    next();
  },
  userController.uploadProfilePicture,
  (req, res, next) => {
    csrfProtection(req, res, next);
  },
  userController.updateUserProfile
);

module.exports = router;