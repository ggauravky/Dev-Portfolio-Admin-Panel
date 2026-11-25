class HttpError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

const invalid = (message) => new HttpError(400, "VALIDATION_ERROR", message);
const unavailable = (dependency) => new HttpError(503, "DEPENDENCY_UNAVAILABLE", dependency === "chat" ? "Chat storage is unavailable" : "Portfolio storage is unavailable");
const missing = () => new HttpError(404, "NOT_FOUND", "Resource not found");
const send = (res, data) => { if (!res.headersSent) res.json({ success: true, data }); };
const asyncRoute = (handler) => (req, res, next) => Promise.resolve().then(() => handler(req, res)).catch(next);

module.exports = { HttpError, invalid, unavailable, missing, send, asyncRoute };
