const WebSocket = require("ws");

const wss = new WebSocket.Server({ port: 8080 });

let waitingPlayer = null;
let rooms = {};

function send(ws, data) {
    ws.send(JSON.stringify(data));
}

wss.on("connection", (ws) => {
    console.log("Player connected");

    ws.on("message", (msg) => {
        let data = JSON.parse(msg);

        if (data.type === "find_match") {

            // 👤 إذا ما فيه لاعب ينتظر
            if (!waitingPlayer) {
                waitingPlayer = ws;
                ws.id = generateId();
                send(ws, { type: "waiting" });
                return;
            }

            // 🎯 إذا فيه لاعب ينتظر → نسوي غرفة
            let roomId = "room_" + Math.random().toString(36).substr(2, 6);

            rooms[roomId] = {
                p1: waitingPlayer,
                p2: ws
            };

            waitingPlayer.room = roomId;
            ws.room = roomId;

            send(waitingPlayer, {
                type: "match_found",
                role: "host",
                room: roomId
            });

            send(ws, {
                type: "match_found",
                role: "client",
                room: roomId
            });

            waitingPlayer = null;
        }

        // 📡 relay WebRTC signals
        if (data.type === "offer" || data.type === "answer" || data.type === "candidate") {
            let room = rooms[data.room];
            if (!room) return;

            let target = (ws === room.p1) ? room.p2 : room.p1;
            if (target) send(target, data);
        }
    });

    ws.on("close", () => {
        if (waitingPlayer === ws) waitingPlayer = null;
    });
});

function generateId() {
    return Math.random().toString(36).substr(2, 9);
}