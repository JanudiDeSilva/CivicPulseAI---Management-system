const CATEGORY_LABELS = {
    flood: "Flood & Drainage",
    road_damage: "Road Damage",
    garbage: "Garbage & Waste",
    power_failure: "Power Failure",
    street_light: "Street Light",
};
const CATEGORY_ICONS = {
    flood: "🌊", road_damage: "🚗", garbage: "🗑️", power_failure: "⚡", street_light: "💡",
};

export const categoryLabel = (cat) => CATEGORY_LABELS[cat] || cat || "Unknown";
export const categoryIcon = (cat) => CATEGORY_ICONS[cat] || "📋";

export function humanizeTime(date) {
    if (!date) return "Unknown";
    const now = new Date();
    const diffSec = Math.floor((now - new Date(date)) / 1000);
    if (diffSec < 60) return "Just now";
    if (diffSec < 3600) {
        const m = Math.floor(diffSec / 60);
        return `${m} min${m > 1 ? "s" : ""} ago`;
    }
    if (diffSec < 86400) {
        const h = Math.floor(diffSec / 3600);
        return `${h} hour${h > 1 ? "s" : ""} ago`;
    }
    const d = Math.floor(diffSec / 86400);
    return `${d} day${d > 1 ? "s" : ""} ago`;
}