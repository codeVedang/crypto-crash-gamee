const axios = require('axios');

// Using a Map to cache prices for different cryptocurrencies
const priceCache = new Map();
const CACHE_TTL = 10000; // 10 seconds in milliseconds

const getCryptoPrice = async (currency = 'BTC') => {
    const now = Date.now();
    const currencyKey = currency.toLowerCase();
    const coinId = currencyKey === 'btc' ? 'bitcoin' : 'ethereum';

    // 1. Check for a valid, non-expired price in the cache
    if (priceCache.has(coinId) && (now - priceCache.get(coinId).timestamp < CACHE_TTL)) {
        // console.log(`Returning cached price for ${coinId}`);
        return priceCache.get(coinId).price;
    }

    // 2. If no valid cache, fetch from the API
    try {
        // console.log(`Fetching new price for ${coinId} from API...`);
        const response = await axios.get(`https://api.coingecko.com/api/v3/simple/price?ids=${coinId}&vs_currencies=usd`);
        const price = response.data[coinId].usd;
        
        // Store the new price and timestamp in the cache
        priceCache.set(coinId, { price, timestamp: now });
        return price;
    } catch (error) {
        console.error(`Error fetching crypto price for ${coinId}:`, error.message);
        
        // 3. On API error, fallback to the last known price from the cache (even if expired)
        if (priceCache.has(coinId)) {
            console.warn(`API failed. Falling back to stale cached price for ${coinId}.`);
            return priceCache.get(coinId).price;
        }
        
        // If there's no cached price at all, the operation fails
        return null;
    }
};

module.exports = { getCryptoPrice };