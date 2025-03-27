const express = require('express');
const app = express();
const path = require('path');
const cookieParser = require('cookie-parser'); // Move this import to the top
require('dotenv').config();
const sequelize = require('./config/database');
const { User, Group, Song, Vote } = require('./models');
const helmet = require('helmet');
app.use(helmet());

app.use(express.json());
app.use(cookieParser());

app.use((req, res, next) => {
  res.locals.isAuthenticated = !!req.cookies.token;
  next();
});
app.use(express.urlencoded({ extended: true }));

sequelize.authenticate()
  .then(() => console.log('Database connected successfully.'))
  .catch(err => console.error('Unable to connect to the database:', err));

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

console.log('DB_NAME is:', process.env.DB_NAME);

app.use(express.static(path.join(__dirname, 'public')));

const indexRoutes = require('./routes/index');
app.use('/', indexRoutes);

const authRoutes = require('./routes/auth');
app.use('/', authRoutes);

const groupRoutes = require('./routes/groups');
app.use('/', groupRoutes);

const songRoutes = require('./routes/songs');
app.use('/', songRoutes);

sequelize.sync({ alter: true })
  .then(() => {
    console.log('Database synced successfully.');
  })
  .catch(err => {
    console.error('Error syncing database:', err);
  });

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));