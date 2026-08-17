import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env from the same directory as this file
dotenv.config({ path: path.join(__dirname, ".env") });

console.log("DATABASE_URL loaded:", process.env.DATABASE_URL ? "Yes" : "No");

import express from "express";
import cors from "cors";

import { connectDB } from "./src/config/db.js";
import { syncModels } from "./src/models/index.js";
import reportsRouter from "./src/routes/reports.js";
import statsRouter from "./src/routes/stats.js";
import incidentsRouter from "./src/routes/incidents.js";
import mapRouter from "./src/routes/map.js";
import predictRouter from "./src/routes/predict.js";
import authRouter from "./src/routes/auth.js";
import { AuthService } from "./src/services/authService.js";

const app = express();

app.use(cors({
    origin: [
        process.env.CORS_ORIGIN || "http://localhost:5173",
        "http://127.0.0.1:5173"
    ],
    credentials: true,
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

app.get("/", (_req, res) => {
    res.json({
        message: "CivicPulse AI Backend (Express) is running",
        status: "ok"
    });
});

app.use(reportsRouter);
app.use(statsRouter);
app.use(incidentsRouter);
app.use(mapRouter);
app.use(predictRouter);
app.use(authRouter);

const PORT = process.env.PORT || 8000;

(async () => {
    await connectDB();
    await syncModels();
    
    // Seed admin user on startup
    try {
        await AuthService.seedAdminUser();
    } catch (error) {
        console.error("Failed to seed admin user:", error.message);
    }
    
    app.listen(PORT, () => {
        console.log(`Server running on http://localhost:${PORT}`);
    });
})();