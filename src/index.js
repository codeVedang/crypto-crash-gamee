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
        // PHASE 1: BETTING (5 seconds)
        const round = await startNewRound();
        io.emit('betting_phase_start', { round_id: round.round_id, duration: 5000 });
        console.log(`Round #${round.round_id} betting has started.`);
        await new Promise(resolve => setTimeout(resolve, 5000));

        // PHASE 2: GAME RUNNING
        io.emit('round_start', { round_id: round.round_id, seed_hash: round.hash });
        console.log(`Round #${round.round_id} is running.`);
        
        let multiplier = 1.00;
        
        // This is a self-correcting loop that runs every 100ms
        const runRound = () => {
            multiplier += 0.03;
            round.current_multiplier = parseFloat(multiplier.toFixed(2));
            io.emit('multiplier_update', { multiplier: multiplier.toFixed(2) });

            if (multiplier < round.crash_point) {
                setTimeout(runRound, 100); // Continue the current round
            } else {
                // The round has crashed
                round.end_time = new Date();
                io.emit('round_crash', { crash_point: round.crash_point.toFixed(2) });
                console.log(`Round #${round.round_id} crashed at ${round.crash_point.toFixed(2)}x. Scheduling next round.`);

                // Save the round and schedule the next full game loop
                round.save().catch(err => console.error("Failed to save round data:", err));
                setTimeout(gameLoop, 5000);
            }
        };
        
        runRound(); // Start the multiplier loop

    } catch (error) {
        console.error('A critical error occurred and the game loop will restart:', error);
        setTimeout(gameLoop, 5000); // Attempt to restart the loop even on critical failure
    }
};

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
    gameLoop();
});