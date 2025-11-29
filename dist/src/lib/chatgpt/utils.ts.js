export function jsonlStringify(value) {
  if (!Array.isArray(value)) return JSON.stringify(value);
  return value.map((item) => JSON.stringify(item)).join("\n");
}
export function nonNullable(value) {
  return value !== null && value !== void 0;
}
export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
export function dateStr() {
  return (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
}
export function timestamp() {
  const now = /* @__PURE__ */ new Date();
  return `${now.getHours().toString().padStart(2, "0")}${now.getMinutes().toString().padStart(2, "0")}${now.getSeconds().toString().padStart(2, "0")}`;
}
export function unixTimestampToISOString(unixTimestamp) {
  return new Date(unixTimestamp * 1e3).toISOString();
}
export function standardizeLineBreaks(input) {
  return input.replace(/\r\n?/g, "\n");
}
