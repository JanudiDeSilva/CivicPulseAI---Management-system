import { DataTypes } from "sequelize";
import { sequelize } from "../config/db.js";

const Report = sequelize.define("Report", {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
    },
    tracking_id: { type: DataTypes.STRING, unique: true },

    source: { type: DataTypes.STRING, defaultValue: "web" },
    name: DataTypes.STRING,
    phone: DataTypes.STRING,

    raw_text: DataTypes.TEXT,
    specific_details: DataTypes.TEXT,
    image_url: DataTypes.STRING,

    latitude: DataTypes.FLOAT,
    longitude: DataTypes.FLOAT,
    district: DataTypes.STRING,
    city: DataTypes.STRING,
    area: DataTypes.STRING,

    category: DataTypes.STRING,
    severity_raw: DataTypes.STRING,
    severity: { type: DataTypes.STRING, defaultValue: "PENDING" },
    priority_score: { type: DataTypes.FLOAT, defaultValue: 0.0 },
    predicted_escalation: DataTypes.STRING,
    escalation_confidence: DataTypes.FLOAT,

    status: { type: DataTypes.STRING, defaultValue: "Registered" },
    admin_reply: { type: DataTypes.TEXT, allowNull: true },

    // ─── Priority prediction system fields ───
    severity_score: { type: DataTypes.FLOAT, defaultValue: 0.0 },
    risk_signals: { type: DataTypes.JSON, allowNull: true },

    // ─── Priority rank (1 = most critical) ───
    priority_rank: { type: DataTypes.INTEGER, allowNull: true },

    // ─── ML analysis / model detections (JSON) ───
    ml_analysis: { type: DataTypes.JSON, allowNull: true },

    // ─── Duplicate detection fields ───
    incident_id: { type: DataTypes.UUID, allowNull: true },
    is_duplicate: { type: DataTypes.BOOLEAN, defaultValue: false },
    duplicate_similarity: { type: DataTypes.FLOAT, defaultValue: 0.0 },
    matched_incident_id: { type: DataTypes.UUID, allowNull: true },
    incident_report_count: { type: DataTypes.INTEGER, defaultValue: 1 },
    // Numeric model input fields
    elevation_m: DataTypes.FLOAT,
    distance_to_river_m: DataTypes.FLOAT,
    population_density_per_km2: DataTypes.FLOAT,
    built_up_percent: DataTypes.FLOAT,
    rainfall_7d_mm: DataTypes.FLOAT,
    monthly_rainfall_mm: DataTypes.FLOAT,
    ndvi: DataTypes.FLOAT,
    ndwi: DataTypes.FLOAT,
    water_presence_flag: DataTypes.FLOAT,
    historical_flood_count: DataTypes.FLOAT,
    infrastructure_score: DataTypes.FLOAT,
    nearest_hospital_km: DataTypes.FLOAT,
    nearest_evac_km: DataTypes.FLOAT,
}, {
    tableName: "reports",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: false,
});

export default Report;