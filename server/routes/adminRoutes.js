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

    // Validate input
    if (!email || !password) {
      return res
        .status(400)
        .json({ message: "Email and password are required" });
    }

    // Simple hardcoded admin check
    if (
      email === process.env.ADMIN_EMAIL &&
      password === process.env.ADMIN_PASSWORD
    ) {
      const token = jwt.sign({ email: email }, process.env.JWT_SECRET, {
        expiresIn: "7d",
      });

      res.json({
        token,
        message: "Login successful",
      });
    } else {
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
      sortBy = "createdAt",
      order = "desc",
      limit,
      skip,
    } = req.query;

    let query = {};

    // Search functionality
    if (search) {
      query = {
        $or: [
          { name: { $regex: search, $options: "i" } },
          { email: { $regex: search, $options: "i" } },
          { message: { $regex: search, $options: "i" } },
        ],
      };
    }

    // Build sort object
    const sortOrder = order === "asc" ? 1 : -1;
    const sortObj = { [sortBy]: sortOrder };

    // Execute query with pagination
    let contactsQuery = Contact.find(query).sort(sortObj);

    if (skip) contactsQuery = contactsQuery.skip(parseInt(skip));
    if (limit) contactsQuery = contactsQuery.limit(parseInt(limit));

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
    const { name, email, message } = req.body;

    if (!name || !email || !message) {
      return res.status(400).json({ message: "All fields are required" });
    }

    const contact = new Contact({ name, email, message });
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
    const { name, email, message } = req.body;

    const contact = await Contact.findByIdAndUpdate(
      req.params.id,
      { name, email, message },
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
      sortBy = "createdAt",
      order = "desc",
      limit,
      skip,
    } = req.query;

    let query = {};

    // Search functionality
    if (search) {
      query = { email: { $regex: search, $options: "i" } };
    }

    // Build sort object
    const sortOrder = order === "asc" ? 1 : -1;
    const sortObj = { [sortBy]: sortOrder };

    // Execute query with pagination
    let newslettersQuery = Newsletter.find(query).sort(sortObj);

    if (skip) newslettersQuery = newslettersQuery.skip(parseInt(skip));
    if (limit) newslettersQuery = newslettersQuery.limit(parseInt(limit));

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

    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }

    // Check if email already exists
    const existing = await Newsletter.findOne({ email });
    if (existing) {
      return res.status(400).json({ message: "Email already subscribed" });
    }

    const newsletter = new Newsletter({ email });
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
    const { email } = req.body;

    // Check if email already exists (excluding current record)
    const existing = await Newsletter.findOne({
      email,
      _id: { $ne: req.params.id },
    });

    if (existing) {
      return res.status(400).json({ message: "Email already subscribed" });
    }

    const newsletter = await Newsletter.findByIdAndUpdate(
      req.params.id,
      { email },
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
    const totalNewsletters = await Newsletter.countDocuments();

    res.json({
      totalContacts,
      totalNewsletters,
    });
  } catch (error) {
    console.error("Error fetching stats:", error);
    res.status(500).json({ message: "Error fetching stats" });
  }
});

module.exports = router;
