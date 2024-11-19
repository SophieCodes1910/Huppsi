import express from 'express';
import session from 'express-session';
import path from 'path';
import { fileURLToPath } from 'url';
import multer from 'multer';
import eventRoutes from './routes/Event.mjs';
import { loginUser, registerUser } from './src/firebase.mjs';

const app = express();
const PORT = 3000;

// Path configurations
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configure Multer for file uploads
const upload = multer({ dest: path.join(__dirname, 'uploads') });

// Middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use(express.static(path.join(__dirname, 'public')));
app.set('view engine', 'ejs');
app.use(
    session({
        secret: 'your_secret_key', // Replace with a secure secret
        resave: false,
        saveUninitialized: false, // Only save sessions when necessary
        cookie: { secure: false }, // Set to true in production with HTTPS
    })
);

// Authentication middleware
function isAuthenticated(req, res, next) {
    console.log('Session data:', req.session); // Debugging session
    if (req.session.user) return next();
    res.redirect('/login');
}

// Routes
app.get('/', async (req, res) => {
    try {
        const events = []; // Replace with your logic to fetch events
        res.render('index', { events });
    } catch (error) {
        console.error('Error fetching events:', error.message);
        res.render('index', { events: [] });
    }
});

// Login route
app.get('/login', (req, res) => res.render('Login', { error: null }));

app.post('/login', async (req, res) => {
    const { email, password } = req.body;

    console.log('Login attempt with email:', email); // Debugging

    try {
        const user = await loginUser(email, password);
        req.session.user = user.uid;
        req.session.userEmail = email;
        console.log('User successfully logged in:', user.uid);
        res.redirect('/Event/Events');
    } catch (error) {
        console.error('Login error:', error.message);
        res.status(401).render('Login', { error: 'Invalid email or password' });
    }
});

// Register route
app.get('/register', (req, res) => res.render('Register', { error: null }));

app.post('/register', async (req, res) => {
    const { email, password } = req.body;

    console.log('Registration attempt with email:', email); // Debugging

    try {
        const user = await registerUser(email, password);
        req.session.user = user.uid;
        res.redirect('/Event/Events');
    } catch (error) {
        console.error('Registration error:', error.message);
        res.status(500).render('Register', { error: 'Registration failed' });
    }
});

// Event routes
app.use('/Event', isAuthenticated, eventRoutes);

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
