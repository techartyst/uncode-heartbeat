const express = require('express');
const app = express();
require('dotenv').config();
const axios = require('axios');
const mongoose = require('mongoose');
const Agenda = require('agenda');

const apiKey = process.env.ETHER_APIKEY;
const baseUrl = "https://api.etherscan.io/api";
const dbHost = process.env.DB_HOST;
//const mongoConnectionString = `${dbHost}/agenda`;

// MongoDB connection setup
const connectDB = async () => {
    try {
        await mongoose.connect(dbHost);
        console.log('MongoDB connected successfully');
    } catch (err) {
        console.error('Failed to connect to MongoDB:', err.message);
        process.exit(1);
    }
};
connectDB();

// Define the schema for gas fees
const heartbeatSchema = new mongoose.Schema({
    date: Date,
    hour: Number,
    BTCGasFee: Number,
    ETHGasFee: Number
});

// Model from schema
const Heartbeat = mongoose.model('Heartbeat', heartbeatSchema);

// Fetch BTC Gas Fees
async function fetchBTCFees() {
    const url = 'https://blockstream.info/api/fee-estimates';
    try {
        const response = await axios.get(url);
       // console.log(`Fastest Fee (Next Block): ${response.data['1']} sats/vB`);
        return response.data['1'];
    } catch (error) {
        console.error("Error fetching Bitcoin fees:", error.message);
        return null;
    }
}

// Fetch ETH Gas Prices
async function fetchETHGasPrices() {
    try {
        const response = await axios.get(`${baseUrl}?module=gastracker&action=gasoracle&apikey=${apiKey}`);
        const prices = response.data.result;
        const avgPrice = (parseInt(prices.SafeGasPrice) + parseInt(prices.ProposeGasPrice) + parseInt(prices.FastGasPrice)) / 3;
        console.log(`Average Gas Price: ${avgPrice}`);
        return avgPrice;
    } catch (error) {
        console.error("Error fetching Ethereum gas prices:", error.message);
        return null;
    }
}

// Save gas fees to the database
async function saveGasFees() {
    console.log('Starting to fetch and save gas fees...');
    const [btcFee, ethFee] = await Promise.all([fetchBTCFees(), fetchETHGasPrices()]);

    if (!btcFee || !ethFee) {
        console.error('Failed to fetch gas fees, not saving data');
        return;
    }

    const now = new Date();
    const heartBeatEntry = new Heartbeat({
        date: now,
        hour: now.getHours(),
        BTCGasFee: btcFee,
        ETHGasFee: ethFee
    });

    try {
        await heartBeatEntry.save();
        console.log("Gas fees saved to MongoDB successfully");
    } catch (error) {
        console.error("Error saving gas fees to MongoDB:", error.message);
    }
}

// Fetch and log the last 200 gas fee records from the database
async function getFees() {
    try {
        const lastFees = await Heartbeat.find().sort({ date: -1 })

        if (!lastFees || lastFees.length === 0) {
            console.error('No gas fee records found in the database');
            return;
        }

        console.log('Last 200 gas fee records:');
        lastFees.forEach((record, index) => {
            console.log(
                `Record ${index + 1}: Date: ${record.date}, Hour: ${record.hour}, BTC Gas Fee: ${record.BTCGasFee} sats/vB, ETH Gas Fee: ${record.ETHGasFee} gwei`
            );
        });

        return lastFees;
    } catch (error) {
        console.error('Error fetching last 200 gas fees from the database:', error.message);
        return null;
    }
}

// Define the API route to get fees
app.get('/fees', async (req, res) => {
    try {
        const fees = await getFees();
        res.json(fees);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch fees' });
    }
});


// Setup Agenda
const agenda = new Agenda({db: {address: dbHost, collection: 'jobs'}});

agenda.define('save gas fees', async job => {
    await saveGasFees();
});

(async function() {
    await agenda.start();
    await agenda.every('1 hour', 'save gas fees');
    console.log('Agenda job scheduled to save gas fees every hour');
})();

// Server setup
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
