const Ethers = require('ethers')
const axios = require('axios');
const redis = require('redis');
const winston = require('winston');
const { RETRY_AFTER } = require('./conf')

require('dotenv').config();

// import environment variables
const FULL_NODE_IP = process.env.FULL_NODE_IP
const NEW_TX_NOTIFY_API = process.env.NEW_TX_NOTIFY_API
const GET_ADDRESS_API = process.env.GET_ADDRESS_API
const EXCHANGE_ACCESS_TOKEN = process.env.EXCHANGE_ACCESS_TOKEN
const REDIS_HOST = process.env.REDIS_HOST
const REDIS_PORT = process.env.REDIS_PORT

const redis_client = redis.createClient(
    {
        socket: {
            host: REDIS_HOST,
            port: REDIS_PORT
        }
    });

const logger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
        winston.format.timestamp({
            format: 'YYYY-MM-DD HH:mm:ss'
        }),
        winston.format.errors({ stack: true }),
        winston.format.splat(),
        winston.format.json()
    ),
    transports: [
        new winston.transports.File({ filename: 'client.log' }),
    ]
});

// initialize ethers

let exchangeAddresses = []
let contract_addresses = {}

async function notifyExchange(message) {
    logger.info('notify exchange...')
    exchangeWallets = await axios.post(NEW_TX_NOTIFY_API, message, { headers: { Authorization: "Bearer " + EXCHANGE_ACCESS_TOKEN } }).then(response => {
        logger.info(`exchange respond with ${response.status} status on notify tx ${response.data.message} `)
    }).catch(error => {
        logger.info(`error in notify exchange: ${error} add to retry...`)
        throw error
    })
}

async function get_missing_transactions() {

    // get now block
    logger.info(`current block: ${currentBlock}`)

    // get last checked block from redis
    let lastCheckedBlock = parseInt(await redis_client.get('last_checked_block'));
    // if (!lastCheckedBlock)
    //     add a valid value to lastCheckedBlock

    logger.info(`last checked block: ${lastCheckedBlock}`)

    logger.info(`check for addresses: ${JSON.stringify(exchangeAddresses)}`)

    // for all block form lastCheckedBlock to lastCheckedBlock
    // while (lastCheckedBlock < lastCheckedBlock) {
    // get blocks for this batch
    //logger.info(`get ${batchSize} blocks from full node from ${lastCheckedBlock} to ${Math.min(lastCheckedBlock + batchSize, confirmLimitBlock)} ...`)
    logger.info(`got blocks ok`)

    // if (!block.transactions)
    //     continue

    // check transactions of block
    // logger.info(`checking transactions for block ${block number} ...`)
    // for all transaction in block
    // if (transaction!= "SUCCESS")
    // continue

    // check transaction type
    // if type is ok check receiver
    // if ours notify exchange
    // logger.info(`TransferContract found ${transaction.txID} for address ${receiver address} in block ${block number}`)
    // let message = {
    //     "address": address,
    //     "confirmation": currentBlock - block.number,
    //     "amount": amount,
    //     "txid": transaction.txID,
    //     "time_received": time_received
    // }
    // retry(3, notifyExchange, message).catch(error => {
    //     logger.info(`connection to exchange failed after 3 retry tx_hash: ${transaction.txID}`)
    // })
    await new Promise((resolve) => { setTimeout(resolve, 2); })


    // update lastCheckedBlock
    // lastCheckedBlock = Math.min(lastCheckedBlock + batchSize, confirmLimitBlock)
    // update lastCheckBlock in redis
    // lastCheckedBlock = confirmLimitBlock + 1
    await redis_client.set('last_checked_block', lastCheckedBlock);
    logger.info(`updating last_checked_block in redis ${lastCheckedBlock}`)
}


async function get_exchange_addresses() {
    logger.info("getting addresses list from exchange")
    return await axios.get(GET_ADDRESS_API + '?network=erc-20', { headers: { Authorization: "Bearer " + EXCHANGE_ACCESS_TOKEN } }).then(response => {
        return response.data.data
    })
}

async function start() {
    var startTime = performance.now()
    logger.info("start check for received transactions")
    await get_missing_transactions()
    logger.info(`***process finished in ${(performance.now() - startTime) / 1000} seconds ***`)
    // log new line
    logger.info(" ")
}

(async () => {

    let exchangeWallets = await get_exchange_addresses().catch(error => { return false })
    while (!exchangeWallets) {
        logger.error("error getting exchange addresses")
        logger.error(`retrying in ${RETRY_AFTER / 1000}/sec`)
        await new Promise(resolve => setTimeout(resolve, RETRY_AFTER));
        exchangeWallets = await get_exchange_addresses().catch(error => { return false })
    }

    for (let i = 0; i < exchangeWallets.length; i++)  exchangeAddresses[exchangeAddresses.length] = exchangeWallets[i].address

    logger.info(`received ${exchangeAddresses.length} addresses from exchange`)

    await redis_client.connect();
    logger.info(`redis connected`)

    await start()
    setInterval(
        start
        , 5 * 60 * 1000
    )
})();

async function retry(maxRetries, fn, input = undefined) {
    return await fn(input).catch(async (err) => {
        if (maxRetries <= 0) {
            throw err;
        }
        logger.error(`running ${fn.name} failed, retry in ${RETRY_AFTER}, ${maxRetries} remaining `)
        await new Promise((resolve) => { setTimeout(resolve, RETRY_AFTER); })
        return retry(maxRetries - 1, fn, input);
    });
}
