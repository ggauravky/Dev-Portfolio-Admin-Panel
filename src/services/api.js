const API_URL =
  import.meta.env.VITE_API_URL || "http://localhost:5001/api/admin";

// Get token from localStorage
const getToken = () => {
  return localStorage.getItem("adminToken");
};

// Helper function for authenticated requests
const authFetch = async (url, options = {}) => {
  const token = getToken();
  const response = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...options.headers,
    },
  });

  if (response.status === 401) {
    localStorage.removeItem("adminToken");
    window.location.href = "/admin/login";
    throw new Error("Session expired. Please login again.");
  }

  return response;
};

// Login
export const login = async (email, password) => {
  try {
    const response = await fetch(`${API_URL}/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email, password }),
    });

    // Check if response is ok before parsing JSON
    if (!response.ok) {
      const data = await response
        .json()
        .catch(() => ({ message: "Login failed" }));
      throw new Error(data.message || "Login failed");
    }

    const data = await response.json();
    return data;
  } catch (error) {
    // Handle network errors or CORS issues
    if (error.message === "Failed to fetch") {
      throw new Error(
        "Cannot connect to server. Please check:\n" +
          "1. Backend is running on Render\n" +
          "2. FRONTEND_URL is set on Render to: https://ggauravkyadmin.vercel.app\n" +
          "3. VITE_API_URL is set correctly"
      );
    }
    throw error;
  }
};

// Get dashboard stats
export const getStats = async () => {
  const response = await authFetch(`${API_URL}/stats`);

  if (!response.ok) {
    throw new Error("Failed to fetch stats");
  }

  return await response.json();
};

// ==================== CONTACTS API ====================

// Get all contacts with optional search and filters
export const getContacts = async (params = {}) => {
  const queryString = new URLSearchParams(params).toString();
  const url = queryString
    ? `${API_URL}/contacts?${queryString}`
    : `${API_URL}/contacts`;

  const response = await authFetch(url);

  if (!response.ok) {
    throw new Error("Failed to fetch contacts");
  }

  return await response.json();
};

// Get single contact
export const getContact = async (id) => {
  const response = await authFetch(`${API_URL}/contacts/${id}`);

  if (!response.ok) {
    throw new Error("Failed to fetch contact");
  }

  return await response.json();
};

// Create new contact
export const createContact = async (contactData) => {
  const response = await authFetch(`${API_URL}/contacts`, {
    method: "POST",
    body: JSON.stringify(contactData),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Failed to create contact");
  }

  return data;
};

// Update contact
export const updateContact = async (id, contactData) => {
  const response = await authFetch(`${API_URL}/contacts/${id}`, {
    method: "PUT",
    body: JSON.stringify(contactData),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Failed to update contact");
  }

  return data;
};

// Delete contact
export const deleteContact = async (id) => {
  const response = await authFetch(`${API_URL}/contacts/${id}`, {
    method: "DELETE",
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Failed to delete contact");
  }

  return data;
};

// Bulk delete contacts
export const bulkDeleteContacts = async (ids) => {
  const response = await authFetch(`${API_URL}/contacts/bulk-delete`, {
    method: "POST",
    body: JSON.stringify({ ids }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Failed to delete contacts");
  }

  return data;
};

// ==================== NEWSLETTERS API ====================

// Get all newsletters with optional search and filters
export const getNewsletters = async (params = {}) => {
  const queryString = new URLSearchParams(params).toString();
  const url = queryString
    ? `${API_URL}/newsletters?${queryString}`
    : `${API_URL}/newsletters`;

  const response = await authFetch(url);

  if (!response.ok) {
    throw new Error("Failed to fetch newsletters");
  }

  return await response.json();
};

// Get single newsletter
export const getNewsletter = async (id) => {
  const response = await authFetch(`${API_URL}/newsletters/${id}`);

  if (!response.ok) {
    throw new Error("Failed to fetch newsletter");
  }

  return await response.json();
};

// Create new newsletter subscription
export const createNewsletter = async (newsletterData) => {
  const payload =
    typeof newsletterData === "string"
      ? { email: newsletterData }
      : newsletterData;

  const response = await authFetch(`${API_URL}/newsletters`, {
    method: "POST",
    body: JSON.stringify(payload),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Failed to create newsletter subscription");
  }

  return data;
};

// Update newsletter subscription
export const updateNewsletter = async (id, newsletterData) => {
  const payload =
    typeof newsletterData === "string"
      ? { email: newsletterData }
      : newsletterData;

  const response = await authFetch(`${API_URL}/newsletters/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Failed to update newsletter subscription");
  }

  return data;
};

// Delete newsletter subscription
export const deleteNewsletter = async (id) => {
  const response = await authFetch(`${API_URL}/newsletters/${id}`, {
    method: "DELETE",
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Failed to delete newsletter subscription");
  }

  return data;
};

// Bulk delete newsletters
export const bulkDeleteNewsletters = async (ids) => {
  const response = await authFetch(`${API_URL}/newsletters/bulk-delete`, {
    method: "POST",
    body: JSON.stringify({ ids }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data.message || "Failed to delete newsletter subscriptions"
    );
  }

  return data;
};

// ==================== CHATS API ====================

// Get all chat logs with optional search and filters
export const getChats = async (params = {}) => {
  const queryString = new URLSearchParams(params).toString();
  const url = queryString ? `${API_URL}/chats?${queryString}` : `${API_URL}/chats`;

  const response = await authFetch(url);

  if (!response.ok) {
    throw new Error("Failed to fetch chat logs");
  }

  return await response.json();
};

// Get single chat log
export const getChat = async (id) => {
  const response = await authFetch(`${API_URL}/chats/${id}`);

  if (!response.ok) {
    throw new Error("Failed to fetch chat log");
  }

  return await response.json();
};

// Delete single chat log
export const deleteChat = async (id) => {
  const response = await authFetch(`${API_URL}/chats/${id}`, {
    method: "DELETE",
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Failed to delete chat log");
  }

  return data;
};

// Bulk delete chat logs
export const bulkDeleteChats = async (ids) => {
  const response = await authFetch(`${API_URL}/chats/bulk-delete`, {
    method: "POST",
    body: JSON.stringify({ ids }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Failed to delete chat logs");
  }

  return data;
};

// ==================== ML LOGS API ====================

// Get all ML logs with optional search and filters
export const getMlLogs = async (params = {}) => {
  const queryString = new URLSearchParams(params).toString();
  const url = queryString
    ? `${API_URL}/mllogs?${queryString}`
    : `${API_URL}/mllogs`;

  const response = await authFetch(url);

  if (!response.ok) {
    throw new Error("Failed to fetch ML logs");
  }

  return await response.json();
};
