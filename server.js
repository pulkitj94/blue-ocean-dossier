require('dotenv').config();
const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const { initDatabase } = require('./db/database');

async function startServer() {
  await initDatabase();

  const app = express();
  const PORT = process.env.PORT || 3000;

  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(cookieParser());
  app.use(express.static(path.join(__dirname, 'public')));

  app.set('view engine', 'ejs');
  app.set('views', path.join(__dirname, 'views'));

  app.get('/', (req, res) => res.redirect('/login'));
  app.use('/', require('./routes/auth'));
  app.use('/', require('./routes/dashboard'));
  app.use('/admin', require('./routes/admin'));

  app.use((req, res) => {
    console.log('404:', req.method, req.url);
    res.status(404).render('error', { message: 'Page not found' });
  });
  app.use((err, req, res, next) => {
    console.error('Server error:', err.stack || err.message || err);
    res.status(500).render('error', { message: 'Something went wrong: ' + (err.message || 'Unknown error') });
  });

  if (!process.env.VERCEL) {
    app.listen(PORT, () => {
      console.log(`\n🌊 Blue Ocean Dossier System`);
      console.log(`   Respondent app: http://localhost:${PORT}`);
      console.log(`   Admin panel:    http://localhost:${PORT}/admin\n`);
    });
  }

  return app;
}

if (process.env.VERCEL) {
  let app;
  let initPromise;
  async function getApp() {
    if (app) return app;
    if (!initPromise) initPromise = startServer();
    app = await initPromise;
    return app;
  }
  module.exports = async (req, res) => {
    try {
      const expressApp = await getApp();
      return expressApp(req, res);
    } catch(err) {
      console.error('Vercel handler error:', err);
      res.status(500).json({ error: err.message });
    }
  };
} else {
  startServer().catch(err => { console.error('Failed to start:', err); process.exit(1); });
}