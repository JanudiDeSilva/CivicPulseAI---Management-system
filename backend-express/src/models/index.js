import { sequelize } from "../config/db.js";
import Report from "./Report.js";
import Incident from "./Incident.js";
import Resource from "./Resource.js";
import User from "./User.js";

export async function syncModels() {
    await sequelize.sync({ alter: true }); // use migrations in production instead of sync()
}

export { Report, Incident, Resource, User };