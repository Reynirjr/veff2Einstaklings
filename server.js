const express = require('express');
const app = express();
const path = require('path');
require('dotenv').config();
const sequelize = require('./config/database');
const { User, Group, Song, Vote } = require('./models');

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

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