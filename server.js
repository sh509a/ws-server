const WebSocket = require("ws");
const wss = new WebSocket.Server({ port: process.env.PORT || 8080 });

let rooms = {}; 
const MAX_PLAYERS = 4; // 👥 2 ضد 2 (المجموع 4 لاعبين في الروم)

function send(ws, data) {
    if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(data));
    }
}

wss.on("connection", (ws) => {
    console.log("👤 Player connected to 2v2 system");
    ws.currentRoom = null;
    ws.isHost = false;
    ws.id = "peer_" + Math.floor(Math.random() * 10000); // معرف فريد داخل السيرفر

    ws.on("message", (msg) => {
        let data = JSON.parse(msg);

        if (data.type === "find_match") {
            let targetRoomId = null;

            // البحث عن غرفة مفتوحة وفيها مكان
            for (let id in rooms) {
                if (rooms[id].players.length < MAX_PLAYERS) {
                    targetRoomId = id;
                    break;
                }
            }

            // إذا مالقينا غرفة مفتوحة، نفتح غرفة جديدة فوراً
            if (!targetRoomId) {
                targetRoomId = "room_" + Date.now();
                rooms[targetRoomId] = { host: ws, players: [] };
                ws.isHost = true;
                console.log(`👑 Created 2v2 room: ${targetRoomId}`);
            }

            ws.currentRoom = targetRoomId;
            rooms[targetRoomId].players.push(ws);

            // إرسال بيانات الدورة للاعب
            send(ws, {
                type: "match_found",
                role: ws.isHost ? "host" : "client",
                room: targetRoomId,
                peer_id: ws.id
            });

            // تنبيه بقية اللاعبين في الغرفة بقدوم لاعب جديد لفتح نفق WebRTC معه
            rooms[targetRoomId].players.forEach(player => {
                if (player !== ws) {
                    send(player, { type: "new_peer_joined", peer_id: ws.id });
                }
            });
        }

        // تمرير إشارات الـ WebRTC (Offer, Answer, Candidate) بين الأجهزة
        if (data.type === "offer" || data.type === "answer" || data.type === "candidate") {
            let roomId = ws.currentRoom;
            if (roomId && rooms[roomId]) {
                rooms[roomId].players.forEach(player => {
                    if (player.id === data.target || (!data.target && player !== ws)) {
                        send(player, { ...data, sender: ws.id });
                    }
                });
            }
        }
    });

    ws.on("close", () => {
        let roomId = ws.currentRoom;
        if (roomId && rooms[roomId]) {
            rooms[roomId].players = rooms[roomId].players.filter(p => p !== ws);
            if (rooms[roomId].players.length === 0) {
                delete rooms[roomId];
            }
        }
    });
});
