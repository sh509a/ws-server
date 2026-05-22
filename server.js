const WebSocket = require("ws");

const PORT = process.env.PORT || 8080;
const wss = new WebSocket.Server({ port: PORT });

console.log("WebSocket Server running on port " + PORT);

wss.on("connection", (ws) => {
    console.log("Player connected");

    ws.on("message", (msg) => {

        // يرسل لكل اللاعبين
        wss.clients.forEach((client) => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(msg.toString());
            }
        });

    });

    ws.on("close", () => {
        console.log("Player disconnected");
    });
});