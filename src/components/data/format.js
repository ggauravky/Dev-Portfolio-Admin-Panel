export const dateTime = (value) => value ? new Intl.DateTimeFormat("en-IN", {
  dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata",
}).format(new Date(value)) + " IST" : "Unavailable";
export const number = (value) => value == null ? "Unavailable" : Math.round(value).toLocaleString("en-IN");
export const percent = (value) => value == null ? "Unavailable" : (value * 100).toFixed(1) + "%";
export const latency = (value, overflow = 120000) => value == null ? "Unavailable" : (value >= overflow ? "≥" : "≈") + number(value) + " ms";
export const yesNo = (value) => value == null ? "Unavailable" : value ? "Yes" : "No";

export const words = (value) => typeof value === "string" && value ? value.replaceAll("_", " ") : "Unknown";
export const displayDate = (value) => value && Number.isFinite(Date.parse(value)) ? dateTime(value) : "Unknown";
