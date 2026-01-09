// Read-only middleware - blocks all write operations
const readOnly = (req, res, next) => {
  const writeOperations = ["POST", "PUT", "PATCH", "DELETE"];

  // Allow login POST request
  if (req.path === "/login" && req.method === "POST") {
    return next();
  }

  // Block all other write operations
  if (writeOperations.includes(req.method)) {
    return res.status(403).json({
      message: "Write operations are disabled. This is a read-only API.",
      method: req.method,
      path: req.path,
    });
  }

  next();
};

module.exports = readOnly;
