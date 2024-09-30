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

// Middleware pour parser les données des formulaires
app.use(express.static('public')); // Pour servir les fichiers CSS et HTML

// Configuration des sessions
app.use(session({
  secret: 'votre_secret', // Change ceci avec une clé secrète
  resave: false,
  saveUninitialized: true,
  cookie: { secure: false } // Mettre à true si vous utilisez HTTPS
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

  try {
    const result = await pool.query('SELECT id, username FROM utilisateurs WHERE id != $1', [req.session.userId]);
    let usersList = '';
    result.rows.forEach(user => {
      usersList += `<li>${user.username} - <a href="/send-message?receiverId=${user.id}">Envoyer un message</a></li>`;
    });
    res.send(`
      <h2>Liste des utilisateurs :</h2>
      <ul>
        ${usersList}
      </ul>
      <a href="/received-messages">Voir les messages reçus</a>
      <a href="/">Retour à l'accueil</a>
    `);
  } catch (error) {
    console.error('Erreur lors de la récupération des utilisateurs:', error);
    res.status(500).send('Erreur lors de la récupération des utilisateurs.');
  }
});

// Route pour afficher le formulaire d'envoi de message
app.get('/send-message', async (req, res) => {
  const { receiverId } = req.query;

  res.send(`
    <h2>Envoyer un message</h2>
    <form action="/send-message" method="POST">
      <input type="hidden" name="receiverId" value="${receiverId}">
      <textarea name="message" placeholder="Votre message" required></textarea><br><br>
      <button type="submit">Envoyer</button>
    </form>
  `);
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

  try {
    const result = await pool.query(`
      SELECT m.message, m.created_at, u.username 
      FROM messages m 
      JOIN utilisateurs u ON m.sender_id = u.id 
      WHERE m.receiver_id = $1
      ORDER BY m.created_at DESC
    `, [req.session.userId]);

    let messagesList = '';
    result.rows.forEach(msg => {
      messagesList += `<li><strong>${msg.username}:</strong> ${msg.message} <em>${msg.created_at}</em></li>`;
    });

    res.send(`
      <h2>Messages reçus :</h2>
      <ul>
        ${messagesList}
      </ul>
      <a href="/">Retour à l'accueil</a>
    `);
  } catch (error) {
    console.error('Erreur lors de la récupération des messages reçus:', error);
    res.status(500).send('Erreur lors de la récupération des messages.');
  }
});

// Démarrer le serveur
app.listen(port, () => {
  console.log(`Serveur en cours d'exécution sur http://localhost:${port}`);
});
