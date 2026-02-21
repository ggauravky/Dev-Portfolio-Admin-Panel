const express = require("express");
const router = express.Router();
const jwt = require("jsonwebtoken");
const Contact = require("../models/Contact");
const Newsletter = require("../models/Newsletter");
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

// Get dashboard stats
router.get("/stats", auth, async (req, res) => {
  try {
    const totalContacts = await Contact.countDocuments();
    const totalNewsletters = await Newsletter.countDocuments({
      subscribed: { $ne: false },
    });
    const unsubscribedNewsletters = await Newsletter.countDocuments({
      subscribed: false,
    });

    res.json({
      totalContacts,
      totalNewsletters,
      unsubscribedNewsletters,
    });
  } catch (error) {
    console.error("Error fetching stats:", error);
    res.status(500).json({ message: "Error fetching stats" });
  }
});

module.exports = router;
