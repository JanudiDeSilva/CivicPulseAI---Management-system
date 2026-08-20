import express from "express";
import { Report } from "../models/index.js";
import { Op } from "sequelize";
import { categoryIcon } from "../utils/helpers.js";

const router = express.Router();

router.get("/map-pins", async (_req, res) => {
  try {
    const reports = await Report.findAll({
      where: { latitude: { [Op.ne]: null }, longitude: { [Op.ne]: null } },
      order: [["created_at", "DESC"]],
    });

    const pins = reports.map((r) => ({
      id: r.id,
      tracking_id: r.tracking_id,
      category: r.category,
      icon: categoryIcon(r.category),
      severity: r.severity,
      status: r.status,
      area: r.area,
      city: r.city,
      district: r.district,
      latitude: r.latitude,
      longitude: r.longitude,
    }));

    res.json({ pins });
  } catch (err) {
    res.status(500).json({ detail: err.message });
  }
});

export default router;