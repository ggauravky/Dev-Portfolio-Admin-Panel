const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api/admin";

async function request(path, { authenticated = true, ...options } = {}) {
  const token = authenticated ? localStorage.getItem("adminToken") : null;
  const response = await fetch(API_URL + path, {
    ...options,
    headers: {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  if (authenticated && response.status === 401 && !options.signal?.aborted) {
    localStorage.removeItem("adminToken");
    globalThis.location.href = "/admin/login";
  }
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(data?.error?.message || data?.message || "Request failed");
  if (!data) throw new Error("Invalid API response");
  return data;
}

const list = (path) => (params, signal) => request(path + "?" + new URLSearchParams(params), { signal });

export const login = (email, password) => request("/login", {
  authenticated: false, method: "POST", body: JSON.stringify({ email, password }),
});
export const getStats = () => request("/stats");
export const getContacts = list("/contacts");
export const getNewsletters = list("/newsletters");
export const getBookings = list("/bookings");
export const getSupportPayments = list("/support-payments");
export const getChats = list("/chats");
