const WebSocket = require("ws");

const wss = new WebSocket.Server({ port: process.env.PORT || 8080 });

let waitingPlayer = null;
let rooms = {};

function send(ws, data) {
    if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(data));
    }
}

wss.on("connection", (ws) => {
    console.log("Player connected");

    ws.on("message", (msg) => {
        let data = JSON.parse(msg);

        if (data.type === "find_match") {

            // 🚫 منع تكرار نفس اللاعب
            if (ws.inMatch) return;
            ws.inMatch = true;

            // 👤 أول لاعب ينتظر
            if (!waitingPlayer) {
                waitingPlayer = ws;
                send(ws, { type: "waiting" });
                return;
            }

            // 🎯 ثاني لاعب → match
            const roomId = "room_" + Math.random().toString(36).substr(2, 6);

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

        // 📡 relay WebRTC
        if (["offer", "answer", "candidate"].includes(data.type)) {
            let room = rooms[data.room];
            if (!room) return;

            let target = (ws === room.p1) ? room.p2 : room.p1;

            send(target, data);
        }
    });

    ws.on("close", () => {

        // تنظيف الانتظار
        if (waitingPlayer === ws) {
            waitingPlayer = null;
        }

        // حذف من الغرف
        for (let roomId in rooms) {
            let r = rooms[roomId];

            if (r.p1 === ws || r.p2 === ws) {
                delete rooms[roomId];
            }
        }
    });
});
