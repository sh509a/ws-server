const WebSocket = require("ws");
const wss = new WebSocket.Server({ port: process.env.PORT || 8080 });

// مصفوفة لتخزين الغرف الشغالة
let rooms = {}; 
const MAX_PLAYERS_PER_ROOM = 2; // 👥 يمكنك تغيير الحد الأقصى للاعبين هنا (مثلاً 2 أو 4)

function send(ws, data) {
    if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(data));
    }
}

wss.on("connection", (ws) => {
    console.log("👤 Player connected");
    ws.currentRoom = null;
    ws.isHost = false;

    ws.on("message", (msg) => {
        let data = JSON.parse(msg);
        console.log("📩 Event:", data.type);

        if (data.type === "find_match") {
            let targetRoomId = null;

            // 🔍 البحث عن غرفة مفتوحة ولها مكان وما وصلت للحد الأقصى
            for (let id in rooms) {
                if (rooms[id].players.length < MAX_PLAYERS_PER_ROOM) {
                    targetRoomId = id;
                    break;
                }
            }

            // 🆕 إذا مالقينا غرفة مفتوحة، نفتح غرفة جديدة فوراً ويصير هذا اللاعب هو الهوست
            if (!targetRoomId) {
                targetRoomId = "room_" + Date.now();
                rooms[targetRoomId] = {
                    host: ws,
                    players: []
                };
                ws.isHost = true;
                console.log(`👑 Created new room: ${targetRoomId}`);
            }

            // دخول اللاعب للغرفة
            ws.currentRoom = targetRoomId;
            rooms[targetRoomId].players.push(ws);

            if (ws.isHost) {
                // الهوست يدخل فوراً ويلعب فردي بانتظار البقية
                send(ws, {
                    type: "match_found",
                    role: "host",
                    room: targetRoomId,
                    status: "play_solo"
                });
            } else {
                // اللاعب الثاني يدخل على نفس غرفة الهوست
                let hostWs = rooms[targetRoomId].host;
                ws.partner = hostWs;
                hostWs.partner = ws; // ربط الشركاء للـ WebRTC

                // نبلغ اللاعب الجديد إنه كلاينت ونعطيه اسم الغرفة
                send(ws, {
                    type: "match_found",
                    role: "client",
                    room: targetRoomId,
                    status: "join_existing"
                });

                // نبلغ الهوست (اللي جالس يلعب فردي) إن فيه لاعب دخل معه الحين!
                send(hostWs, {
                    type: "player_joined_your_solo",
                    room: targetRoomId
                });
            }
        }

        // 🔁 تمرير إشارات الـ WebRTC بين اللاعبين في نفس الغرفة
        if (data.type === "offer" || data.type === "answer" || data.type === "candidate") {
            if (ws.partner) {
                send(ws.partner, data);
            }
        }
    });

    ws.on("close", () => {
        console.log("❌ Player disconnected");
        let roomId = ws.currentRoom;
        if (roomId && rooms[roomId]) {
            // حذف اللاعب من قائمة الغرفة
            rooms[roomId].players = rooms[roomId].players.filter(p => p !== ws);
            
            // لو الهوست طلع، نقفل الغرفة أو ننقل السيادة
            if (ws.isHost || rooms[roomId].players.length === 0) {
                console.log(`🗑️ Closing room: ${roomId}`);
                rooms[roomId].players.forEach(p => send(p, { type: "room_closed" }));
                delete rooms[roomId];
            }
        }
    });
});
