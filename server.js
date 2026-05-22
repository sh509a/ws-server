const WebSocket = require("ws");

const wss = new WebSocket.Server({ port: process.env.PORT || 8080 });

let waitingPlayer = null;

function send(ws, data) {
    if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(data));
    }
}

wss.on("connection", (ws) => {
    console.log("👤 Player connected");

    ws.on("message", (msg) => {
        let data = JSON.parse(msg);

        console.log("📩", data.type);

        // 🎯 طلب البحث عن مباراة
        if (data.type === "find_match") {

            // أول لاعب ينتظر
            if (!waitingPlayer) {
                waitingPlayer = ws;

                send(ws, { type: "waiting" });
                return;
            }

            // ثاني لاعب → match
            let host = waitingPlayer;
            let client = ws;
            waitingPlayer = null;

            send(host, {
                type: "match_found",
                role: "host"
            });

            send(client, {
                type: "match_found",
                role: "client"
            });

            host.partner = client;
            client.partner = host;
        }

        // 🔁 WebRTC relay
        if (data.type === "offer" || data.type === "answer" || data.type === "candidate") {
            if (ws.partner) {
                send(ws.partner, data);
            }
        }
    });

    ws.on("close", () => {
        if (waitingPlayer === ws) waitingPlayer = null;
    });
});
