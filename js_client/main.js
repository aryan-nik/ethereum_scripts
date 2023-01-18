const Ethers = require('ethers')
const axios = require('axios');
const redis = require('redis');
const winston = require('winston');
const { RETRY_AFTER } = require('./conf')
const usdt_abi = require('./ABIs/USDT.json');

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
const provider = new Ethers.providers.JsonRpcProvider(FULL_NODE_IP)

let exchangeAddresses = []
let contract_addresses = { "0xdac17f958d2ee523a2206206994597c13d831ec7": { "name": "USDT", 'decimal': 6 } }

async function notifyExchange(message) {
    logger.info('notify exchange...')
    exchangeWallets = await axios.post(NEW_TX_NOTIFY_API, message, { headers: { Authorization: "Bearer " + EXCHANGE_ACCESS_TOKEN } }).then(response => {
        logger.info(`exchange respond with ${response.status} status on notify tx ${response.data.message} `)
    }).catch(error => {
        logger.info(`error in notify exchange: ${error} add to retry...`)
        throw error
    })
}

async function isERC20(tx) {
    if (contract_addresses[tx.toLowerCase()]) {
        return true
    }
    return false
}

async function get_missing_transactions() {

    // get last block number from provider
    let currentBlock = await provider.getBlockNumber()

    // get last checked block from redis
    let lastCheckedBlock = parseInt(await redis_client.get('last_checked_block'));
    // if (!lastCheckedBlock)
    //     add a valid value to lastCheckedBlock

    logger.info(`last checked block: ${lastCheckedBlock}`)
    logger.info(`current block: ${currentBlock}`)
    logger.info(`check for addresses: ${JSON.stringify(exchangeAddresses)}`)


    // for all block form lastCheckedBlock to currentBlock
    let range = currentBlock - lastCheckedBlock
    for (let i = 0; i < range; i++) {
        const block = await provider.getBlockWithTransactions(lastCheckedBlock + i);
        logger.info(`checking transactions for block ${block.number} ...`)
        logger.info(`got block ok`)

        if (!block.transactions)
            continue

        transactions = block.transactions
        for (let j = 0; j < transactions.length; j++) {
            // check transaction type
            if (isERC20(transactions[j].to)) {

            } else {
                // if type is ok check receiver
                if (exchangeAddresses.indexOf(transactions[j].to) >= 0) {
                    let message = {
                        "address": transactions[j].to,
                        "confirmation": currentBlock - block.number,
                        "amount": amount,
                        "txid": transaction.hash,
                        "time_received": time_received
                    }
                    retry(3, notifyExchange, message).catch(error => {
                        logger.info(`connection to exchange failed after 3 retry tx_hash: ${transaction.hash}`)
                    })
                    logger.info(`TransferContract found ${transaction.hash} for address ${transactions[j].to} in block ${block.number}`)
                }

            }

        }


        await new Promise((resolve) => { setTimeout(resolve, 2); })


        // update lastCheckedBlock
        // lastCheckedBlock = Math.min(lastCheckedBlock + batchSize, confirmLimitBlock)
        // update lastCheckBlock in redis
        // lastCheckedBlock = confirmLimitBlock + 1
        await redis_client.set('last_checked_block', lastCheckedBlock + i);
        logger.info(`updating last_checked_block in redis ${lastCheckedBlock + i}`)
    }

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


for (const transction of block.transactions) {
    data = await pr.getTransaction(transction)
    if (data.to.toLowerCase() == usdt) {
        console.log(data.hash)
    }
}


async function getLastBlockTransactions() {
    const blockNumber = await pr.getBlockNumber();
    const block = await pr.getBlock(blockNumber);
    for (const tx of block.transactions) {
        await checkTransaction(tx);
    }
}

const ethers = require('ethers');

async function getUsdtTransfers(blockNumber) {
    const block = await pr.getBlock(blockNumber);
    const usdtContract = new ethers.Contract(
        "0xdAC17F958D2ee523a2206206994597C13D831ec7",
        abi,
        pr
    );

    let usdtTransfers = [];
    for (let i = 0; i < block.transactions.length; i++) {
        const tx = block.transactions[i];
        const parsedTx = usdtContract.interface.parseTransaction({
            data: tx
        });
        if (parsedTx !== null && parsedTx.name === "transfer") {
            usdtTransfers.push({
                from: tx.from,
                to: parsedTx.args[0],
                value: parsedTx.args[1].toString()
            });
        }
    }
    return usdtTransfers;
}

const logs = await pr.getLogs({
    fromBlock: blockNumber,
    toBlock: blockNumber + 1,
    address: usdt
});

// Loop through the logs
for (let i = 0; i < logs.length; i++) {
    // Decode the log
    const decoded = contract.interface.parseLog(logs[i]);

    // Check if the log is a transfer event
    if (decoded.name === "Transfer") {
        // The `decoded.values` object contains the indexed and non-indexed
        // values of the event, including the `from`, `to`, and `value` of the transfer.
        console.log(decoded.values);
    }
}
