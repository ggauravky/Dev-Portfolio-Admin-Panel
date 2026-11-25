export function dateParams(value) {
  return value.range === "custom" ? { range: "custom", from: value.from, to: value.to } : { range: value.range };
}

export function queryString(params) {
  return new URLSearchParams(Object.entries(params).filter(([, value]) => value !== "" && value != null)).toString();
}
