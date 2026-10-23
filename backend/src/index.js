import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
const app = new Hono();
app.use("*", logger());
app.use("*", cors({
    origin: "*",
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization"],
}));
// Health Check
app.get("/api/health", (c) => {
    return c.json({
        status: "ok",
        app: "MTs Roudhotut Thowalib Sync Engine",
        version: "1.0.0",
        architecture: "Local-First",
        timestamp: new Date().toISOString(),
    });
});
// In-Memory User Store untuk verifikasi server & fallback
const serverAccounts = {
    "admin@mts-rth.sch.id": {
        pass: "admin123",
        name: "H. Ahmad Fauzi (Super Admin)",
        role: "super_admin",
        pegawai_id: "pegawai-admin-seed-id",
    },
    "tu@mts-rth.sch.id": {
        pass: "tu12345",
        name: "Siti Nur Aisyah (Staf TU)",
        role: "staf_tu",
        pegawai_id: "pegawai-tu-seed-id",
    },
    "guru@mts-rth.sch.id": {
        pass: "guru12345",
        name: "Muhammad Ilham (Guru)",
        role: "guru",
        pegawai_id: "pegawai-guru-seed-id",
    },
};
// Auth Login API (Online Verification & Fallback)
app.post("/api/auth/login", async (c) => {
    try {
        const { email, password } = await c.req.json();
        const cleanEmail = String(email || "").trim().toLowerCase();
        const target = serverAccounts[cleanEmail];
        if (!target) {
            return c.json({ success: false, message: "Email tidak ditemukan di server" }, 401);
        }
        if (target.pass !== password) {
            return c.json({ success: false, message: "Kata sandi salah" }, 401);
        }
        return c.json({
            success: true,
            message: "Login berhasil!",
            user: {
                id: `server-user-${target.role}`,
                name: target.name,
                email: cleanEmail,
                role: target.role,
                pegawai_id: target.pegawai_id,
            },
        });
    }
    catch {
        return c.json({ success: false, message: "Request tidak valid" }, 400);
    }
});
// Update Account API (Sinkronisasi perubahan email/password dari Super Admin)
app.post("/api/auth/update-account", async (c) => {
    try {
        const { oldEmail, newEmail, name, password, role, pegawai_id } = await c.req.json();
        const cleanOld = String(oldEmail || "").trim().toLowerCase();
        const cleanNew = String(newEmail || cleanOld).trim().toLowerCase();
        const existing = serverAccounts[cleanOld];
        const updatedData = {
            pass: password || existing?.pass || "password123",
            name: name || existing?.name || "Pengguna",
            role: role || existing?.role || "guru",
            pegawai_id: pegawai_id || existing?.pegawai_id || "",
        };
        if (cleanOld && cleanOld !== cleanNew && serverAccounts[cleanOld]) {
            delete serverAccounts[cleanOld];
        }
        serverAccounts[cleanNew] = updatedData;
        return c.json({
            success: true,
            message: `Akun ${cleanNew} di server berhasil diperbarui`,
            account: { email: cleanNew, name: updatedData.name, role: updatedData.role },
        });
    }
    catch {
        return c.json({ success: false, message: "Gagal memperbarui akun di server" }, 400);
    }
});
// Sync Pull Endpoint (Download Delta dari Server ke Client)
app.get("/api/sync/pull", (c) => {
    const since = c.req.query("since") || "1970-01-01T00:00:00.000Z";
    return c.json({
        success: true,
        message: "Delta sync ready",
        server_timestamp: new Date().toISOString(),
        since,
        changes: {
            pengaturan: [],
            berita: [],
            pengumuman: [],
            siswa: [],
            pegawai: [],
            kelas: [],
        },
    });
});
// Sync Push Endpoint (Upload Perubahan Lokal ke Server)
app.post("/api/sync/push", async (c) => {
    try {
        const body = await c.req.json();
        return c.json({
            success: true,
            message: "Data pembaruan lokal diterima server",
            server_timestamp: new Date().toISOString(),
            applied_count: Array.isArray(body?.changes) ? body.changes.length : 0,
            server_overrides: [],
        });
    }
    catch {
        return c.json({ success: false, message: "Payload tidak valid" }, 400);
    }
});
const PORT = Number(process.env.PORT || 3000);
const HOST = "0.0.0.0"; // WAJIB: di-bind ke 0.0.0.0 agar HP fisik via Wi-Fi LAN dapat mengakses
console.log(`
╔══════════════════════════════════════════════════════════════════╗
║   MTs Roudhotut Thowalib — Local-First Sync Server (Backend)     ║
║                                                                  ║
║   Host : ${HOST}                                                ║
║   Port : ${PORT}                                                    ║
║   Mode : Lightweight Node.js + Hono (Hemat RAM Laptop)           ║
║   Wi-Fi LAN Ready: Buka http://192.168.0.109:${PORT}/api/health         ║
╚══════════════════════════════════════════════════════════════════╝
`);
serve({
    fetch: app.fetch,
    port: PORT,
    hostname: HOST,
});
//# sourceMappingURL=index.js.map