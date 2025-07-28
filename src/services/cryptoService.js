const axios = require('axios');

const priceCache = new Map();
const CACHE_TTL = 10000; // 10 seconds

const getCryptoPrice = async (currency = 'BTC') => {
    const now = Date.now();
    const currencyKey = currency.toLowerCase();
    const coinId = currencyKey === 'btc' ? 'bitcoin' : 'ethereum';

    if (priceCache.has(coinId) && (now - priceCache.get(coinId).timestamp < CACHE_TTL)) {
        return priceCache.get(coinId).price;
    }

    try {
        const response = await axios.get(`https://api.coingecko.com/api/v3/simple/price?ids=${coinId}&vs_currencies=usd`);
        const price = response.data[coinId].usd;
        
        priceCache.set(coinId, { price, timestamp: now });
        return price;
    } catch (error) {
        console.error('Error fetching crypto price:', error.message);
        // On error, return the last cached price if available
        return priceCache.has(coinId) ? priceCache.get(coinId).price : null;
    }
};

module.exports = { getCryptoPrice };