// CORS origin normalization

function normalizedCorsOrigin(value) {
  if (!value || typeof value !== "string") return "";
  try {
    const url = new URL(value);
    if (url.pathname !== "/") return "";
    if (url.protocol !== "http:" && url.protocol !== "https:") return "";
    return url.origin;
  } catch {
    return "";
  }
}

module.exports = { normalizedCorsOrigin };
