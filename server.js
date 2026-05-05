// server.js — Main entry point
require('dotenv').config();
const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const { initDatabase } = require('./db/database');

async function startServer() {
  await initDatabase();

  const app = express();
  const PORT = process.env.PORT || 3000;

  // Middleware
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(cookieParser());
  app.use(express.static(path.join(__dirname, 'public')));

  // View engine
  app.set('view engine', 'ejs');
  app.set('views', path.join(__dirname, 'views'));

  // Routes
  app.get('/', (req, res) => res.redirect('/login'));
  app.use('/', require('./routes/auth'));
  app.use('/', require('./routes/dashboard'));
  app.use('/admin', require('./routes/admin'));

  // Error handling
  app.use((req, res) => res.status(404).render('error', { message: 'Page not found' }));
  app.use((err, req, res, next) => { console.error(err); res.status(500).render('error', { message: 'Something went wrong.' }); });

  // For local dev
  if (process.env.NODE_ENV !== 'production') {
    app.listen(PORT, () => {
      console.log(`\n🌊 Blue Ocean Dossier System`);
      console.log(`   ────────────────────────`);
      console.log(`   Respondent app: http://localhost:${PORT}`);
      console.log(`   Admin panel:    http://localhost:${PORT}/admin`);
      console.log(`   ────────────────────────\n`);
    });
  }

  return app;
}

// For Vercel: export the app
if (process.env.VERCEL) {
  let appPromise;
  module.exports = async (req, res) => {
    if (!appPromise) appPromise = startServer();
    const app = await appPromise;
    return app(req, res);
  };
} else {
  startServer().catch(err => { console.error('Failed to start:', err); process.exit(1); });
}
