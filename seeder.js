const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Player = require('./src/models/player');

dotenv.config();

const connectDB = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('MongoDB Connected...');
    } catch (err) {
        console.error(err.message);
        process.exit(1);
    }
};

const importData = async () => {
    try {
        await Player.deleteMany();

        const samplePlayers = [
            { name: 'PlayerOne', wallet: { balance_usd: 1000 } },
            { name: 'PlayerTwo', wallet: { balance_usd: 1500 } },
            { name: 'CaptainCrash', wallet: { balance_usd: 500 } },
        ];

        await Player.insertMany(samplePlayers);

        console.log('Data Imported!');
        process.exit();
    } catch (error) {
        console.error(`${error}`);
        process.exit(1);
    }
};

const destroyData = async () => {
    try {
        await Player.deleteMany();
        console.log('Data Destroyed!');
        process.exit();
    } catch (error) {
        console.error(`${error}`);
        process.exit(1);
    }
};

const run = async () => {
    await connectDB();
    if (process.argv[2] === '-d') {
        await destroyData();
    } else {
        await importData();
    }
};

run();