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
    req.session.username = user.username;
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
    const users = result.rows;

    let usersHTML = `
      <html>
      <head>
        <title>Liste des utilisateurs</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            margin: 20px;
          }
          ul {
            list-style-type: none;
            padding: 0;
          }
          li {
            margin: 10px 0;
          }
        </style>
      </head>
      <body>
        <h2>Liste des utilisateurs</h2>
        <ul>
    `;

    users.forEach(user => {
      usersHTML += `<li><a href="/messages/${user.id}">${user.username}</a></li>`;
    });

    usersHTML += `
        </ul>
        <a href="/logout">Se déconnecter</a>
      </body>
      </html>
    `;

    res.send(usersHTML); // Envoie du HTML généré pour la liste des utilisateurs
  } catch (error) {
    console.error('Erreur lors de la récupération des utilisateurs:', error);
    res.status(500).send('Erreur lors de la récupération des utilisateurs.');
  }
});

// Route pour afficher les messages échangés avec un utilisateur
app.get('/messages/:id', async (req, res) => {
  const receiverId = req.params.id;
  const senderId = req.session.userId;

  if (!senderId) {
    return res.redirect('/login');
  }

  try {
    // Récupérer le nom d'utilisateur du destinataire
    const userResult = await pool.query('SELECT username FROM utilisateurs WHERE id = $1', [receiverId]);
    const receiver = userResult.rows[0];

    // Vérifie si l'utilisateur existe
    if (!receiver) {
      return res.status(404).send('Utilisateur non trouvé.');
    }

    const result = await pool.query(`
      SELECT * FROM messages
      WHERE (sender_id = $1 AND receiver_id = $2) 
      OR (sender_id = $2 AND receiver_id = $1)
      ORDER BY created_at ASC
    `, [senderId, receiverId]);

    const messages = result.rows;

    let messagesHTML = `
      <html>
      <head>
        <title>Messages échangés</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            margin: 20px;
          }
          ul {
            list-style-type: none;
            padding: 0;
          }
          .message {
            margin: 10px 0;
            padding: 10px;
            border-radius: 5px;
            max-width: 60%;
          }
          .sent {
            background-color: #d1e7dd;
            margin-left: auto;
            text-align: right;
          }
          .received {
            background-color: #f8d7da;
            text-align: left;
          }
        </style>
      </head>
      <body>
        <h2>Messages échangés avec ${receiver.username}</h2>
        <ul>
    `;

    messages.forEach(message => {
      const sender = message.sender_id === senderId ? "Vous" : receiver.username; // Utiliser le nom d'utilisateur
      const messageClass = message.sender_id === senderId ? "sent" : "received";

      messagesHTML += `
        <li class="message ${messageClass}">
          <strong>${sender}:</strong> ${message.message} <br>
          <small>Envoyé le ${message.created_at}</small>
        </li>
      `;
    });

    messagesHTML += `
        </ul>
        <form action="/send-message/${receiverId}" method="POST">
          <input type="text" name="message" placeholder="Votre message" required>
          <button type="submit">Envoyer</button>
        </form>
        <a href="/users">Retour à la liste des utilisateurs</a>
      </body>
      </html>
    `;

    res.send(messagesHTML); // Envoie du HTML généré pour les messages
  } catch (error) {
    console.error('Erreur lors de la récupération des messages:', error);
    res.status(500).send('Erreur lors de la récupération des messages.');
  }
});

// Route POST pour envoyer un message
app.post('/send-message/:receiverId', async (req, res) => {
  const { message } = req.body;
  const senderId = req.session.userId;
  const receiverId = req.params.receiverId;

  if (!senderId) {
    return res.status(403).send('Vous devez être connecté pour envoyer un message.');
  }

  try {
    await pool.query('INSERT INTO messages (sender_id, receiver_id, message) VALUES ($1, $2, $3)', [senderId, receiverId, message]);
    res.redirect('/messages/' + receiverId);
  } catch (error) {
    console.error('Erreur lors de l\'envoi du message:', error);
    res.status(500).send('Erreur lors de l\'envoi du message.');
  }
});

// Route pour se déconnecter
app.get('/logout', (req, res) => {
  req.session.destroy(err => {
    if (err) {
      return res.status(500).send('Erreur lors de la déconnexion.');
    }
    res.redirect('/login');
  });
});

// Démarrer le serveur
app.listen(port, () => {
  console.log(`Serveur en cours d'exécution sur http://localhost:${port}`);
});
