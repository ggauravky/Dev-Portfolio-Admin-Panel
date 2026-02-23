const express = require("express");
const router = express.Router();
const jwt = require("jsonwebtoken");
const Contact = require("../models/Contact");
const Newsletter = require("../models/Newsletter");
const ChatLog = require("../models/ChatLog");
const MlLog = require("../models/MlLog");
const auth = require("../middleware/auth");

// ====================================================
// FULL CRUD API - All operations (GET, POST, PUT, DELETE)
// ====================================================

// Admin login (allowed even in read-only mode)
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const inputEmail = String(email || "").trim().toLowerCase();
    const inputPassword = String(password || "").trim();
    const adminEmail = String(process.env.ADMIN_EMAIL || "")
      .trim()
      .toLowerCase();
    const adminPassword = String(process.env.ADMIN_PASSWORD || "").trim();

    // Validate input
    if (!inputEmail || !inputPassword) {
      return res
        .status(400)
        .json({ message: "Email and password are required" });
    }

    if (!adminEmail || !adminPassword) {
      console.error("Missing ADMIN_EMAIL or ADMIN_PASSWORD in environment");
      return res.status(500).json({ message: "Server auth is misconfigured" });
    }

    // Simple hardcoded admin check
    if (inputEmail === adminEmail && inputPassword === adminPassword) {
      const token = jwt.sign({ email: inputEmail }, process.env.JWT_SECRET, {
        expiresIn: "7d",
      });

      res.json({
        token,
        message: "Login successful",
      });
    } else {
      if (process.env.NODE_ENV === "development") {
        console.warn(`Invalid admin login attempt for email: ${inputEmail}`);
      }
      res.status(401).json({ message: "Invalid credentials" });
    }
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// Get all contacts with advanced search and filtering
router.get("/contacts", auth, async (req, res) => {
  try {
    const {
      search,
      status,
      sortBy = "createdAt",
      order = "desc",
      limit,
      skip,
    } = req.query;

    let query = {};
    const allowedStatuses = ["unread", "read", "replied"];
    const allowedSortFields = [
      "createdAt",
      "updatedAt",
      "name",
      "email",
      "subject",
      "status",
    ];

    // Search functionality
    if (search) {
      query = {
        $or: [
          { name: { $regex: search, $options: "i" } },
          { email: { $regex: search, $options: "i" } },
          { subject: { $regex: search, $options: "i" } },
          { message: { $regex: search, $options: "i" } },
          { status: { $regex: search, $options: "i" } },
        ],
      };
    }

    // Optional status filter
    if (status && allowedStatuses.includes(status)) {
      query.status = status;
    }

    // Build sort object
    const sortOrder = order === "asc" ? 1 : -1;
    const sortField = allowedSortFields.includes(sortBy) ? sortBy : "createdAt";
    const sortObj = { [sortField]: sortOrder };

    // Execute query with pagination
    let contactsQuery = Contact.find(query).sort(sortObj);

    const parsedSkip = Number.parseInt(skip, 10);
    const parsedLimit = Number.parseInt(limit, 10);
    if (Number.isInteger(parsedSkip) && parsedSkip > 0) {
      contactsQuery = contactsQuery.skip(parsedSkip);
    }
    if (Number.isInteger(parsedLimit) && parsedLimit > 0) {
      contactsQuery = contactsQuery.limit(parsedLimit);
    }

    const contacts = await contactsQuery;
    const total = await Contact.countDocuments(query);

    res.json({ contacts, total });
  } catch (error) {
    console.error("Error fetching contacts:", error);
    res.status(500).json({ message: "Error fetching contacts" });
  }
});

// Get single contact by ID
router.get("/contacts/:id", auth, async (req, res) => {
  try {
    const contact = await Contact.findById(req.params.id);
    if (!contact) {
      return res.status(404).json({ message: "Contact not found" });
    }
    res.json(contact);
  } catch (error) {
    console.error("Error fetching contact:", error);
    res.status(500).json({ message: "Error fetching contact" });
  }
});

// Create new contact
router.post("/contacts", auth, async (req, res) => {
  try {
    const { name, email, subject, message, status } = req.body;

    if (!name || !email || !subject || !message) {
      return res.status(400).json({ message: "All fields are required" });
    }

    const ipAddress =
      (req.headers["x-forwarded-for"] || "").toString().split(",")[0].trim() ||
      req.ip ||
      "unknown";
    const userAgent = req.get("user-agent") || "unknown";

    const contact = new Contact({
      name,
      email,
      subject,
      message,
      status,
      ipAddress,
      userAgent,
    });
    await contact.save();

    res.status(201).json({ message: "Contact created successfully", contact });
  } catch (error) {
    console.error("Error creating contact:", error);
    res.status(500).json({ message: "Error creating contact" });
  }
});

// Update contact
router.put("/contacts/:id", auth, async (req, res) => {
  try {
    const { name, email, subject, message, status } = req.body;
    const updates = {};

    if (name !== undefined) updates.name = name;
    if (email !== undefined) updates.email = email;
    if (subject !== undefined) updates.subject = subject;
    if (message !== undefined) updates.message = message;
    if (status !== undefined) updates.status = status;

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ message: "No fields provided for update" });
    }

    const contact = await Contact.findByIdAndUpdate(
      req.params.id,
      updates,
      { new: true, runValidators: true }
    );

    if (!contact) {
      return res.status(404).json({ message: "Contact not found" });
    }

    res.json({ message: "Contact updated successfully", contact });
  } catch (error) {
    console.error("Error updating contact:", error);
    res.status(500).json({ message: "Error updating contact" });
  }
});

// Delete contact
router.delete("/contacts/:id", auth, async (req, res) => {
  try {
    const contact = await Contact.findByIdAndDelete(req.params.id);

    if (!contact) {
      return res.status(404).json({ message: "Contact not found" });
    }

    res.json({ message: "Contact deleted successfully" });
  } catch (error) {
    console.error("Error deleting contact:", error);
    res.status(500).json({ message: "Error deleting contact" });
  }
});

// Bulk delete contacts
router.post("/contacts/bulk-delete", auth, async (req, res) => {
  try {
    const { ids } = req.body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ message: "No contact IDs provided" });
    }

    const result = await Contact.deleteMany({ _id: { $in: ids } });

    res.json({
      message: `${result.deletedCount} contact(s) deleted successfully`,
      deletedCount: result.deletedCount,
    });
  } catch (error) {
    console.error("Error bulk deleting contacts:", error);
    res.status(500).json({ message: "Error deleting contacts" });
  }
});

// Get all newsletter subscriptions with advanced search and filtering
router.get("/newsletters", auth, async (req, res) => {
  try {
    const {
      search,
      subscribed,
      sortBy = "createdAt",
      order = "desc",
      limit,
      skip,
    } = req.query;

    let query = {};
    const allowedSortFields = [
      "createdAt",
      "updatedAt",
      "email",
      "subscribed",
      "subscribedAt",
      "unsubscribedAt",
    ];

    // Search functionality
    if (search) {
      query = { email: { $regex: search, $options: "i" } };
    }

    // Optional subscribed filter
    if (subscribed === "true") {
      query.subscribed = true;
    } else if (subscribed === "false") {
      query.subscribed = false;
    }

    // Build sort object
    const sortOrder = order === "asc" ? 1 : -1;
    const sortField = allowedSortFields.includes(sortBy) ? sortBy : "createdAt";
    const sortObj = { [sortField]: sortOrder };

    // Execute query with pagination
    let newslettersQuery = Newsletter.find(query).sort(sortObj);

    const parsedSkip = Number.parseInt(skip, 10);
    const parsedLimit = Number.parseInt(limit, 10);
    if (Number.isInteger(parsedSkip) && parsedSkip > 0) {
      newslettersQuery = newslettersQuery.skip(parsedSkip);
    }
    if (Number.isInteger(parsedLimit) && parsedLimit > 0) {
      newslettersQuery = newslettersQuery.limit(parsedLimit);
    }

    const newsletters = await newslettersQuery;
    const total = await Newsletter.countDocuments(query);

    res.json({ newsletters, total });
  } catch (error) {
    console.error("Error fetching newsletters:", error);
    res.status(500).json({ message: "Error fetching newsletters" });
  }
});

// Get single newsletter by ID
router.get("/newsletters/:id", auth, async (req, res) => {
  try {
    const newsletter = await Newsletter.findById(req.params.id);
    if (!newsletter) {
      return res
        .status(404)
        .json({ message: "Newsletter subscription not found" });
    }
    res.json(newsletter);
  } catch (error) {
    console.error("Error fetching newsletter:", error);
    res.status(500).json({ message: "Error fetching newsletter" });
  }
});

// Create new newsletter subscription
router.post("/newsletters", auth, async (req, res) => {
  try {
    const { email } = req.body;
    const normalizedEmail = String(email || "").trim().toLowerCase();

    if (!normalizedEmail) {
      return res.status(400).json({ message: "Email is required" });
    }

    // Check if email already exists
    const existing = await Newsletter.findOne({ email: normalizedEmail });
    if (existing) {
      if (!existing.subscribed) {
        await existing.resubscribe();
        return res.json({
          message: "Newsletter subscription re-activated successfully",
          newsletter: existing,
        });
      }
      return res.status(400).json({ message: "Email already subscribed" });
    }

    const ipAddress =
      (req.headers["x-forwarded-for"] || "").toString().split(",")[0].trim() ||
      req.ip ||
      "unknown";
    const userAgent = req.get("user-agent") || "unknown";

    const newsletter = new Newsletter({
      email: normalizedEmail,
      ipAddress,
      userAgent,
      subscribed: true,
      subscribedAt: Date.now(),
    });
    await newsletter.save();

    res
      .status(201)
      .json({
        message: "Newsletter subscription created successfully",
        newsletter,
      });
  } catch (error) {
    console.error("Error creating newsletter:", error);
    res.status(500).json({ message: "Error creating newsletter subscription" });
  }
});

// Update newsletter subscription
router.put("/newsletters/:id", auth, async (req, res) => {
  try {
    const { email, subscribed } = req.body;
    const updates = {};
    const normalizedEmail = email ? String(email).trim().toLowerCase() : null;

    if (normalizedEmail) {
      // Check if email already exists (excluding current record)
      const existing = await Newsletter.findOne({
        email: normalizedEmail,
        _id: { $ne: req.params.id },
      });

      if (existing) {
        return res.status(400).json({ message: "Email already subscribed" });
      }

      updates.email = normalizedEmail;
    }

    if (typeof subscribed === "boolean") {
      updates.subscribed = subscribed;
      updates.unsubscribedAt = subscribed ? null : Date.now();
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ message: "No fields provided for update" });
    }

    const newsletter = await Newsletter.findByIdAndUpdate(
      req.params.id,
      updates,
      { new: true, runValidators: true }
    );

    if (!newsletter) {
      return res
        .status(404)
        .json({ message: "Newsletter subscription not found" });
    }

    res.json({
      message: "Newsletter subscription updated successfully",
      newsletter,
    });
  } catch (error) {
    console.error("Error updating newsletter:", error);
    res.status(500).json({ message: "Error updating newsletter subscription" });
  }
});

// Delete newsletter subscription
router.delete("/newsletters/:id", auth, async (req, res) => {
  try {
    const newsletter = await Newsletter.findByIdAndDelete(req.params.id);

    if (!newsletter) {
      return res
        .status(404)
        .json({ message: "Newsletter subscription not found" });
    }

    res.json({ message: "Newsletter subscription deleted successfully" });
  } catch (error) {
    console.error("Error deleting newsletter:", error);
    res.status(500).json({ message: "Error deleting newsletter subscription" });
  }
});

// Bulk delete newsletters
router.post("/newsletters/bulk-delete", auth, async (req, res) => {
  try {
    const { ids } = req.body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ message: "No newsletter IDs provided" });
    }

    const result = await Newsletter.deleteMany({ _id: { $in: ids } });

    res.json({
      message: `${result.deletedCount} newsletter subscription(s) deleted successfully`,
      deletedCount: result.deletedCount,
    });
  } catch (error) {
    console.error("Error bulk deleting newsletters:", error);
    res
      .status(500)
      .json({ message: "Error deleting newsletter subscriptions" });
  }
});

// Get chat logs with filtering, search and pagination
router.get("/chats", auth, async (req, res) => {
  try {
    const {
      search,
      source,
      degraded,
      intentTag,
      country,
      sessionId,
      sortBy = "createdAt",
      order = "desc",
      limit,
      skip,
    } = req.query;

    const allowedSortFields = [
      "createdAt",
      "updatedAt",
      "responseTimeMs",
      "source",
      "degraded",
      "country",
      "intentTag",
      "messageIndex",
      "historyLength",
      "messageLength",
    ];

    const query = {};

    if (search) {
      query.$or = [
        { userMessage: { $regex: search, $options: "i" } },
        { aiReply: { $regex: search, $options: "i" } },
        { model: { $regex: search, $options: "i" } },
        { ipAddress: { $regex: search, $options: "i" } },
        { sessionId: { $regex: search, $options: "i" } },
        { country: { $regex: search, $options: "i" } },
        { city: { $regex: search, $options: "i" } },
        { region: { $regex: search, $options: "i" } },
        { timezone: { $regex: search, $options: "i" } },
      ];
    }

    if (source && ["gemini", "fallback"].includes(source)) {
      query.source = source;
    }

    if (degraded === "true") {
      query.degraded = true;
    } else if (degraded === "false") {
      query.degraded = false;
    }

    if (intentTag) {
      query.intentTag = intentTag;
    }

    if (country) {
      query.country = country;
    }

    if (sessionId) {
      query.sessionId = sessionId;
    }

    const sortOrder = order === "asc" ? 1 : -1;
    const sortField = allowedSortFields.includes(sortBy) ? sortBy : "createdAt";
    const sortObj = { [sortField]: sortOrder };

    let chatsQuery = ChatLog.find(query).sort(sortObj);

    const parsedSkip = Number.parseInt(skip, 10);
    const parsedLimit = Number.parseInt(limit, 10);
    if (Number.isInteger(parsedSkip) && parsedSkip > 0) {
      chatsQuery = chatsQuery.skip(parsedSkip);
    }
    if (Number.isInteger(parsedLimit) && parsedLimit > 0) {
      chatsQuery = chatsQuery.limit(parsedLimit);
    }

    const chats = await chatsQuery;
    const total = await ChatLog.countDocuments(query);

    res.json({ chats, total });
  } catch (error) {
    console.error("Error fetching chats:", error);
    res.status(500).json({ message: "Error fetching chats" });
  }
});

// Get single chat log
router.get("/chats/:id", auth, async (req, res) => {
  try {
    const chat = await ChatLog.findById(req.params.id);
    if (!chat) {
      return res.status(404).json({ message: "Chat log not found" });
    }
    res.json(chat);
  } catch (error) {
    console.error("Error fetching chat log:", error);
    res.status(500).json({ message: "Error fetching chat log" });
  }
});

// Delete single chat log
router.delete("/chats/:id", auth, async (req, res) => {
  try {
    const chat = await ChatLog.findByIdAndDelete(req.params.id);
    if (!chat) {
      return res.status(404).json({ message: "Chat log not found" });
    }
    res.json({ message: "Chat log deleted successfully" });
  } catch (error) {
    console.error("Error deleting chat log:", error);
    res.status(500).json({ message: "Error deleting chat log" });
  }
});

// Bulk delete chat logs
router.post("/chats/bulk-delete", auth, async (req, res) => {
  try {
    const { ids } = req.body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ message: "No chat log IDs provided" });
    }

    const result = await ChatLog.deleteMany({ _id: { $in: ids } });

    res.json({
      message: `${result.deletedCount} chat log(s) deleted successfully`,
      deletedCount: result.deletedCount,
    });
  } catch (error) {
    console.error("Error bulk deleting chat logs:", error);
    res.status(500).json({ message: "Error deleting chat logs" });
  }
});

// Get ML logs with filtering, search and pagination
router.get("/mllogs", auth, async (req, res) => {
  try {
    const {
      search,
      demoType,
      event,
      countryCode,
      sortBy = "createdAt",
      order = "desc",
      limit,
      skip,
    } = req.query;

    const allowedDemoTypes = ["image_analyzer", "prompt_improver"];
    const allowedSortFields = [
      "createdAt",
      "updatedAt",
      "demoType",
      "event",
      "predictionLabel",
      "nlpAction",
      "nlpTone",
      "countryCode",
      "city",
    ];

    const query = {};

    if (search) {
      query.$or = [
        { demoType: { $regex: search, $options: "i" } },
        { event: { $regex: search, $options: "i" } },
        { predictionLabel: { $regex: search, $options: "i" } },
        { "topPredictions.className": { $regex: search, $options: "i" } },
        { inputPrompt: { $regex: search, $options: "i" } },
        { improvedPrompt: { $regex: search, $options: "i" } },
        { nlpAction: { $regex: search, $options: "i" } },
        { nlpTone: { $regex: search, $options: "i" } },
        { ipAddress: { $regex: search, $options: "i" } },
        { userAgent: { $regex: search, $options: "i" } },
        { countryCode: { $regex: search, $options: "i" } },
        { city: { $regex: search, $options: "i" } },
      ];
    }

    if (demoType && allowedDemoTypes.includes(demoType)) {
      query.demoType = demoType;
    }

    if (event) {
      query.event = event;
    }

    if (countryCode) {
      query.countryCode = countryCode;
    }

    const sortOrder = order === "asc" ? 1 : -1;
    const sortField = allowedSortFields.includes(sortBy) ? sortBy : "createdAt";
    const sortObj = { [sortField]: sortOrder };

    let mlLogsQuery = MlLog.find(query).sort(sortObj);

    const parsedSkip = Number.parseInt(skip, 10);
    const parsedLimit = Number.parseInt(limit, 10);
    if (Number.isInteger(parsedSkip) && parsedSkip > 0) {
      mlLogsQuery = mlLogsQuery.skip(parsedSkip);
    }
    if (Number.isInteger(parsedLimit) && parsedLimit > 0) {
      mlLogsQuery = mlLogsQuery.limit(parsedLimit);
    }

    const mllogs = await mlLogsQuery;
    const total = await MlLog.countDocuments(query);

    res.json({ mllogs, total });
  } catch (error) {
    console.error("Error fetching ML logs:", error);
    res.status(500).json({ message: "Error fetching ML logs" });
  }
});

// Get single ML log
router.get("/mllogs/:id", auth, async (req, res) => {
  try {
    const mlLog = await MlLog.findById(req.params.id);
    if (!mlLog) {
      return res.status(404).json({ message: "ML log not found" });
    }
    res.json(mlLog);
  } catch (error) {
    console.error("Error fetching ML log:", error);
    res.status(500).json({ message: "Error fetching ML log" });
  }
});

// Delete single ML log
router.delete("/mllogs/:id", auth, async (req, res) => {
  try {
    const mlLog = await MlLog.findByIdAndDelete(req.params.id);
    if (!mlLog) {
      return res.status(404).json({ message: "ML log not found" });
    }
    res.json({ message: "ML log deleted successfully" });
  } catch (error) {
    console.error("Error deleting ML log:", error);
    res.status(500).json({ message: "Error deleting ML log" });
  }
});

// Bulk delete ML logs
router.post("/mllogs/bulk-delete", auth, async (req, res) => {
  try {
    const { ids } = req.body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ message: "No ML log IDs provided" });
    }

    const result = await MlLog.deleteMany({ _id: { $in: ids } });

    res.json({
      message: `${result.deletedCount} ML log(s) deleted successfully`,
      deletedCount: result.deletedCount,
    });
  } catch (error) {
    console.error("Error bulk deleting ML logs:", error);
    res.status(500).json({ message: "Error deleting ML logs" });
  }
});

// Get dashboard stats
router.get("/stats", auth, async (req, res) => {
  try {
    const totalContacts = await Contact.countDocuments();
    const unreadContacts = await Contact.countDocuments({ status: "unread" });
    const totalNewsletters = await Newsletter.countDocuments({
      subscribed: { $ne: false },
    });
    const unsubscribedNewsletters = await Newsletter.countDocuments({
      subscribed: false,
    });
    const totalChats = await ChatLog.countDocuments();
    const degradedChats = await ChatLog.countDocuments({ degraded: true });
    const fallbackChats = await ChatLog.countDocuments({ source: "fallback" });
    const totalMlLogs = await MlLog.countDocuments();
    const imageAnalyzerLogs = await MlLog.countDocuments({
      demoType: "image_analyzer",
    });
    const promptImproverLogs = await MlLog.countDocuments({
      demoType: "prompt_improver",
    });
    const avgResponseRow = await ChatLog.aggregate([
      { $match: { responseTimeMs: { $type: "number", $gt: 0 } } },
      { $group: { _id: null, avgMs: { $avg: "$responseTimeMs" } } },
    ]);
    const avgChatResponseMs =
      avgResponseRow.length > 0 ? Math.round(avgResponseRow[0].avgMs) : null;

    res.json({
      totalContacts,
      unreadContacts,
      totalNewsletters,
      unsubscribedNewsletters,
      totalChats,
      degradedChats,
      fallbackChats,
      totalMlLogs,
      imageAnalyzerLogs,
      promptImproverLogs,
      avgChatResponseMs,
    });
  } catch (error) {
    console.error("Error fetching stats:", error);
    res.status(500).json({ message: "Error fetching stats" });
  }
});

module.exports = router;
