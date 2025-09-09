import WebSocket, { WebSocketServer } from "ws";
import fetch from "node-fetch";

const PORT = process.env.PORT || 7788; // en local usamos 7788
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

const wss = new WebSocketServer({ port: PORT });

wss.on("connection", (ws, req) => {
  console.log("Nuevo dispositivo conectado:", req.socket.remoteAddress);

  ws.on("message", async (message) => {
    try {
      const data = JSON.parse(message.toString());

      if (data.cmd === "sendlog") {
        for (const record of data.record) {
          const payload = {
            employee_external_id: record.enrollid.toString(),
            device_vendor_id: data.sn,
            event_ts: new Date(record.time).toISOString(),
            direction: record.inout === 1 ? "out" : "in",
            method: parseMode(record.mode),
            temp: record.temp ?? null,
            raw: record
          };

          await insertAttendance(payload);
        }
      }

      if (data.cmd === "reg") {
        console.log("Dispositivo registrado:", data.sn, data.devinfo);
      }
    } catch (err) {
      console.error("Error procesando mensaje:", err);
    }
  });
});

function parseMode(mode) {
  switch (mode) {
    case 0: return "fingerprint";
    case 1: return "card";
    case 2: return "password";
    case 8: return "face";
    default: return "unknown";
  }
}

async function insertAttendance(payload) {
  const resp = await fetch(`${SUPABASE_URL}/rest/v1/attendance_logs`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=representation"
    },
    body: JSON.stringify([payload])
  });

  if (!resp.ok) {
    console.error("Error insertando en Supabase:", await resp.text());
  } else {
    console.log("Evento guardado en Supabase:", payload);
  }
}

console.log(`Servidor WebSocket escuchando en puerto ${PORT}`);
