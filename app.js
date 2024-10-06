const express = require('express');
const bodyParser = require('body-parser');
const bcrypt = require('bcryptjs');
const { Pool } = require('pg');
const path = require('path');
const session = require('express-session');

const app = express();
const port = 3000;

const pool = new Pool({
  connectionString: 'postgresql://neondb_owner:JXTGM9RE1BjH@ep-late-bread-a29sphep-pooler.eu-central-1.aws.neon.tech/utilisateursdb?sslmode=require',
  ssl: { rejectUnauthorized: false }
});

app.use(bodyParser.urlencoded({ extended: false }));
app.use(express.static('public'));

app.use(session({
  secret: 'votre_secret',
  resave: false,
  saveUninitialized: true,
  cookie: { secure: false }
}));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'index.html'));
});

app.get('/register', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'register.html'));
});

app.get('/login', (req, res) => {
  if (req.session.userId) {
    return res.redirect('/users');
  }
  res.sendFile(path.join(__dirname, 'views', 'login.html'));
});

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
            font-family: 'Arial', sans-serif;
            background-color: #f4f4f4;
            margin: 0;
            padding: 20px;
          }

          h2 {
            color: #333;
            text-align: center;
            margin-bottom: 20px;
          }

          ul {
            list-style-type: none;
            padding: 0;
            display: flex;
            flex-direction: column;
            align-items: center;
          }

          li {
            background: #fff;
            border-radius: 8px;
            box-shadow: 0 2px 5px rgba(0, 0, 0, 0.1);
            padding: 15px 20px;
            margin: 10px 0;
            width: 80%;
            transition: transform 0.2s, box-shadow 0.2s;
          }

          li:hover {
            transform: translateY(-2px);
            box-shadow: 0 4px 10px rgba(0, 0, 0, 0.2);
          }

          a {
            text-decoration: none;
            color: #007bff;
            font-weight: bold;
          }

          a:hover {
            color: #0056b3;
          }

          a:visited {
            color: #6f42c1;
          }

          /* Mode sombre */
          body.dark {
            background-color: #121212;
            color: #ffffff;
          }

          body.dark h2 {
            color: #ffffff;
          }

          body.dark li {
            background: #1e1e1e;
            color: #ffffff;
          }

          body.dark a {
            color: #1e90ff;
          }

          body.dark a:hover {
            color: #63a1ff;
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

    res.send(usersHTML);
  } catch (error) {
    console.error('Erreur lors de la récupération des utilisateurs:', error);
    res.status(500).send('Erreur lors de la récupération des utilisateurs.');
  }
});

app.get('/messages/:id', async (req, res) => {
  const receiverId = req.params.id;
  const senderId = req.session.userId;

  if (!senderId) {
    return res.redirect('/login');
  }

  try {
    const userResult = await pool.query('SELECT username FROM utilisateurs WHERE id = $1', [receiverId]);
    const receiver = userResult.rows[0];

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
            background-image: url(https://i.pinimg.com/originals/92/d6/5d/92d65d64f87ef2b95e5800de96cbf31e.jpg);
            background-size: cover;
          }

          ul {
            list-style-type: none;
            padding: 0;
          }

          .message {
            margin: 10px 0;
            padding: 15px;
            border-radius: 8px;
            max-width: 60%;
            position: relative;
            box-shadow: 0 2px 5px rgba(0, 0, 0, 0.2);
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

          .timestamp {
            font-size: 0.8em;
            color: #6c757d;
            position: absolute;
            bottom: -15px;
            right: 10px;
          }

          .timestamp.passed {
            color: #dc3545;
          }

          .timestamp.current {
            color: #28a745;
          }

          /* Mode sombre */
          body.dark {
            background-color: #121212;
            color: #ffffff;
          }

          body.dark .message {
            color: #ffffff;
          }

          body.dark .sent {
            background-color: #2e7d32;
          }

          body.dark .received {
            background-color: #f44336;
          }

        </style>
      </head>
      <body>
        <h2>Messages échangés avec ${receiver.username}</h2>
        <ul>
    `;

    messages.forEach(message => {
      const sender = message.sender_id === senderId ? "Vous" : receiver.username;
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
        <button onclick="toggleDarkMode()">Basculer le mode sombre</button>
      </body>
      <script>
        function toggleDarkMode() {
          document.body.classList.toggle('dark');
        }
      </script>
      </html>
    `;

    res.send(messagesHTML);
  } catch (error) {
    console.error('Erreur lors de la récupération des messages:', error);
    res.status(500).send('Erreur lors de la récupération des messages.');
  }
});

app.post('/send-message/:id', async (req, res) => {
  const senderId = req.session.userId;
  const receiverId = req.params.id;
  const message = req.body.message;

  if (!senderId) {
    return res.redirect('/login');
  }

  try {
    await pool.query('INSERT INTO messages (sender_id, receiver_id, message) VALUES ($1, $2, $3)', [senderId, receiverId, message]);
    res.redirect(`/messages/${receiverId}`);
  } catch (error) {
    console.error('Erreur lors de l\'envoi du message:', error);
    res.status(500).send('Erreur lors de l\'envoi du message.');
  }
});

app.get('/logout', (req, res) => {
  req.session.destroy(err => {
    if (err) {
      return res.status(500).send('Erreur lors de la déconnexion.');
    }
    res.redirect('/login');
  });
});

app.listen(port, () => {
  console.log(`Serveur à l'écoute sur http://localhost:${port}`);
});
