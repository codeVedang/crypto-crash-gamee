const express = require('express');
const router = express.Router();
const Player = require('../models/player');
const Transaction = require('../models/transaction');
const { getCryptoPrice } = require('../services/cryptoService');
const { getCurrentRound, processCashout } = require('../services/gameService');
const crypto = require('crypto');
const mongoose = require('mongoose');

// POST /api/players - Create a new player
router.post('/players', async (req, res) => {
    try {
        const { name } = req.body;
        if (!name) {
            return res.status(400).json({ message: 'Player name is required.' });
        }
        const newPlayer = new Player({ name });
        await newPlayer.save();
        res.status(201).json(newPlayer);
    } catch (error) {
        res.status(400).json({ message: 'Player name may already be taken.', error: error.message });
    }
});

// GET /api/players/:id/balance - Check player's wallet balance [cite: 46]
router.get('/players/:id/balance', async (req, res) => {
    try {
        const player = await Player.findById(req.params.id);
        if (!player) {
            return res.status(404).json({ message: 'Player not found.' });
        }
        res.status(200).json(player.wallet);
    } catch (error) {
        res.status(500).json({ message: 'Server error.', error: error.message });
    }
});

// POST /api/bet - Place a bet [cite: 24]
router.post('/bet', async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        const { playerId, amountUsd, currency } = req.body;
        const round = getCurrentRound();
        
        if (!round || round.has_started) {
            throw new Error('Betting is currently closed.');
        }

        const price = await getCryptoPrice(currency);
        const cryptoAmount = amountUsd / price;
        const player = await Player.findById(playerId).session(session);

        if (!player || player.wallet.balance_usd < amountUsd) {
            throw new Error('Insufficient funds or player not found.');
        }

        player.wallet.balance_usd -= amountUsd;
        await player.save({ session });

        round.bets.push({
            player_id: playerId,
            bet_amount_usd: amountUsd,
            bet_amount_crypto: cryptoAmount,
            currency: currency
        });
        await round.save({ session });

        await session.commitTransaction();
        res.status(200).json({ message: 'Bet placed successfully', wallet: player.wallet });
    } catch (error) {
        await session.abortTransaction();
        res.status(400).json({ message: error.message });
    } finally {
        session.endSession();
    }
});

// POST /api/cashout - Cash out from the current round [cite: 25]
router.post('/cashout', async (req, res) => {
    try {
        const { playerId } = req.body;
        const round = getCurrentRound();
        const currentMultiplier = round ? round.current_multiplier : 0;

        const result = await processCashout(playerId, currentMultiplier);
        
        // Broadcast the cashout event to all clients [cite: 63]
        req.io.emit('player_cashed_out', {
            playerId: result.playerId,
            username: result.username,
            cashoutMultiplier: result.cashoutMultiplier,
            payoutUsd: result.payoutUsd
        });

        res.status(200).json(result);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

module.exports = router;