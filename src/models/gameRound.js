const mongoose = require('mongoose');

const betSchema = new mongoose.Schema({
    player_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Player', required: true },
    bet_amount_usd: { type: Number, required: true },
    bet_amount_crypto: { type: Number, required: true },
    currency: { type: String, required: true },
    cashout_multiplier: { type: Number, default: null },
    payout_usd: { type: Number, default: 0 },
}, { _id: false });

const gameRoundSchema = new mongoose.Schema({
    round_id: { type: Number, required: true, unique: true, index: true },
    crash_point: { type: Number, required: true },
    seed: { type: String, required: true },
    hash: { type: String, required: true },
    bets: [betSchema],
    start_time: { type: Date, default: Date.now },
    end_time: { type: Date }
});

module.exports = mongoose.model('GameRound', gameRoundSchema);