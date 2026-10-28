import axios from "axios";

async function run() {
    try {
        const res = await axios.post('https://api.hyperliquid.xyz/info', {
            type: "userFills", 
            user: "0x00161c88c702c33d5b02f0648da891b89f14789c"
        });
        console.log(`Number of fills: ${res.data.length}`);
        if(res.data.length > 0) {
            console.log("First fill:", res.data[0]);
            console.log("Last fill:", res.data[res.data.length - 1]);
        }
    } catch (e) {
        console.log("userFills failed");
    }
}
run();
