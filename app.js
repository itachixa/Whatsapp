const express = require('express');
const bodyParser = require('body-parser');
const bcrypt = require('bcryptjs');
const { Pool } = require('pg');
const path = require('path');
const session = require('express-session');

const app = express();
const port = 3000;

// Configuration de la chaîne de connexion PostgreSQL
const pool = new Pool({
  connectionString: 'postgresql://neondb_owner:JXTGM9RE1BjH@ep-late-bread-a29sphep-pooler.eu-central-1.aws.neon.tech/utilisateursdb?sslmode=require',
  ssl: { rejectUnauthorized: false }
});

// Middleware pour traiter les données POST
app.use(bodyParser.urlencoded({ extended: false }));
app.use(express.static('public')); // Pour servir les fichiers CSS et HTML

// Configuration des sessions
app.use(session({
  secret: 'votre_secret', // Change ceci avec une clé secrète
  resave: false,
  saveUninitialized: true,
  cookie: { secure: false } // Utilise true si HTTPS est activé
}));

// Route pour afficher la page d'accueil
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'index.html'));
});

// Route pour afficher la page d'inscription
app.get('/register', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'register.html'));
});

// Route pour afficher la page de connexion
app.get('/login', (req, res) => {
  if (req.session.userId) {
    return res.redirect('/users');
  }
  res.sendFile(path.join(__dirname, 'views', 'login.html'));
});

// Route d'enregistrement
app.post('/register', async (req, res) => {
  const { username, email, password } = req.body;

  try {
    const result = await pool.query('SELECT * FROM utilisateurs WHERE email = $1', [email]);
    if (result.rows.length > 0) {
      return res.send('Cet email est déjà utilisé.');
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    await pool.query('INSERT INTO utilisateurs (username, email, password) VALUES ($1, $2, $3)', [username, email, hashedPassword]);

    res.redirect('/login');
  } catch (error) {
    console.error('Erreur lors de l\'enregistrement:', error);
    res.status(500).send('Erreur lors de l\'enregistrement.');
  }
});

// Route de connexion
app.post('/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    const result = await pool.query('SELECT * FROM utilisateurs WHERE email = $1', [email]);

    if (result.rows.length === 0) {
      return res.send('Email ou mot de passe incorrect.');
    }

    const user = result.rows[0];
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.send('Email ou mot de passe incorrect.');
    }

    req.session.userId = user.id;
    res.redirect('/users');
  } catch (error) {
    console.error('Erreur lors de la connexion:', error);
    res.status(500).send('Erreur lors de la connexion.');
  }
});

// Route pour afficher la liste des utilisateurs
app.get('/users', async (req, res) => {
  if (!req.session.userId) {
    return res.redirect('/login');
  }

  res.sendFile(path.join(__dirname, 'views', 'users.html')); // Cette route affichera le fichier users.html
});

// Route pour afficher le formulaire d'envoi de message
app.get('/send-message', async (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'send-message.html'));
});

// Route POST pour envoyer le message
app.post('/send-message', async (req, res) => {
  const { receiverId, message } = req.body;
  const senderId = req.session.userId;

  if (!senderId) {
    return res.status(403).send('Vous devez être connecté pour envoyer un message.');
  }

  try {
    await pool.query('INSERT INTO messages (sender_id, receiver_id, message) VALUES ($1, $2, $3)', [senderId, receiverId, message]);
    res.send('Message envoyé avec succès !');
  } catch (error) {
    console.error('Erreur lors de l\'envoi du message:', error);
    res.status(500).send('Erreur lors de l\'envoi du message.');
  }
});

// Route pour afficher les messages reçus par l'utilisateur
app.get('/received-messages', async (req, res) => {
  if (!req.session.userId) {
    return res.redirect('/login');
  }

  res.sendFile(path.join(__dirname, 'views', 'received-messages.html'));
});

// Démarrer le serveur
app.listen(port, () => {
  console.log(`Serveur en cours d'exécution sur http://localhost:${port}`);
});
