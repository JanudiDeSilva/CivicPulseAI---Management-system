import { DataTypes } from "sequelize";
import { sequelize } from "../config/db.js";

const ReportImage = sequelize.define("ReportImage", {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    report_id: { type: DataTypes.UUID, allowNull: false },
    image_url: { type: DataTypes.TEXT, allowNull: false },
    ml_analysis: DataTypes.JSON,
    sort_order: { type: DataTypes.INTEGER, defaultValue: 0 },
}, {
    tableName: "report_images",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: false,
});

export default ReportImage;