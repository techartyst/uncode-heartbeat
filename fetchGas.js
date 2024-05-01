/**
 * This service handles the retrieval and storage of cryptocurrency gas fees, specifically for Bitcoin and Ethereum.
 * The collected data is utilized by trust.uncode.art to dynamically generate NFTs based on the current gas fees.
 * Developer: Afzal Ibrahim
 */

require('dotenv').config();
const axios = require('axios');
const mongoose = require('mongoose');

const apiKey = process.env.ETHER_APIKEY
const baseUrl = "https://api.etherscan.io/api";
const dbHost = process.env.DB_HOST;

// MongoDB connection
const connectDB = async () => {
    try {
      const db = await mongoose.connect(dbHost, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
      });
      console.log(`mongodb connected ${db.connection.host}`);
    } catch (err) {
      console.log(err);
      process.exit(1);
    }
  };
  connectDB();
  

// Schema definition
const heartbeatSchema = new mongoose.Schema({
    date: Date,
    hour: Number,
    BTCGasFee: Number,
    ETHGasFee: Number
});

// Create a model from the schema
const Heartbeat = mongoose.model('Heartbeat', heartbeatSchema);

// Fethc BTC Gas Fees
async function fetchBTCFees() {
    const url = 'https://blockstream.info/api/fee-estimates';

    try {
        const response = await axios.get(url);
        console.log(`Fastest Fee (Next Block): ${response.data['1']} sats/vB`);
        return response.data['1'];  // Return the fastest fee
    } catch (error) {
        console.error("Error fetching Bitcoin fees:", error);
    }
}

// Fetch gas prices
async function fetchETHGasPrices() {
    try {
        const response = await axios.get(`${baseUrl}?module=gastracker&action=gasoracle&apikey=${apiKey}`);
        const prices = response.data.result;
        const avgPrice = (parseInt(prices.SafeGasPrice) + parseInt(prices.ProposeGasPrice) + parseInt(prices.FastGasPrice)) / 3;
        console.log(`Average Gas Price: ${avgPrice}`);
        return avgPrice;  // Return the average gas price
    } catch (error) {
        console.error("Error fetching gas prices:", error);
    }
}

//Save gas fees
async function saveGasFees() {
    const [btcFee, ethFee] = await Promise.all([fetchBTCFees(), fetchETHGasPrices()]);

    const now = new Date();
    const heartBeatEntry = new Heartbeat({
        date: now,
        hour: now.getHours(),
        BTCGasFee: btcFee,
        ETHGasFee: ethFee
    });

    await heartBeatEntry.save();
    console.log("Gas fees saved to MongoDB");
}

// Call the function to save gas fees
saveGasFees();
