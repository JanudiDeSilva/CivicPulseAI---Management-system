import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

import { connectDB } from "./src/config/db.js";
import { syncModels } from "./src/models/index.js";
import reportsRouter from "./src/routes/reports.js";
import statsRouter from "./src/routes/stats.js";
import incidentsRouter from "./src/routes/incidents.js";
import mapRouter from "./src/routes/map.js";

dotenv.config();
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();

app.use(cors({
    origin: [process.env.CORS_ORIGIN || "http://localhost:5173", "http://127.0.0.1:5173"],
    credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

app.get("/", (_req, res) => {
    res.json({ message: "CivicPulse AI Backend (Express) is running", status: "ok" });
});

app.use(reportsRouter);
app.use(statsRouter);
app.use(incidentsRouter);
app.use(mapRouter);

const PORT = process.env.PORT || 8000;

(async () => {
    await connectDB();
    await syncModels();
    app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
})();