require('dotenv').config();

const express = require('express');
const http = require('http');
const mongoose = require('mongoose');
const socketIo = require('socket.io');
const cors = require('cors');
const { startNewRound, getCurrentRound, processCashout } = require('./services/gameService');

const app = express();
const server = http.createServer(app);

const io = socketIo(server, {
    cors: { origin: "*", methods: ["GET", "POST"] }
});

// --- Middleware ---
app.use(cors());
app.use(express.json());
app.use(express.static('public'));
// Make `io` accessible to our routes
app.use((req, res, next) => {
    req.io = io;
    next();
});

// --- API Routes ---
app.use('/api', require('./routes/api'));

// --- Database Connection ---
mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log('MongoDB connected successfully.'))
    .catch(err => console.error('MongoDB connection error:', err));

// --- WebSocket Connection Handling ---
io.on('connection', (socket) => {
    console.log(`A user connected with socket ID: ${socket.id}`);

    
 socket.on('cashout', async (data) => {
    try {
        
        const { playerId, roundId } = data;
        const currentMultiplier = getCurrentRound() ? getCurrentRound().current_multiplier : 0;

   
        const result = await processCashout(playerId, currentMultiplier, roundId);

        

    } catch (error) {
        socket.emit('cashout_error', { message: error.message });
    }
});

    socket.on('disconnect', () => {
        console.log(`User with socket ID: ${socket.id} disconnected.`);
    });
});

// --- Core Game Loop ---
const gameLoop = async () => {
    try {
     
        const round = await startNewRound();
        console.log(`Round #${round.round_id} betting phase started.`);
        io.emit('betting_phase_start', { round_id: round.round_id, duration: 5000 });

    
        await new Promise(resolve => setTimeout(resolve, 5000));

     
        console.log(`Round #${round.round_id} running.`);
        io.emit('round_start', { round_id: round.round_id, seed_hash: round.hash });

        let multiplier = 1.00;
        const roundInterval = setInterval(() => {
            multiplier += 0.03;
            round.current_multiplier = parseFloat(multiplier.toFixed(2));

            io.emit('multiplier_update', { multiplier: multiplier.toFixed(2) });

            if (multiplier >= round.crash_point) {
                clearInterval(roundInterval);
                round.end_time = new Date();
                round.save();
                io.emit('round_crash', { crash_point: round.crash_point.toFixed(2) });
                console.log(`Round #${round.round_id} crashed.`);

               
                setTimeout(gameLoop, 5000);
            }
        }, 100);

    } catch (error) {
        console.error('An error occurred in the game loop:', error);
        setTimeout(gameLoop, 5000);
    }
};

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
    gameLoop();
});