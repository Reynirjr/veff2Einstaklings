'use strict';

const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const { config } = require('../config/env');
const { User, Song, Group, Round } = require('../models');

cloudinary.config({
  cloud_name: config.cloudinary.cloudName,
  api_key: config.cloudinary.apiKey,
  api_secret: config.cloudinary.apiSecret,
});

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter(req, file, cb) {
    if (!/\.(jpg|jpeg|png|gif)$/i.test(file.originalname)) {
      return cb(new Error('Only image files are allowed.'), false);
    }
    cb(null, true);
  },
}).single('profilePicture');

/** GET /users/:id — public profile. */
exports.getProfile = async (req, res) => {
  const userId = req.params.id;
  const user = await User.findByPk(userId);
  if (!user) {
    res.flash('error', 'Notandi fannst ekki');
    return res.redirect('/');
  }

  const userSongs = await Song.findAll({
    where: { submittedBy: userId },
    include: [
      { model: Group, as: 'group' },
      { model: Round, as: 'round' },
    ],
    order: [['createdAt', 'DESC']],
  });
  const winningSongs = userSongs.filter(
    (s) => s.round && s.round.winningSongId === s.id
  );
  const userGroups = await user.getJoinedGroups({ through: { attributes: ['role'] } });

  res.render('userProfile', {
    profileUser: user,
    userSongs,
    winningSongs,
    userGroups,
    isOwnProfile: !!(req.user && req.user.id === Number(userId)),
    page: 'profile',
  });
};

/** GET /users/:id/edit — own profile only. */
exports.getEditForm = (req, res) => {
  if (req.user.id !== Number(req.params.id)) {
    return res.status(403).render('error', { message: 'You can only edit your own profile' });
  }
  res.render('editProfile', { user: req.user, page: 'profile' });
};

/** Middleware: parse the multipart upload and push any image to Cloudinary. */
exports.uploadProfilePicture = (req, res, next) => {
  upload(req, res, async (err) => {
    // The edit form submits via XHR and treats any non-200 as failure. Respond
    // with an error status (not a redirect) so the client surfaces the message
    // instead of transparently following a 302 to the success path.
    if (err) {
      return res.status(400).send(`Error uploading file: ${err.message}`);
    }
    if (req.file) {
      try {
        const dataUri = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;
        const result = await cloudinary.uploader.upload(dataUri, {
          folder: 'profile_pictures',
          public_id: `user_${req.user.id}_${Date.now()}`,
        });
        req.cloudinaryUrl = result.secure_url;
      } catch (uploadErr) {
        return res.status(502).send('Error uploading to cloud storage.');
      }
    }
    next();
  });
};

/** POST /users/:id/edit — own profile only. */
exports.updateProfile = async (req, res) => {
  const userId = req.params.id;
  if (req.user.id !== Number(userId)) {
    res.flash('error', 'Þú getur aðeins breytt þínum eigin upplýsingum');
    return res.redirect(`/users/${req.user.id}`);
  }

  const updateData = { bio: req.body.bio };
  if (req.cloudinaryUrl) {
    updateData.profilePicture = req.cloudinaryUrl;
    if (req.body.imagePosition) {
      try {
        updateData.profilePicturePosition = JSON.stringify(JSON.parse(req.body.imagePosition));
      } catch (err) {
        /* ignore malformed position */
      }
    }
  }

  await User.update(updateData, { where: { id: userId } });
  res.flash('success', 'Upplýsingar uppfærðar!');
  res.redirect(`/users/${userId}`);
};
