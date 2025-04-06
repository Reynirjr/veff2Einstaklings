const express = require('express');
const app = express();
const path = require('path');
const cookieParser = require('cookie-parser');
require('dotenv').config();
const db = require('./models');  
const { User, Group, Song, Vote, Round } = db;  
const helmet = require('helmet');
const roundStatusMiddleware = require('./middleware/roundStatusMiddleware');
const { updateRoundsStatus } = require('./utils/roundStatus');
const { formatDateWithMilitaryTime, formatTimeOnly } = require('./utils/formatters');

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://www.youtube.com", "https://s.ytimg.com"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      frameSrc: ["'self'", "https://www.youtube.com", "https://youtube.com", "https://www.youtube-nocookie.com"],
      childSrc: ["'self'", "https://www.youtube.com", "https://youtube.com", "https://www.youtube-nocookie.com"],
      imgSrc: ["'self'", "https://i.ytimg.com", "https://img.youtube.com", "https://www.youtube.com", "data:"]
    }
  }
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

app.use(roundStatusMiddleware);

const flashMiddleware = require('./middleware/flashMiddleware');
app.use(flashMiddleware);

app.use((req, res, next) => {
  res.locals.isAuthenticated = !!req.cookies.token;
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
    updateRoundsStatus();
  })
  .catch(err => console.error('Error syncing database:', err));

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));
console.log('DB_NAME is:', process.env.DB_NAME);

// Routes
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

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
