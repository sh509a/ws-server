const WebSocket = require("ws");
const wss = new WebSocket.Server({ port: process.env.PORT || 8080 });

let rooms = {}; 
const MAX_PLAYERS = 4; 

function send(ws, data) {
    if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(data));
    }
}

wss.on("connection", (ws) => {
    ws.id = "peer_" + Math.floor(Math.random() * 10000);
    ws.currentRoom = null;
    ws.isHost = false;
    console.log(`👤 لاعب جديد اتصل بالسيرفر. الآيدي: ${ws.id}`);

    ws.on("message", (msg) => {
        let data;
        try {
            data = JSON.parse(msg);
        } catch (e) {
            console.error("❌ خطأ في قراءة بيانات الحزمة");
            return;
        }

        if (data.type === "find_match") {
            let targetRoomId = null;

            // كود صارم للبحث عن أي غرفة فيها مكان متاح
            for (let id in rooms) {
                if (rooms[id] && rooms[id].players && rooms[id].players.length < MAX_PLAYERS) {
                    targetRoomId = id;
                    break; // وجدنا الغرفة المفتوحة، اخرج من اللوب فوراً!
                }
            }

            // إذا وجد غرفة مفتوحة يدخلها، وإذا لم يجد ينشئ واحدة جديدة
            if (targetRoomId) {
                ws.currentRoom = targetRoomId;
                ws.isHost = false;
                rooms[targetRoomId].players.push(ws);
                console.log(`🤝 اللاعب [${ws.id}] دخل غرفة موجودة مسبقاً: ${targetRoomId}. عدد اللاعبين الحين: ${rooms[targetRoomId].players.length}`);
            } else {
                targetRoomId = "room_" + Date.now() + "_" + Math.floor(Math.random() * 1000);
                ws.currentRoom = targetRoomId;
                ws.isHost = true;
                rooms[targetRoomId] = { players: [ws] };
                console.log(`👑 اللاعب [${ws.id}] هو الأول، تم إنشاء غرفة جديدة له باسم: ${targetRoomId}`);
            }

            // إرسال النتيجة للاعب فوراً
            send(ws, {
                type: "match_found",
                role: ws.isHost ? "host" : "client",
                room: targetRoomId,
                peer_id: ws.id
            });

            // تنبيه بقية اللاعبين في الغرفة بقدوم اللاعب الجديد لفتح نفق الـ WebRTC
            rooms[targetRoomId].players.forEach(player => {
                if (player.id !== ws.id) {
                    send(player, { type: "new_peer_joined", peer_id: ws.id });
                    console.log(`📢 إرسال إشعار للـ [${player.id}] بإن الـ [${ws.id}] دخل الغرفة عشان يشبكون WebRTC.`);
                }
            });
        }

        // تمرير إشارات الـ WebRTC بين الأجهزة داخل الغرفة
        if (data.type === "offer" || data.type === "answer" || data.type === "candidate") {
            let roomId = ws.currentRoom;
            if (roomId && rooms[roomId]) {
                rooms[roomId].players.forEach(player => {
                    if (player.id === data.target) {
                        send(player, { ...data, sender: ws.id });
                    }
                });
            }
        }
    });

    ws.on("close", () => {
        let roomId = ws.currentRoom;
        console.log(`❌ اللاعب [${ws.id}] قطع الاتصال.`);
        if (roomId && rooms[roomId]) {
            rooms[roomId].players = rooms[roomId].players.filter(p => p.id !== ws.id);
            if (rooms[roomId].players.length === 0) {
                console.log(`🗑️ الغرفة ${roomId} صارت فاضية، تم حذفها.`);
                delete rooms[roomId];
            }
        }
    });
});

console.log("🚀 سيرفر الماتش ميكنج 2v2 يعمل الحين بنجاح...");
