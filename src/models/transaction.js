const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
    player_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Player', required: true },
    usd_amount: { type: Number, required: true }, // Can be positive (payout) or negative (bet)
    crypto_amount: { type: Number, required: true },
    currency: { type: String, required: true },
    transaction_type: { type: String, enum: ['bet', 'cashout'], required: true },
    transaction_hash: { type: String, required: true, unique: true },
    price_at_time: { type: Number, required: true },
    timestamp: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Transaction', transactionSchema);