import axios from "axios";

async function run() {
    try {
        const res = await axios.post('https://api.hyperliquid.xyz/info', {
            type: "userFills", 
            user: "0x393c8d1bb4a395b0586e2ebba1d0c410dd39ff66" // Usually a market maker or highly active vault
        });
        console.log(`Number of fills: ${res.data.length}`);
    } catch (e) {
        console.log("userFills failed");
    }
}
run();
