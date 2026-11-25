const inr = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function formatPaise(value) {
  if (typeof value !== "string" || !/^\d{1,34}$/.test(value)) return "Unavailable";
  const paise = BigInt(value);
  return inr.formatToParts(paise / 100n).map((part) => part.type === "fraction" ? (paise % 100n).toString().padStart(2, "0") : part.value).join("");
}
