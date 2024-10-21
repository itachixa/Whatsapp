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

// Route d'accueil
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'index.html'));
});

// Route d'inscription
app.get('/register', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'register.html'));
});

// Route de connexion
app.get('/login', (req, res) => {
  if (req.session.userId) {
    return res.redirect('/users');
  }
  res.sendFile(path.join(__dirname, 'views', 'login.html'));
});

// Traitement de l'inscription
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

// Traitement de la connexion
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

// Route pour la liste des utilisateurs
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
                /* Styles de base */
                body {
                  font-family: 'Arial', sans-serif;
                  background-color: #f4f4f4;
                  margin: 0;
                  padding: 20px;
                  transition: background-color 0.3s, color 0.3s;
                  display: flex;
                  flex-direction: column;
                  min-height: 100vh; /* Permet au contenu de s'étendre sur toute la hauteur de la fenêtre */
                }

                h2 {
                  color: #333;
                  text-align: center;
                  margin-bottom: 20px;
                  font-size: 2rem; /* Utilisation d'unités relatives */
                }

                ul {
                  list-style-type: none;
                  padding: 0;
                  display: flex;
                  flex-direction: column;
                  align-items: center;
                  max-width: 600px;
                  width: 100%;
                  margin: 0 auto;
                  text-align: center;
                }

                li {
                  background: #fff;
                  border-radius: 8px;
                  box-shadow: 0 2px 5px rgba(0, 0, 0, 0.1);
                  padding: 15px 20px;
                  margin: 10px 0;
                  width: 100%;
                  max-width: 500px;
                  transition: transform 0.2s, box-shadow 0.2s;
                  font-size: 1rem;
                }

                li:hover {
                  transform: translateY(-2px);
                  box-shadow: 0 4px 10px rgba(0, 0, 0, 0.2);
                }

                a {
                  text-decoration: none;
                  color: #007bff;
                  font-weight: bold;
                  display: block;
                  width: 100%;
                }

                a:hover {
                  color: #0056b3;
                }

                a:visited {
                  color: #6f42c1;
                }

                /* Bouton de déconnexion */
                .logout-link {
                  display: block;
                  text-align: center;
                  margin-top: 30px;
                  padding: 10px 20px;
                  background-color: #dc3545;
                  color: white;
                  text-decoration: none;
                  border-radius: 5px;
                  transition: background-color 0.3s;
                  max-width: 200px;
                  margin-left: auto;
                  margin-right: auto;
                  font-size: 1rem;
                }

                .logout-link:hover {
                  background-color: #c82333;
                }

                /* Bouton de basculement du mode sombre */
                .dark-mode-toggle {
                  display: block;
                  margin: 20px auto;
                  padding: 10px 20px;
                  background-color: #6c757d;
                  color: white;
                  border: none;
                  border-radius: 20px;
                  cursor: pointer;
                  transition: background-color 0.3s;
                  font-size: 1rem;
                }

                .dark-mode-toggle:hover {
                  background-color: #5a6268;
                }

                /* Mode sombre */
                body.dark {
                  background-color: #121212;
                  color: #ffffff;
                }

                body.dark h2 {
                  color: #ffffff;
                }

                body.dark ul {
                  background-color: #1e1e1e;
                }

                body.dark li {
                  background: #1e1e1e;
                  color: #ffffff;
                  box-shadow: 0 2px 5px rgba(255, 255, 255, 0.1);
                }

                body.dark a {
                  color: #1e90ff;
                }

                body.dark a:hover {
                  color: #63a1ff;
                }

                body.dark a:visited {
                  color: #66b2ff;
                }

                body.dark .logout-link {
                  background-color: #28a745;
                }

                body.dark .logout-link:hover {
                  background-color: #218838;
                }

                body.dark .dark-mode-toggle {
                  background-color: #343a40;
                }

                body.dark .dark-mode-toggle:hover {
                  background-color: #23272b;
                }

                /* Scrollbar personnalisé (optionnel) */
                ul::-webkit-scrollbar {
                  width: 8px;
                }

                ul::-webkit-scrollbar-track {
                  background: transparent;
                }

                ul::-webkit-scrollbar-thumb {
                  background-color: rgba(0, 0, 0, 0.2);
                  border-radius: 4px;
                }

                /* Responsive Design */

                /* Pour les tablettes en mode paysage et petits écrans d'ordinateur */
                @media (max-width: 1024px) {
                  body {
                    padding: 15px;
                  }

                  h2 {
                    font-size: 1.8rem;
                  }

                  li {
                    max-width: 450px;
                    padding: 12px 18px;
                    font-size: 0.95rem;
                  }

                  .logout-link, .dark-mode-toggle {
                    padding: 9px 18px;
                    font-size: 0.95rem;
                    max-width: 180px;
                  }
                }

                /* Pour les mobiles en mode paysage et tablettes */
                @media (max-width: 768px) {
                  h2 {
                    font-size: 1.6rem;
                  }

                  li {
                    max-width: 400px;
                    padding: 10px 16px;
                    font-size: 0.9rem;
                  }

                  .logout-link, .dark-mode-toggle {
                    padding: 8px 16px;
                    font-size: 0.9rem;
                    max-width: 160px;
                  }
                }

                /* Pour les petits écrans (mobiles en mode portrait) */
                @media (max-width: 480px) {
                  body {
                    padding: 10px;
                  }

                  h2 {
                    font-size: 1.4rem;
                  }

                  li {
                    max-width: 100%;
                    padding: 8px 12px;
                    font-size: 0.85rem;
                    margin: 8px 0;
                  }

                  a {
                    font-size: 0.9rem;
                  }

                  .logout-link, .dark-mode-toggle {
                    padding: 7px 14px;
                    font-size: 0.85rem;
                    max-width: 140px;
                  }
                }

                /* Pour les très grands écrans */
                @media (min-width: 1200px) {
                  h2 {
                    font-size: 2.5rem;
                  }

                  li {
                    max-width: 550px;
                    padding: 18px 25px;
                    font-size: 1.1rem;
                  }

                  .logout-link, .dark-mode-toggle {
                    padding: 12px 24px;
                    font-size: 1.1rem;
                    max-width: 220px;
                  }
                }

                /* Pour les grands écrans */
                @media (min-width: 1024px) {
                  h2 {
                    font-size: 2rem;
                  }
                    li {
                    max-width: 500px;
                    padding: 16px 22px;
                    font-size: 1rem;
                  }
                    .logout-link, .dark-mode-toggle {
                    padding: 14px 26px;
                    font-size: 1rem;
                    max-width: 260px;
                  }
                    /* Pour les petits écrans (mobile en mode portrait) */
                    @media (max-width: 480px) {
                    h2 {
                        font-size: 1.6rem;
                    }
                    li {
                        max-width: 100%;
                        padding: 8px 12px;
                        font-size: 0.85rem;
                        margin: 8px 0;
                    }
                    a {
                        font-size: 0.9rem;
                    }
                   .logout-link, .dark-mode-toggle {
                    padding: 7px 14px;
                    font-size: 0.85rem;
                    max-width: 140px;
  }
                    .profile-picture {
                    width: 40px;
                    height: 40px;
                    border-radius: 50%; /* Pour rendre l'image ronde */
                    margin-right: 10px; /* Espace entre l'image et le nom d'utilisateur */
                    vertical-align: middle;
}


        </style>
      </head>
      <body>
<h2>Liste des utilisateurs</h2>
<ul>
`;

users.forEach(user => {
  // Ajout de la balise <img> en tant que chaîne de caractères dans usersHTML
  usersHTML += `
    <li>
      <img src="${user.profilePictureUrl}" alt="Photo de profil de ${user.username}" class="profile-picture" />
      <a href="/messages/${user.id}">${user.username}</a>
    </li>
  `;
});

    usersHTML += `
        </ul>
        <a href="/logout" class="logout-link">Se déconnecter</a>
        <button onclick="toggleDarkMode()" class="dark-mode-toggle">Basculer le mode sombre</button>
      </body>
      <script>
        function toggleDarkMode() {
          document.body.classList.toggle('dark');
          // Sauvegarder l'état du mode sombre dans localStorage
          if (document.body.classList.contains('dark')) {
            localStorage.setItem('darkMode', 'enabled');
          } else {
            localStorage.setItem('darkMode', 'disabled');
          }
        }

        // Appliquer le mode sombre en fonction de ce qui est sauvegardé
        window.onload = function() {
          const darkMode = localStorage.getItem('darkMode');
          if (darkMode === 'enabled') {
            document.body.classList.add('dark');
          }
        }
      </script>
      </html>
    `;

    res.send(usersHTML);
  } catch (error) {
    console.error('Erreur lors de la récupération des utilisateurs:', error);
    res.status(500).send('Erreur lors de la récupération des utilisateurs.');
  }
});

// Route pour afficher les messages échangés avec un utilisateur spécifique
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
                  margin: 0;
                  padding: 0;

                  display: flex;
                  flex-direction: column;
                  min-height: 100vh; /* Utiliser min-height au lieu de height pour permettre le défilement */
                  transition: background-color 0.3s, color 0.3s;
                }

                h2 {
                  background-color: #0084ff;
                  color: white;
                  padding: 15px;
                  text-align: center;
                  margin: 0;
                  font-size: 1.5rem; /* Utiliser des unités relatives */
                }

                .messages-container {
                  flex: 1;
                  overflow-y: auto;
                  padding: 20px;
                  background-image: url('https://i.pinimg.com/originals/92/d6/5d/92d65d64f87ef2b95e5800de96cbf31e.jpg');
                  background-size: cover;
                  background-repeat: no-repeat;
                  background-position: center;
                  transition: background-color 0.3s, background-image 0.3s;
                  display: flex;
                  flex-direction: column;
                }

                ul {
                  list-style-type: none;
                  padding: 0;
                  display: flex;
                  flex-direction: column;
                  width: 100%;
                  max-width: 800px;
                  margin: 0 auto;
                }

                .message {
                  margin: 10px 0;
                  padding: 15px 20px;
                  border-radius: 20px;
                  max-width: 70%;
                  position: relative;
                  box-shadow: 0 2px 5px rgba(0, 0, 0, 0.2);
                  word-wrap: break-word;
                  transition: background-color 0.3s, color 0.3s;
                  font-size: 1rem;
                }

                .sent {
                  background-color: #dcf8c6;
                  align-self: flex-end;
                  text-align: right;
                }

                .received {
                  background-color: #ffffff;
                  align-self: flex-start;
                  text-align: left;
                }

                .timestamp {
                  font-size: 0.8em;
                  color: #6c757d;
                  position: absolute;
                  bottom: -15px;
                  right: 10px;
                }

                /* Conteneur de saisie des messages */
                .message-input-container {
                  display: flex;
                  align-items: center;
                  padding: 10px;
                  background-color: #ffffff;
                  border-top: 1px solid #ddd;
                  transition: background-color 0.3s;
                  flex-shrink: 0; /* Empêche le conteneur de rétrécir */
                }

                /* Champ de saisie */
                .message-input-container textarea {
                  flex: 1;
                  resize: none;
                  border: 1px solid #ddd;
                  border-radius: 20px;
                  padding: 10px 15px;
                  font-size: 1rem;
                  outline: none;
                  transition: border-color 0.3s, background-color 0.3s;
                  height: 40px;
                  max-height: 100px;
                }

                /* Focus sur le champ de saisie */
                .message-input-container textarea:focus {
                  border-color: #0084ff;
                  background-color: #f1f1f1;
                }

                /* Bouton d'envoi */
                .message-input-container button {
                  background-color: #0084ff;
                  border: none;
                  border-radius: 50%;
                  width: 45px;
                  height: 45px;
                  margin-left: 10px;
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  cursor: pointer;
                  transition: background-color 0.3s;
                }

                .message-input-container button:hover {
                  background-color: #006bbd;
                }

                /* Icône d'envoi */
                .message-input-container button svg {
                  fill: white;
                  width: 20px;
                  height: 20px;
                }

                /* Lien de retour */
                .back-link {
                  display: block;
                  text-align: center;
                  padding: 10px;
                  background-color: #f4f4f4;
                  text-decoration: none;
                  color: #0084ff;
                  font-weight: bold;
                  border-top: 1px solid #ddd;
                  transition: background-color 0.3s, color 0.3s;
                }

                .back-link:hover {
                  background-color: #eaeaea;
                  color: #0056b3;
                }

                /* Bouton de basculement du mode sombre */
                .dark-mode-toggle {
                  display: block;
                  margin: 10px auto;
                  padding: 10px 20px;
                  background-color: #6c757d;
                  color: white;
                  border: none;
                  border-radius: 20px;
                  cursor: pointer;
                  transition: background-color 0.3s;
                }

                .dark-mode-toggle:hover {
                  background-color: #5a6268;
                }

                /* Mode sombre */
                body.dark {
                  background-color: #121212;
                  color: #ffffff;
                }

                body.dark h2 {
                  background-color: #1e88e5;
                }

                body.dark .messages-container {
                  background-color: #1e1e1e;
                  background-image: none;
                }

                body.dark .message.sent {
                  background-color: #054740;
                }

                body.dark .message.received {
                  background-color: #333333;
                }

                body.dark .timestamp {
                  color: #ccc;
                }

                body.dark .message-input-container {
                  background-color: #1e1e1e;
                  border-top: 1px solid #333;
                }

                body.dark .message-input-container textarea {
                  background-color: #333333;
                  color: #ffffff;
                  border: 1px solid #555;
                }

                body.dark .message-input-container textarea:focus {
                  border-color: #1e88e5;
                  background-color: #444444;
                }

                body.dark .message-input-container button {
                  background-color: #1e88e5;
                }

                body.dark .message-input-container button:hover {
                  background-color: #1565c0;
                }

                body.dark .back-link {
                  background-color: #1e1e1e;
                  color: #1e88e5;
                  border-top: 1px solid #333;
                }

                body.dark .back-link:hover {
                  background-color: #333333;
                  color: #63a1ff;
                }

                body.dark .dark-mode-toggle {
                  background-color: #343a40;
                }

                body.dark .dark-mode-toggle:hover {
                  background-color: #23272b;
                }

                /* Scrollbar personnalisé */
                .messages-container::-webkit-scrollbar {
                  width: 8px;
                }

                .messages-container::-webkit-scrollbar-track {
                  background: transparent;
                }

                .messages-container::-webkit-scrollbar-thumb {
                  background-color: rgba(0, 0, 0, 0.2);
                  border-radius: 4px;
                }

                /* Responsive Design */

                /* Pour les tablettes en mode paysage et petits écrans d'ordinateur */
                @media (max-width: 1024px) {
                  .messages-container {
                    padding: 15px;
                  }

                  .message {
                    max-width: 80%;
                  }

                  h2 {
                    font-size: 1.4rem;
                  }
                }

                /* Pour les écrans de moyenne taille (mobiles en mode paysage et tablettes) */
                @media (max-width: 768px) {
                  .messages-container {
                    padding: 10px;
                  }

                  .message {
                    max-width: 85%;
                  }

                  .message-input-container textarea {
                    font-size: 0.95rem;
                    height: 45px;
                  }

                  .message-input-container button {
                    width: 40px;
                    height: 40px;
                  }

                  .message-input-container button svg {
                    width: 18px;
                    height: 18px;
                  }

                  .back-link, .dark-mode-toggle {
                    padding: 12px 24px;
                    font-size: 1rem;
                  }
                }

                /* Pour les petits écrans (mobiles en mode portrait) */
                @media (max-width: 480px) {
                  h2 {
                    font-size: 1.2rem;
                  }

                  .message {
                    max-width: 95%;
                    padding: 10px 15px;
                    font-size: 0.9rem;
                  }

                  .timestamp {
                    font-size: 0.7em;
                    bottom: -12px;
                    right: 8px;
                  }

                  .message-input-container {
                    padding: 8px;
                  }

                  .message-input-container textarea {
                    font-size: 0.85rem;
                    height: 35px;
                  }

                  .message-input-container button {
                    width: 35px;
                    height: 35px;
                    margin-left: 8px;
                  }

                  .message-input-container button svg {
                    width: 16px;
                    height: 16px;
                  }

                  .back-link, .dark-mode-toggle {
                    padding: 10px 18px;
                    font-size: 0.9rem;
                  }
                }

                /* Pour les très grands écrans */
                @media (min-width: 1200px) {
                  .messages-container {
                    padding: 25px;
                  }

                  .message {
                    max-width: 65%;
                  }

                  .message-input-container textarea {
                    font-size: 1.1rem;
                    height: 50px;
                  }

                  .message-input-container button {
                    width: 50px;
                    height: 50px;
                  }

                  .message-input-container button svg {
                    width: 22px;
                    height: 22px;
                  }

                  h2 {
                    font-size: 1.8rem;
                  }
                }

        </style>
      </head>
      <body>
        <h2>Messages échangés avec ${receiver.username}</h2>
        <div class="messages-container">
          <ul>
    `;

    messages.forEach(message => {
      const sender = message.sender_id === senderId ? "Vous" : receiver.username;
      const messageClass = message.sender_id === senderId ? "sent" : "received";

      messagesHTML += `
        <li class="message ${messageClass}">
          <strong>${sender}:</strong> ${message.message} <br>
          <span class="timestamp">Envoyé le ${new Date(message.created_at).toLocaleString()}</span>
        </li>
      `;
    });

    messagesHTML += `
          </ul>
        </div>
        <div class="message-input-container">
          <form action="/send-message/${receiverId}" method="POST" style="display: flex; width: 100%;">
            <textarea name="message" placeholder="Votre message" required></textarea>
            <button type="submit">
              <!-- Icône d'envoi (avion en papier) -->
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                <path fill="currentColor" d="M2.01 21L23 12 2.01 3v7l15 2-15 2v7z"/>
              </svg>
            </button>
          </form>
        </div>
        <a href="/users" class="back-link">Retour à la liste des utilisateurs</a>
        <button onclick="toggleDarkMode()" class="dark-mode-toggle">Basculer le mode sombre</button>
      </body>
      <script>
        function toggleDarkMode() {
          document.body.classList.toggle('dark');
          // Sauvegarder l'état du mode sombre dans localStorage
          if (document.body.classList.contains('dark')) {
            localStorage.setItem('darkMode', 'enabled');
          } else {
            localStorage.setItem('darkMode', 'disabled');
          }
        }

        // Appliquer le mode sombre en fonction de ce qui est sauvegardé
        window.onload = function() {
          const darkMode = localStorage.getItem('darkMode');
          if (darkMode === 'enabled') {
            document.body.classList.add('dark');
          }
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

// Traitement de l'envoi des messages
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

// Route de déconnexion
app.get('/logout', (req, res) => {
  req.session.destroy(err => {
    if (err) {
      return res.status(500).send('Erreur lors de la déconnexion.');
    }
    res.redirect('/login');
  });
});

// Démarrage du serveur
app.listen(port, () => {
  console.log(`Serveur à l'écoute sur http://localhost:${port}`);
});