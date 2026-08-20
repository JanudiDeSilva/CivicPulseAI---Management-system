import { DataTypes } from "sequelize";
import { sequelize } from "../config/db.js";

const Resource = sequelize.define("Resource", {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    type: { type: DataTypes.STRING, allowNull: false },
    name: DataTypes.STRING,
    latitude: DataTypes.FLOAT,
    longitude: DataTypes.FLOAT,
    status: { type: DataTypes.STRING, defaultValue: "available" },
    assigned_incident_id: { type: DataTypes.UUID, allowNull: true },
}, {
    tableName: "resources",
    timestamps: false,
});

export default Resource;