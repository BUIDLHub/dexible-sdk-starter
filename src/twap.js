const {Algos, Price, Policies} = require("dexible-sdk");
const {WETH_KOVAN, DAI_KOVAN} = require("./tokens");

const TOKEN_IN = WETH_KOVAN;
const TOKEN_OUT = DAI_KOVAN;

const init = async ({sdk, orderFactory}) => {

    console.log("Looking up tokens");
    let inToken = await sdk.token.lookup(TOKEN_IN);
    let outToken = await sdk.token.lookup(TOKEN_OUT);
    console.log("InToken", inToken.symbol);

    let config = {
        tokenIn: inToken,
        tokenOut: outToken,
        amountIn: 4.4, //will convert to WETH decimals
        orderTags: [
            {
                name: "my_order_tag",
                value: "unique_to_me"
            }
        ],
        algo: {
            type: Algos.types.TWAP, //or Market, Limit, StopLoss
            //maxRounds: 20, optionally sets the max rounds, which adjusts max allowed input per round
            policies: [
                new Policies.GasCost({ 
                    gasType: "relative", //or 'fixed' both all lowercase
                    deviation: 0 //or amount in gwei if 'fixed'
                }),
                new Policies.Slippage( {
                    amount: .5 //percent, i.e. .005
                }),
                new Policies.BoundedDelay({
                    timeWindowSeconds: 60 * 60 * 24,
                    randomizeDelay: true //if false, will run each round after fixed delay period
                }),
                new Policies.PriceBounds( {
                    basePrice: new Price({
                        inAmount: 1, //weth
                        outAmount: 2000, //dai
                        inToken,
                        outToken
                    }),
                    lowerBoundPercent: 1,
                    upperBoundPercent: 1
                })
            ]
        }
    }

    let r = await orderFactory.create(config);
    if(r.error) {
        console.log(r.error);
        throw new Error(r.error);
    }
    console.log("QUOTE", JSON.stringify(r.order.quote, null, 2));
    await r.order.submit();
}

module.exports = {
    init
}