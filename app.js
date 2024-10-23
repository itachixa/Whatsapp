const express = require("express");
const bodyParser = require("body-parser");
const bcrypt = require("bcryptjs");
const { Pool } = require("pg");
const path = require("path");
const session = require("express-session");

const app = express();
const port = 3000;

const pool = new Pool({
  connectionString:
    "postgresql://neondb_owner:JXTGM9RE1BjH@ep-late-bread-a29sphep-pooler.eu-central-1.aws.neon.tech/utilisateursdb?sslmode=require",
  ssl: { rejectUnauthorized: false },
});

app.use(bodyParser.urlencoded({ extended: false }));
app.use(express.static("public"));

app.use(
  session({
    secret: "votre_secret",
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false },
  })
);

// Route d'accueil
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "views", "index.html"));
});

// Route d'inscription
app.get("/register", (req, res) => {
  res.sendFile(path.join(__dirname, "views", "register.html"));
});

// Route de connexion
app.get("/login", (req, res) => {
  if (req.session.userId) {
    return res.redirect("/users");
  }
  res.sendFile(path.join(__dirname, "views", "login.html"));
});

// Traitement de l'inscription
app.post("/register", async (req, res) => {
  const { username, email, password } = req.body;

  try {
    const result = await pool.query(
      "SELECT * FROM utilisateurs WHERE email = $1",
      [email]
    );
    if (result.rows.length > 0) {
      return res.send("Cet email est déjà utilisé.");
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    await pool.query(
      "INSERT INTO utilisateurs (username, email, password) VALUES ($1, $2, $3)",
      [username, email, hashedPassword]
    );

    res.redirect("/login");
  } catch (error) {
    console.error("Erreur lors de l'enregistrement:", error);
    res.status(500).send("Erreur lors de l'enregistrement.");
  }
});

// Traitement de la connexion
app.post("/login", async (req, res) => {
  const { email, password } = req.body;

  try {
    const result = await pool.query(
      "SELECT * FROM utilisateurs WHERE email = $1",
      [email]
    );

    if (result.rows.length === 0) {
      return res.send("Email ou mot de passe incorrect.");
    }

    const user = result.rows[0];
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.send("Email ou mot de passe incorrect.");
    }

    req.session.userId = user.id;
    req.session.username = user.username;
    res.redirect("/users");
  } catch (error) {
    console.error("Erreur lors de la connexion:", error);
    res.status(500).send("Erreur lors de la connexion.");
  }
});

// Route pour la liste des utilisateurs
app.get("/users", async (req, res) => {
  if (!req.session.userId) {
    return res.redirect("/login");
  }

  try {
    const result = await pool.query(
      "SELECT id, username FROM utilisateurs WHERE id != $1",
      [req.session.userId]
    );
    const users = result.rows;

    let usersHTML = `
      <html>
      <head>
        <title>Liste des utilisateurs</title>
        <style>
        /* Styles de base */
body {
  font-family: 'Arial', sans-serif;
  background-color: #f4f4f4; /* Couleur de fond claire */
  margin: 0;
  padding: 20px;
  transition: background-color 0.3s, color 0.3s;
  display: flex;
  flex-direction: column;
  min-height: 100vh;
}

h2 {
  color: #333;
  text-align: center;
  margin-bottom: 20px;
  font-size: 2rem;
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
  background-color: #dc3545; /* Rouge pour le bouton de déconnexion */
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
  background-color: #c82333; /* Rouge foncé au survol */
}

/* Bouton de basculement du mode sombre */
.dark-mode-toggle {
  display: block;
  margin: 20px auto;
  padding: 10px 20px;
  background-color: #6c757d; /* Couleur neutre pour le bouton */
  color: white;
  border: none;
  border-radius: 20px;
  cursor: pointer;
  transition: background-color 0.3s;
  font-size: 1rem;
}

.dark-mode-toggle:hover {
  background-color: #5a6268; /* Couleur légèrement plus foncée au survol */
}

/* Mode sombre */
body.dark {
  background-color: #121212; /* Couleur sombre */
  color: #ffffff; /* Texte blanc */
}

body.dark h2 {
  color: #ffffff; /* Titre blanc en mode sombre */
}

body.dark ul {
  background-color: #1e1e1e; /* Fond sombre pour les listes */
}

body.dark li {
  background: #1e1e1e; /* Fond sombre pour les éléments de liste */
  color: #ffffff; /* Texte blanc */
  box-shadow: 0 2px 5px rgba(255, 255, 255, 0.1);
}

body.dark a {
  color: #1e90ff; /* Couleur bleue pour les liens en mode sombre */
}

body.dark a:hover {
  color: #63a1ff; /* Couleur bleue claire au survol */
}

body.dark a:visited {
  color: #66b2ff; /* Couleur pour les liens visités en mode sombre */
}

body.dark .logout-link {
  background-color: #28a745; /* Vert pour le bouton de déconnexion en mode sombre */
}

body.dark .logout-link:hover {
  background-color: #218838; /* Vert foncé au survol */
}

body.dark .dark-mode-toggle {
  background-color: #343a40; /* Couleur sombre pour le bouton */
}

body.dark .dark-mode-toggle:hover {
  background-color: #23272b; /* Couleur légèrement plus foncée au survol */
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

/* Division en deux colonnes */
.container {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 20px; /* Espacement entre les colonnes */
}

/* Colonne de gauche (données personnelles) */
.left-column {
  width: 30%; /* Largeur de la colonne gauche */
  height: 500px; /* Hauteur fixe pour la colonne gauche */
  padding: 15px;
  background-color: #fff;
  border-radius: 8px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
}

.right-column {
  width: 70%; /* Largeur de la colonne droite */
  height: 600px; /* Hauteur fixe pour la colonne droite */
  padding: 15px;
  background-color: #fff;
  border-radius: 8px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
  overflow-y: auto; /* Ajoute un défilement vertical si nécessaire */
}

@media (max-width: 768px) {
  .left-column, .right-column {
    width: 100%; /* Les colonnes prennent 100% de la largeur sur les écrans plus petits */
    height: auto; /* Retire la hauteur fixe sur les petits écrans */
  }

  .container {
    flex-direction: column; /* Les colonnes s'empilent verticalement */
  }
}

h2 {
  font-size: 1.5em;
  margin-bottom: 10px;
}

.user-info ul {
  list-style-type: none; /* Retire les puces */
  padding: 0; /* Supprime le padding */
}

.user-info li {
  margin-bottom: 5px; /* Espace entre les éléments */
}

a {
  display: block; /* Fait que les liens prennent toute la largeur */
  margin: 5px 0; /* Espace entre les liens */
  text-decoration: none; /* Supprime le soulignement */
  color: #007BFF; /* Couleur des liens */
}

a:hover {
  text-decoration: underline; /*Voici le CSS modifié avec des couleurs et des hauteurs spécifiques pour les colonnes gauche et droite. J'ai inclus des commentaires pour clarifier les sections :
  }

/* Styles de base */
body {
  font-family: 'Arial', sans-serif;
  background-color: #f4f4f4;
  margin: 0;
  padding: 20px;
  transition: background-color 0.3s, color 0.3s;
  display: flex;
  flex-direction: column;
  min-height: 100vh;
}

h2 {
  color: #333;
  text-align: center;
  margin-bottom: 20px;
  font-size: 2rem;
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

/* Division en deux colonnes */
.container {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 20px;
}

/* Colonne de gauche (données personnelles) */
.left-column {
  width: 30%; /* Largeur de la colonne gauche */
  height: 400px; /* Hauteur fixe pour la colonne gauche */
  padding: 15px;
  background-color: #f8f9fa; /* Couleur de fond pour la colonne gauche */
  border-radius: 8px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
}

/* Colonne de droite (autres informations) */
.right-column {
  width: 70%; /* Largeur de la colonne droite */
  height: 400px; /* Hauteur fixe pour la colonne droite */
  padding: 15px;
  background-color: #e9ecef; /* Couleur de fond pour la colonne droite */
  border-radius: 8px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
  overflow-y: auto; /* Ajoute un défilement vertical si nécessaire */
}

@media (max-width: 768px) {
  .left-column, .right-column {
    width: 100%; /* Les colonnes prennent 100% de la largeur sur les écrans plus petits */
    height: auto; /* Retire la limite de hauteur pour les petits écrans */
  }

  .container {
    flex-direction: column; /* Les colonnes s'empilent verticalement */
  }
}

h2 {
  font-size: 1.5em;
  margin-bottom: 10px;
}

.user-info ul {
  list-style-type: none; /* Retire les puces */
  padding: 0; /* Supprime le padding */
}

.user-info li {
  margin-bottom: 5px; /* Espace entre les éléments */
}

a {
  display: block; /* Fait que les liens prennent toute la largeur */
  margin: 5px 0; /* Espace entre les liens */
  text-decoration: none; /* Supprime le soulignement */
  color: #007BFF; /* Couleur des liens */
}

a:hover {
  text-decoration: underline; /* Soulignement au survol */
}

.logout-link {
  color: red; /* Couleur du lien de déconnexion */
}

.dark {
  background-color: #333; /* Couleur de fond pour le mode sombre */
  color: white; /* Couleur du texte pour le mode sombre */
}

.dark a {
  color: #00BFFF; /* Couleur des liens en mode sombre */
}
        </style>
      </head>
<body>
    <div class="container">
        <div class="left-column">
            <h2>Mes Informations</h2>
            <div class="user-info">
                <ul>
                    <li>ID: ${req.session.userId}</li>
                    <li>Nom d'utilisateur: ${req.session.username}</li>
                    <li>Email: ${req.session.email}</li>
                </ul>
            </div>
            <h2>Options</h2>
            <a href="/profile">Mon Profil</a>
            <a href="/settings">Paramètres</a>
        </div>

        <div class="right-column">
            <h2>Liste des utilisateurs</h2>
            <ul>
                `;

    users.forEach((user) => {
      usersHTML += `<li><a href="/messages/${user.id}">${user.username}</a></li>`;
    });

    usersHTML += `
            </ul>
            <a href="/logout" class="logout-link">Se déconnecter</a>
            <button onclick="toggleDarkMode()" class="dark-mode-toggle">Basculer le mode sombre</button>
        </div>
    </div>

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
</body>
</html>

    `;

    res.send(usersHTML);
  } catch (error) {
    console.error("Erreur lors de la récupération des utilisateurs:", error);
    res.status(500).send("Erreur lors de la récupération des utilisateurs.");
  }
});

// Route pour afficher les messages échangés avec un utilisateur spécifique
app.get("/messages/:id", async (req, res) => {
  const receiverId = req.params.id;
  const senderId = req.session.userId;

  if (!senderId) {
    return res.redirect("/login");
  }

  try {
    const userResult = await pool.query(
      "SELECT username FROM utilisateurs WHERE id = $1",
      [receiverId]
    );
    const receiver = userResult.rows[0];

    if (!receiver) {
      return res.status(404).send("Utilisateur non trouvé.");
    }

    const result = await pool.query(
      `
      SELECT * FROM messages
      WHERE (sender_id = $1 AND receiver_id = $2) 
      OR (sender_id = $2 AND receiver_id = $1)
      ORDER BY created_at ASC
    `,
      [senderId, receiverId]
    );

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
  background-color: #6a0dad; /* Couleur violette */
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  transition: background-color 0.3s, color 0.3s;
  color: white; /* Texte en blanc par défaut */
}

h2 {
  background-color: #6a0dad; /* Couleur violette */
  color: white;
  padding: 15px;
  text-align: center;
  margin: 0;
  font-size: 1.5rem;
}

.messages-container {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
  background-color: #fff; /* Couleur de fond blanche pour la zone de message */
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
    background-color: #d4edda;
    align-self: flex-end;
    text-align: right;
}

.received {
    background-color: #343a40;
    color: #ffffff;
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


.message-input-container {
  display: flex;
  align-items: center;
  padding: 10px;
  background-color: #fff; /* Fond blanc pour la zone de saisie */
  border-top: 1px solid #ddd;
  flex-shrink: 0; /* Empêche le conteneur de rétrécir */
}

.message-input-container textarea {
  flex: 1;
  resize: none;
  border: 1px solid #ddd;
  border-radius: 20px;
  padding: 10px 15px;
  font-size: 1rem;
  outline: none;
  height: 40px;
  max-height: 100px;
}

.message-input-container button {
  background-color: #6a0dad; /* Couleur violette pour le bouton d'envoi */
  border: none;
  border-radius: 50%;
  width: 45px;
  height: 45px;
  margin-left: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

.message-input-container button:hover {
  background-color: #580f6b; /* Couleur violette plus foncée au survol */
}

.back-link {
  display: block;
  text-align: center;
  padding: 10px;
  background-color: #fff;
  text-decoration: none;
  color: #6a0dad; /* Lien violet */
  font-weight: bold;
  border-top: 1px solid #ddd;
}

.back-link:hover {
  background-color: #eaeaea;
  color: #580f6b; /* Couleur au survol plus foncée */
}

.dark-mode-toggle {
  display: block;
  margin: 10px auto;
  padding: 10px 20px;
  background-color: #6c757d; /* Couleur sombre pour le bouton de mode sombre */
  color: white;
  border: none;
  border-radius: 20px;
  cursor: pointer;
}

.dark-mode-toggle:hover {
  background-color: #5a6268;
}

/* Responsive Design */
.container2 {
  display: flex;
  width: 100%;
  height: 100vh;
}

.left-section {
  flex: 1;
  background-color: #6a0dad; /* Couleur violette */
}

.right-section {
  flex: 3;
  display: flex;
  flex-direction: column;
  background-color: #fff; /* Couleur blanche pour la partie messagerie */
}

/* Liste des utilisateurs */
.user-list {
  list-style-type: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-wrap: nowrap;
  overflow-x: auto; /* Ajouter un défilement horizontal si nécessaire */
  gap: 15px;
}

.user-list li {
  background-color: #6a0dad; /* Couleur violette pour les utilisateurs */
  border-radius: 8px;
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
  padding: 10px 20px;
  transition: transform 0.3s ease, box-shadow 0.3s ease;
  min-width: 120px; /* Largeur minimale pour chaque élément */
}

.user-list li:hover {
  transform: translateY(-5px);
  box-shadow: 0 8px 15px rgba(0, 0, 0, 0.2);
}

.user-list li a {
  text-decoration: none;
  color: white; /* Texte en blanc pour les liens d'utilisateur */
  font-size: 16px;
  font-weight: bold;
}

.user-list li a:hover {
  color: #f4f4f4; /* Couleur au survol pour les liens d'utilisateur */
}

/* Adaptation mobile */
@media (max-width: 768px) {
  .messages-container {
    padding: 15px;
  }

  .message {
    max-width: 80%;
  }

  h2 {
    font-size: 1.4rem;
  }

  .user-list {
    justify-content: center; /* Centrer le contenu */
  }

  .user-list li {
    flex: 0 0 auto; /* Ne pas permettre à l'élément de se réduire */
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

  h2 {
    font-size: 1.8rem;
  }
}

.left-section {
    flex: 1;
    background-color: #f8f9fa; /* Couleur de fond pour la section gauche */
    padding: 20px;
    overflow-y: auto; /* Permet de faire défiler si le contenu dépasse la hauteur */
}

.right-section {
    flex: 2; /* Ajustez la largeur de la section droite */
    display: flex;
    flex-direction: column; /* Pour empiler le conteneur des messages */
}

.messages-container {
    flex: 1; /* Permet à la zone de messages de remplir l'espace restant */
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
        </style>
      </head>
      <body>
 <div class="container2">
          <div class="left-section">
            h2>Liste des utilisateurs</h2>
           <div class="container2">
          <div class="left-section">
            <h2>Utilisateurs</h2>
            <ul class="user-list">
              <li><a href="/messages/1">itachixa12</a></li>
              <li><a href="/messages/2">Itachixa</a></li>
              <li><a href="/messages/3">christian</a></li>
              <li><a href="/messages/4">Zeus_Flutter</a></li>
              <li><a href="/messages/5">hafiz</a></li>
              <li><a href="/messages/6">luffy</a></li>
              <li><a href="/messages/7"Mazurie07 </a></li>
              <li><a href="/messages/8">Gsnyd</a></li>
              <li><a href="/messages/9">Luff</a></li>
              <li><a href="/messages/10">Fallon</a></li>
              <li><a href="/messages/11">Lauriane</a></li>
              <li><a href="/messages/12">Bernadette/a></li>
              <li><a href="/messages/13">Joanfenou</a></li>
              <li><a href="/messages/14">kabirou</a></li>
              <li><a href="/messages/15">jeff</a></li>
              <li><a href="/messages/16">Ghis</a></li>
              <li><a href="/messages/1"7>rolle/a></li>
            </ul>

          </div>

          <div class="right-section">
        <h2>${receiver.username}</h2>
        <div class="messages-container">
          <ul>

          </div>

          <div class="right-section">
        <h2>${receiver.username}</h2>
        <div class="messages-container">
          <ul>
    `;

    messages.forEach((message) => {
      const sender =
        message.sender_id === senderId ? "Vous" : receiver.username;
      const messageClass = message.sender_id === senderId ? "sent" : "received";

      messagesHTML += `
        <li class="message ${messageClass}">
          <strong>${sender}:</strong> ${message.message} <br>
          <span class="timestamp">Envoyé le ${new Date(
            message.created_at
          ).toLocaleString()}</span>
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
        </div>
    </div>

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
    console.error("Erreur lors de la récupération des messages:", error);
    res.status(500).send("Erreur lors de la récupération des messages.");
  }
});

// Traitement de l'envoi des messages
app.post("/send-message/:id", async (req, res) => {
  const senderId = req.session.userId;
  const receiverId = req.params.id;
  const message = req.body.message;

  if (!senderId) {
    return res.redirect("/login");
  }

  try {
    await pool.query(
      "INSERT INTO messages (sender_id, receiver_id, message) VALUES ($1, $2, $3)",
      [senderId, receiverId, message]
    );
    res.redirect(`/messages/${receiverId}`);
  } catch (error) {
    console.error("Erreur lors de l'envoi du message:", error);
    res.status(500).send("Erreur lors de l'envoi du message.");
  }
});

// Route de déconnexion
app.get("/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).send("Erreur lors de la déconnexion.");
    }
    res.redirect("/login");
  });
});

// Démarrage du serveur
app.listen(port, () => {
  console.log(`Serveur à l'écoute sur http://localhost:${port}`);
});
