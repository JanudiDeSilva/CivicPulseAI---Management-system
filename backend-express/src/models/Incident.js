import { DataTypes } from "sequelize";
import { sequelize } from "../config/db.js";

const Incident = sequelize.define("Incident", {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    category: { type: DataTypes.STRING, allowNull: false },
    centroid_lat: DataTypes.FLOAT,
    centroid_lng: DataTypes.FLOAT,
    report_count: { type: DataTypes.INTEGER, defaultValue: 1 },
    first_reported_at: DataTypes.DATE,
    last_reported_at: DataTypes.DATE,
    priority: DataTypes.STRING,
    priority_score: DataTypes.FLOAT,
    status: { type: DataTypes.STRING, defaultValue: "open" },
    predicted_escalation: DataTypes.STRING,
    escalation_confidence: DataTypes.FLOAT,
}, {
    tableName: "incidents",
    timestamps: true,
    createdAt: false,
    updatedAt: "updated_at",
});

export default Incident;