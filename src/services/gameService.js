const crypto = require('crypto');
const mongoose = require('mongoose');
const GameRound = require('../models/gameRound');
const Player = require('../models/player');
const Transaction = require('../models/transaction');
const { getCryptoPrice } = require('./cryptoService');

let currentRound = null;

const generateCrashPoint = (seed, roundNumber) => {
    const hash = crypto.createHmac('sha256', seed).update(String(roundNumber)).digest('hex');
    const integerFromHash = parseInt(hash.substring(0, 8), 16);
    const e = Math.pow(2, 32);
    const crashPoint = Math.floor((100 * e - integerFromHash) / (e - integerFromHash)) / 100;
    return { hash, crashPoint: Math.max(1.00, crashPoint) };
};

const startNewRound = async () => {
    const lastRound = await GameRound.findOne().sort({ start_time: -1 });
    const roundCounter = lastRound ? lastRound.round_id + 1 : 1;
    
    const seed = crypto.randomBytes(16).toString('hex');
    const { hash, crashPoint } = generateCrashPoint(seed, roundCounter);

    currentRound = new GameRound({
        round_id: roundCounter,
        crash_point: crashPoint,
        seed: seed,
        hash: hash
    });
    await currentRound.save();
    return currentRound;
};

const getCurrentRound = () => currentRound;

const processCashout = async (playerId, cashoutMultiplier) => {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        const round = getCurrentRound();
        if (!round) throw new Error('No active round.');

        // Find the specific bet for this player in the current round
        const bet = round.bets.find(b => b.player_id.toString() === playerId.toString());

        if (!bet) throw new Error('Active bet not found for this player in the current round.');
        if (bet.cashout_multiplier) throw new Error('Already cashed out.');
        if (cashoutMultiplier >= round.crash_point) throw new Error('Too late! The game crashed.');

        const price = await getCryptoPrice(bet.currency);
        if (!price) throw new Error('Could not retrieve crypto price for payout.');

        const payoutCrypto = bet.bet_amount_crypto * cashoutMultiplier;
        const payoutUsd = payoutCrypto * price;

        bet.cashout_multiplier = cashoutMultiplier;
        bet.payout_usd = payoutUsd;

        const player = await Player.findById(playerId).session(session);
        if (!player) throw new Error('Player not found.');

        player.wallet.balance_usd += payoutUsd;

        // Use Promise.all to save both documents concurrently
        await Promise.all([round.save({ session }), player.save({ session })]);

        await session.commitTransaction();

        return {
            message: 'Cashed out successfully!',
            playerId: player._id,
            username: player.name,
            cashoutMultiplier: cashoutMultiplier,
            payoutUsd: payoutUsd.toFixed(2),
            newBalanceUsd: player.wallet.balance_usd.toFixed(2)
        };
    } catch (error) {
        await session.abortTransaction();
        throw error;
    } finally {
        session.endSession();
    }
};

module.exports = { startNewRound, getCurrentRound, processCashout };