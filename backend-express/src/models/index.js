import { sequelize } from "../config/db.js";
import Report from "./Report.js";
import ReportImage from "./ReportImage.js";
import Incident from "./Incident.js";
import Resource from "./Resource.js";

Report.hasMany(ReportImage, { foreignKey: "report_id", as: "images" });
ReportImage.belongsTo(Report, { foreignKey: "report_id" });

export async function syncModels() {
    await sequelize.sync({ alter: true }); // use migrations in production instead of sync()
}

export { Report, ReportImage, Incident, Resource };