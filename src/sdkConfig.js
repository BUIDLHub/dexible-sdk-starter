

const config = {
    chainId: 42,
    automaticSpendApproval: true,
    useInfiniteSpendApproval: true,
    //rpc: http://localhost:8545, //if using a local or other RPC endpoint
    infuraId: process.env.INFURA_PROJECT_ID, //otherwise this is required
    wallet: process.env.WALLET
}

module.exports = {
    config
}