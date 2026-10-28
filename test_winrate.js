import axios from "axios";

async function run() {
    try {
        const res = await axios.post('https://api.hyperliquid.xyz/info', {
            type: "historicalOrders", // or something similar?
            user: "0x00161c88c702c33d5b02f0648da891b89f14789c"
        });
        console.log(res.data);
    } catch (e) {
        console.log("historicalOrders failed");
    }
}
run();
