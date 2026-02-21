const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const helmet = require("helmet");
const dns = require("dns");
require("dotenv").config();

const adminRoutes = require("./routes/adminRoutes");
const readOnly = require("./middleware/readOnly");

const app = express();

// Middleware
app.use(helmet());

// CORS configuration - accepts frontend URL from environment variable
const allowedOrigins = [
  "http://localhost:5173",
  "http://localhost:3000",
  "http://localhost:5174",
  process.env.FRONTEND_URL,
].filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps or Postman)
      if (!origin) {
        return callback(null, true);
      }

      // Check if the origin is in the allowed list
      if (allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        console.log(`CORS blocked origin: ${origin}`);
        console.log(`Allowed origins: ${allowedOrigins.join(", ")}`);
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
  })
);

app.use(express.json());

const dnsFallbackServers = (process.env.DNS_SERVERS || "1.1.1.1,8.8.8.8")
  .split(",")
  .map((server) => server.trim())
  .filter(Boolean);

const mongoDnsRetryErrorCodes = new Set([
  "ECONNREFUSED",
  "ENOTFOUND",
  "ETIMEOUT",
  "EAI_AGAIN",
]);

const configureDnsForMongoSrv = async (mongoUri) => {
  if (!mongoUri || !mongoUri.startsWith("mongodb+srv://")) {
    return;
  }

  let clusterHost;
  try {
    clusterHost = new URL(mongoUri).hostname;
  } catch {
    return;
  }

  const srvRecord = `_mongodb._tcp.${clusterHost}`;

  try {
    await dns.promises.resolveSrv(srvRecord);
    return;
  } catch (err) {
    if (!mongoDnsRetryErrorCodes.has(err.code) || dnsFallbackServers.length === 0) {
      throw err;
    }

    const currentServers = dns.getServers();
    dns.setServers(dnsFallbackServers);
    console.warn(
      `SRV lookup failed (${err.code}) using DNS [${currentServers.join(", ")}]. Retrying with [${dnsFallbackServers.join(", ")}].`
    );
    await dns.promises.resolveSrv(srvRecord);
  }
};

const connectToDatabase = async () => {
  await configureDnsForMongoSrv(process.env.MONGO_URI);
  await mongoose.connect(process.env.MONGO_URI, {
    serverSelectionTimeoutMS: 15000,
  });
  console.log("MongoDB connected successfully");
};

// Read-only mode middleware
if (process.env.READ_ONLY_MODE === "true") {
  console.log("⚠️  Running in READ-ONLY mode - Write operations disabled");
  app.use("/api/admin", readOnly);
}

// Routes
app.use("/api/admin", adminRoutes);

// Basic health check
app.get("/", (req, res) => {
  res.json({ message: "Admin API running", status: "ok" });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({
    message: err.message || "Something went wrong!",
    error: process.env.NODE_ENV === "development" ? err : {},
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ message: "Route not found" });
});

const configuredPort = Number.parseInt(process.env.PORT || "", 10);
const defaultPort = 5000;
const basePort = Number.isInteger(configuredPort) ? configuredPort : defaultPort;
const canRetryPort = process.env.NODE_ENV !== "production";
const maxPortRetries = canRetryPort ? 20 : 0;

if (process.env.PORT && !Number.isInteger(configuredPort)) {
  console.warn(
    `Invalid PORT "${process.env.PORT}" in environment. Falling back to ${defaultPort}.`
  );
}

const startServer = (port, retriesLeft) => {
  const server = app.listen(port, () => {
    if (port !== basePort) {
      console.warn(`Port ${basePort} was in use, switched to port ${port}.`);
    }
    console.log(`Server running on port ${port}`);
  });

  server.on("error", (err) => {
    if (err.code === "EADDRINUSE" && retriesLeft > 0) {
      const nextPort = port + 1;
      console.warn(`Port ${port} is in use. Retrying on port ${nextPort}...`);
      startServer(nextPort, retriesLeft - 1);
      return;
    }

    if (err.code === "EADDRINUSE") {
      console.error(
        `Port ${port} is already in use. Stop the process on that port or set PORT in .env.`
      );
    } else {
      console.error("Failed to start server:", err);
    }
    process.exit(1);
  });
};

const bootstrap = async () => {
  try {
    await connectToDatabase();
    startServer(basePort, maxPortRetries);
  } catch (err) {
    console.error("MongoDB connection error:", err);
    process.exit(1);
  }
};

bootstrap();
