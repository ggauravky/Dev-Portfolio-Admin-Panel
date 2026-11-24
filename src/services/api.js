const API_URL = "/api/admin";
export const sessionExpiredEvent = "admin-session-expired";
let sessionVersion = 0;
export const markSessionChanged = () => { sessionVersion++; };

async function request(path, { notify = true, csrfToken, ...options } = {}) {
  const version = sessionVersion;
  let response;
  try {
    response = await fetch(API_URL + path, {
      ...options,
      credentials: "same-origin",
      headers: {
        ...(options.body ? { "Content-Type": "application/json" } : {}),
        ...(csrfToken ? { "X-Admin-CSRF": csrfToken } : {}),
      },
    });
  } catch (error) {
    if (error.name === "AbortError") throw error;
    throw Object.assign(new Error("The admin API is unavailable. Try again shortly."), { status: 503 });
  }
  if (notify && response.status === 401 && !options.signal?.aborted && version === sessionVersion) {
    markSessionChanged();
    window.dispatchEvent(new Event(sessionExpiredEvent));
  }
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const retryAfter = Number(response.headers.get("retry-after"));
    const message = response.status === 429
      ? "Too many attempts. " + (retryAfter > 0 ? `Try again in ${retryAfter} seconds.` : "Try again shortly.")
      : response.status === 503
        ? data?.error?.message || "The admin API is unavailable. Try again shortly."
        : data?.error?.message || data?.message || "Request failed";
    throw Object.assign(new Error(message), { status: response.status, code: data?.error?.code, retryAfter });
  }
  if (!data) throw Object.assign(new Error("The admin API returned an invalid response."), { status: 503 });
  return data;
}

const list = (path) => (params, signal) => request(path + "?" + new URLSearchParams(params), { signal });

export const login = (email, password) => request("/login", {
  notify: false, method: "POST", body: JSON.stringify({ email, password }),
});
export const getSession = (signal) => request("/me", { signal, notify: false });
export const logout = (csrfToken) => request("/logout", { method: "POST", csrfToken, notify: false });
export const getStats = () => request("/stats");
export const getContacts = list("/contacts");
export const getNewsletters = list("/newsletters");
const financialPaths = {
  transactions: "/transactions", bookings: "/bookings", "support-payments": "/support-payments",
  receipts: "/receipts", "webhook-events": "/webhook-events", "legacy-payments": "/legacy-payments",
  reconciliation: "/financial-reconciliation",
};
export const getFinancialAnalytics = list("/financial-analytics");
export function getFinancialRows(query, signal) {
  const params = new URLSearchParams(query);
  const path = financialPaths[params.get("endpoint")];
  params.delete("endpoint");
  return list(path)(params, signal);
}
export async function getFinancialDetail(query, signal) {
  const params = new URLSearchParams(query);
  const path = financialPaths[params.get("endpoint")] + "/" + encodeURIComponent(params.get("id"));
  return { data: await request(path, { signal }) };
}
export const getChats = list("/chats");
export const getChatConversations = list("/chat-conversations");
export const getChatAnalytics = list("/chat-analytics");
export const getChatKnowledge = list("/chat-knowledge");
export const getChatOperations = list("/chat-operations");
export function getChatConversation(query, signal) {
  const params = new URLSearchParams(query);
  const reference = params.get("reference");
  params.delete("reference");
  return request("/chat-conversations/" + encodeURIComponent(reference) + "?" + params, { signal });
}
