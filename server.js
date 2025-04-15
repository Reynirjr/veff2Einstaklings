const express = require('express');
const app = express();
const path = require('path');
const cookieParser = require('cookie-parser');
require('dotenv').config();
const db = require('./models');  
const { User, Group, Song, Vote, Round } = db;  
const helmet = require('helmet');
const roundStatusMiddleware = require('./middleware/roundStatusMiddleware');
const roundCheckMiddleware = require('./middleware/roundCheckMiddleware');
const roundStatus = require('./utils/roundStatus');
const { formatDateWithMilitaryTime, formatTimeOnly } = require('./utils/formatters');
const csrf = require('csurf');
const csrfProtection = csrf({
  cookie: true,
  value: (req) => {
    return req.headers['x-csrf-token'] || req.body._csrf;
  }
});
const { body, validationResult } = require('express-validator');
const jwt = require('jsonwebtoken');

const isDev = process.env.NODE_ENV !== 'production';

if (isDev) {
  app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
    crossOriginOpenerPolicy: false,
    crossOriginResourcePolicy: false
  }));
} else {
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'", "https://www.youtube.com", "https://s.ytimg.com"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        frameSrc: ["'self'", "https://www.youtube.com", "https://youtube.com"],
        imgSrc: ["'self'", "https://i.ytimg.com", "data:"]
      }
    }
  }));
}

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));
app.use(cookieParser());
app.use(csrfProtection);

app.use((req, res, next) => {
  res.locals.csrfToken = req.csrfToken();
  next();
});

app.use(roundStatusMiddleware);
app.use(roundCheckMiddleware);

const flashMiddleware = require('./middleware/flashMiddleware');
app.use(flashMiddleware);

app.use(async (req, res, next) => {
  const token = req.cookies.token;
  res.locals.isAuthenticated = !!token;
  
  if (token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findByPk(decoded.id);
      if (user) {
        req.user = user;
        res.locals.user = user;
      }
    } catch (error) {
      console.error('Error verifying token:', error);
    }
  }
  
  next();
});

app.use((req, res, next) => {
  res.locals.formatDateWithMilitaryTime = formatDateWithMilitaryTime;
  res.locals.formatTimeOnly = formatTimeOnly;
  next();
});

db.sequelize.authenticate()
  .then(() => console.log('Database connected successfully.'))
  .catch(err => console.error('Unable to connect to the database:', err));

db.sequelize.sync({ alter: true })
  .then(() => {
    console.log('Database synced successfully.');
    roundStatus.startRoundStatusChecker();
  })
  .catch(err => console.error('Error syncing database:', err));

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));
console.log('DB_NAME is:', process.env.DB_NAME);


const indexRoutes = require('./routes/index');
app.use('/', indexRoutes);

const authRoutes = require('./routes/auth');
app.use('/', authRoutes);

const groupRoutes = require('./routes/groups');
app.use('/', groupRoutes);

const songRoutes = require('./routes/songs');
app.use('/', songRoutes);

const roundRoutes = require('./routes/rounds');
app.use('/', roundRoutes);

const debugRoutes = require('./routes/debug');
app.use('/', debugRoutes);

const userRoutes = require('./routes/users');
app.use('/', userRoutes);

const authMiddleware = require('./middleware/authmiddleware');
const songController = require('./controllers/songController');
const router = express.Router();

router.post('/rounds/:roundId/songs', [
  body('title').trim().isLength({ min: 1, max: 100 }).escape(),
  body('artist').trim().isLength({ min: 1, max: 100 }).escape(),
  authMiddleware,
], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  songController.submitSong(req, res);
});

app.use(router);

const PORT = process.env.PORT;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
