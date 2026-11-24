import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import * as api from "../services/api";

const Context = createContext(null);
const anonymous = { status: "anonymous", details: null };
const verified = (details) => ({ status: "authenticated", details });

export function AdminAuthProvider({ children }) {
  const [state, setState] = useState({ status: "checking", details: null });
  const pending = useRef(null);
  const changing = useRef(false);
  const channel = useRef(null);

  const restore = useCallback(async ({ hide = false } = {}) => {
    if (changing.current) return;
    pending.current?.abort();
    const controller = new AbortController();
    pending.current = controller;
    if (hide) setState({ status: "checking", details: null });
    try {
      const { data } = await api.getSession(controller.signal);
      if (!controller.signal.aborted) setState(verified(data));
    } catch (error) {
      if (!controller.signal.aborted) {
        setState(error.status === 401 ? anonymous : { status: "unavailable", details: null, message: error.message });
      }
    }
  }, []);

  useEffect(() => {
    const expire = () => {
      pending.current?.abort();
      setState(anonymous);
      channel.current?.postMessage("session-changed");
    };
    if (typeof BroadcastChannel !== "undefined") {
      channel.current = new BroadcastChannel("portfolio-admin-auth");
      channel.current.onmessage = () => {
        api.markSessionChanged();
        void restore({ hide: true });
      };
    }
    const recheck = () => { if (document.visibilityState === "visible") void restore(); };
    const restorePage = (event) => { if (event.persisted) void restore({ hide: true }); };
    window.addEventListener(api.sessionExpiredEvent, expire);
    window.addEventListener("pageshow", restorePage);
    document.addEventListener("visibilitychange", recheck);
    void restore();
    return () => {
      pending.current?.abort();
      window.removeEventListener(api.sessionExpiredEvent, expire);
      window.removeEventListener("pageshow", restorePage);
      document.removeEventListener("visibilitychange", recheck);
      channel.current?.close();
      channel.current = null;
    };
  }, [restore]);

  useEffect(() => {
    if (state.status !== "authenticated") return;
    // Revalidate even while the tab is idle, but avoid periodic requests that extend idle time.
    const endsAt = Math.min(Date.parse(state.details.session.expiresAt), Date.parse(state.details.session.idleExpiresAt));
    const timeout = setTimeout(() => { void restore(); }, Math.max(1000, endsAt - Date.now() + 1000));
    return () => clearTimeout(timeout);
  }, [state, restore]);

  async function signIn(email, password) {
    if (changing.current) return;
    changing.current = true;
    pending.current?.abort();
    api.markSessionChanged();
    try {
      const { data } = await api.login(email, password);
      setState(verified(data));
      channel.current?.postMessage("session-changed");
    } finally { changing.current = false; }
  }

  async function signOut() {
    if (changing.current || !state.details) return;
    changing.current = true;
    pending.current?.abort();
    api.markSessionChanged();
    try {
      await api.logout(state.details.csrfToken);
      setState(anonymous);
      channel.current?.postMessage("session-changed");
    } finally { changing.current = false; }
  }

  return <Context.Provider value={{ ...state, restore, signIn, signOut }}>{children}</Context.Provider>;
}

export const useAdminAuth = () => useContext(Context);
