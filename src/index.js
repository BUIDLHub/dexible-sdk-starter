
const dotenv = require('dotenv');
dotenv.config();

const {config:sdkSetup} = require("./sdkConfig");
const {SDK, Algos, Policies} = require("dexible-sdk");
const {ethers} = require("ethers");

const bn = ethers.BigNumber.from;
const asFull = ethers.utils.parseUnits;

const usage = () => console.log("Usage: <order-template-name>");
const main = async () => {

    let args = process.argv.slice(2);
    if(args.length < 1) {
        usage();
        process.exit(1);
    }

    let template = args[0];

    if(!sdkSetup.infuraId && !sdkSetup.rpc) {
        throw new Error("Must provide an infura id or rpc endpoint for web3 provider in sdk setup config");
    }
    if(!sdkSetup.chainId) {
        sdkSetup.chainId = 1;
    }
    if(!sdkSetup.wallet) {
        throw new Error("Must provide a wallet in sdk setup config")
    }

    let provider = null;
    if(sdkSetup.infuraId) {
        provider = new ethers.providers.InfuraProvider(sdkSetup.chainId,sdkSetup.infuraId);
    } else {
        provider = new ethers.providers.JsonRpcProvider(sdkSetup.chainId, sdkSetup.rpc);
    }

    let signer = new ethers.Wallet(sdkSetup.wallet, provider);
    console.log("Creating SDK instance");
    let sdk = new SDK({
        network: "ethereum",
        signer
    });

    let {init} = require(`./${template}`);
    let orderFactory = {
        create: async config => {
            let tokenIn = config.tokenIn;
            let tokenOut = config.tokenOut;
            if(!tokenIn || !tokenOut) {
                throw new Error("Must supply input and output token instances");
            }
            if(!tokenIn.decimals || !tokenOut.decimals) {
                throw new Error("Must use tokens that were looked up using the sdk instance");
            }
            let amountIn = asFull(config.amountIn.toFixed(tokenIn.decimals), tokenIn.decimals);
            if(!config.algo || !config.algo.type) {
                throw new Error("Missing algo or algo.type props in config");
            }
            let algoType = config.algo.type;
            let algoClass = null;
            switch(algoType) {
                case Algos.types.Limit: {
                    algoClass = Algos.Limit;
                    break;
                }

                case Algos.types.Market: {
                    algoClass = Algos.Market;
                    break;
                }

                case Algos.types.StopLoss: {
                    algoClass = Algos.StopLoss;
                    break;
                }

                case Algos.types.TWAP: {
                    algoClass = Algos.TWAP;
                    break;
                }

                default: {
                    throw new Error("Unsupported algo type: " + algoType);
                }
            }

            console.log("Creating algo of type", algoType);
            let algo = new algoClass({
                policies: config.algo.policies,
                maxRounds: config.algo.maxRounds
            });
            
            let bal = bn(tokenIn.balance||0);
            let allow = bn(tokenIn.allowance||0);

            console.log("Checking single-order token balance...");
            if(bal.lt(amountIn)) {
                throw new Error("Insufficient token balance to trade");
            } else {
                console.log("Token balance looks good");
            }

            console.log("Checking single-order spend allowance...");
            if(allow.lt(amountIn)) {
                if(sdkConfig.automaticSpendApproval) {
                    if(sdkConfig.useInfiniteSpendApproval) {
                        console.log("Approving infinite spend on input token...");
                        await sdk.token.increaseSpending(tokenIn, ethers.constants.MaxUint256);
                    } else {
                        console.log("Approving spend allowance for input token: ", amountIn.toString());
                        await sdk.token.increaseSpending(tokenIn, amountIn);
                    }
                } else {
                    throw new Error("Insufficient spend allowance for input token, and automaticSpendApproval not set in sdkConfig");
                }
            } else {
                console.log("Single-order spend allowance good");
            }

            console.log("Preparing and validating order....");
            let order = await sdk.order.prepare({
                tokenIn,
                tokenOut,
                amountIn,
                algo,
                tags: config.orderTags
            });
            return order;
        }
    }

    await init({sdk, orderFactory});

}

main();