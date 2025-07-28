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

    // Handle cashout requests directly via WebSocket for low latency [cite: 66]
    socket.on('cashout', async (data) => {
        try {
            const { playerId } = data;
            const currentMultiplier = getCurrentRound() ? getCurrentRound().current_multiplier : 0;
            const result = await processCashout(playerId, currentMultiplier);
            // Notify the specific user of success
            socket.emit('cashout_success', result);
            // Broadcast to all users that this player cashed out
            io.emit('player_cashed_out', {
                playerId: result.playerId,
                username: result.username,
                cashoutMultiplier: result.cashoutMultiplier,
                payoutUsd: result.payoutUsd
            });
        } catch (error) {
            // Notify the specific user of the error
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
        io.emit('round_start', { round_id: round.round_id, seed_hash: round.hash });

        let multiplier = 1.00;
        const roundInterval = setInterval(() => {
            multiplier += 0.01 * (multiplier * 0.1);
            round.current_multiplier = parseFloat(multiplier.toFixed(2)); // Store current multiplier

            io.emit('multiplier_update', { multiplier: multiplier.toFixed(2) });

            if (multiplier >= round.crash_point) {
                clearInterval(roundInterval);
                round.end_time = new Date();
                round.save();
                io.emit('round_crash', { crash_point: round.crash_point.toFixed(2) });
                setTimeout(gameLoop, 10000);
            }
        }, 100);

    } catch (error) {
        console.error('An error occurred in the game loop:', error);
        setTimeout(gameLoop, 10000);
    }
};

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
    gameLoop();
});