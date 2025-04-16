const { User, Song, Group, Round, UserScore, sequelize } = require('../models');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, '../public/uploads/profiles');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, `profile-${req.user.id}-${uniqueSuffix}${ext}`);
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: function(req, file, cb) {
    if (!file.originalname.match(/\.(jpg|jpeg|png|gif)$/)) {
      return cb(new Error('Only image files are allowed!'), false);
    }
    cb(null, true);
  }
}).single('profilePicture');

exports.uploadProfilePicture = (req, res, next) => {
  const csrfToken = req.body && req.body._csrf;
  
  upload(req, res, async function(err) {
    if (err) {
      console.error('Multer error:', err);
      req.flash('error', 'Error uploading file: ' + err.message);
      return res.redirect('/users/' + req.params.id + '/edit');
    }
    
    if (csrfToken) {
      req.body._csrf = csrfToken;
    }
    
    if (req.file) {
      try {
        const result = await cloudinary.uploader.upload(req.file.path, {
          folder: 'profile_pictures',
          public_id: `user_${req.user.id}_${Date.now()}`,
        });
        
        req.cloudinaryUrl = result.secure_url;
        
        fs.unlinkSync(req.file.path);
      } catch (error) {
        console.error('Cloudinary upload error:', error);
        req.flash('error', 'Error uploading to cloud storage');
        return res.redirect('/users/' + req.params.id + '/edit');
      }
    }
    
    next();
  });
};

exports.getUserProfile = async (req, res) => {
  try {
    const userId = req.params.id;
    
    const user = await User.findByPk(userId, {
      attributes: ['id', 'username', 'email', 'profilePicture', 'bio', 'createdAt']
    });
    
    if (!user) {
      return res.status(404).render('error', { message: 'User not found' });
    }
    
    const userGroups = await sequelize.query(`
      SELECT g.id, g.name, gu.role
      FROM "Groups" g
      JOIN "GroupUsers" gu ON g.id = gu."groupId"
      WHERE gu."userId" = :userId
    `, {
      replacements: { userId },
      type: sequelize.QueryTypes.SELECT
    });
    
    const userSongs = await Song.findAll({
      where: { submittedBy: userId },
      include: [
        { model: Group, as: 'group', attributes: ['id', 'name'] },
        { 
          model: Round, 
          as: 'round',
          attributes: ['id', 'winnerId', 'winningSongId']
        }
      ],
      order: [['createdAt', 'DESC']]
    });
    
    const userScores = await UserScore.findAll({
      where: { userId },
      include: [{ model: Group, attributes: ['id', 'name'] }]
    });
    
    let totalSongs = userSongs.length;
    let winningSongs = userSongs.filter(song => 
      song.round && song.round.winningSongId === song.id
    ).length;
    
    const winPercentage = totalSongs > 0 ? 
      ((winningSongs / totalSongs) * 100).toFixed(1) : 0;
    
    res.render('userProfile', {
      user,
      userGroups,
      userSongs,
      userScores,
      totalSongs,
      winningSongs,
      winPercentage,
      isOwnProfile: req.user && req.user.id === parseInt(userId)
    });
  } catch (error) {
    console.error('Error getting user profile:', error);
    res.status(500).render('error', { message: 'Failed to load user profile' });
  }
};

exports.updateUserProfile = async (req, res) => {
  try {
    const userId = req.params.id;
    
    if (req.user.id !== parseInt(userId)) {
      req.flash('error', 'Þú getur aðeins breytt þínum eigin upplýsingum');
      return res.redirect('/users/' + req.user.id);
    }
    
    const { bio, imagePosition } = req.body;
    const updateData = { bio };
    
    if (req.cloudinaryUrl) {
      updateData.profilePicture = req.cloudinaryUrl;
      
      if (imagePosition) {
        try {
          const positionData = JSON.parse(imagePosition);
          updateData.profilePicturePosition = JSON.stringify(positionData);
        } catch (err) {
          console.error('Error parsing image position data:', err);
        }
      }
    }
    
    await User.update(updateData, {
      where: { id: userId }
    });
    
    req.flash('success', 'Upplýsingar uppfærðar!');
    res.redirect('/users/' + userId);
  } catch (error) {
    console.error('Error updating profile:', error);
    req.flash('error', 'Villa kom upp við að uppfæra upplýsingar');
    res.redirect('/users/' + req.params.id);
  }
};