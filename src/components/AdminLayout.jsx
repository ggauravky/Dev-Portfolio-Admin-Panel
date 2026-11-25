import { useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAdminAuth } from "../context/AdminAuth";
import { Button, InlineAlert, SkipLink, TextLink } from "./ui/Primitives";

const destinations = [
  ["Dashboard", "/admin", /^\/admin\/?$/], ["Contacts", "/admin/contacts", /^\/admin\/contacts(?:\/|$)/],
  ["Newsletter", "/admin/newsletter", /^\/admin\/newsletter(?:\/|$)/], ["AI Intelligence", "/admin/chats", /^\/admin\/chats(?:\/|$)/],
  ["Bookings", "/admin/bookings", /^\/admin\/bookings(?:\/|$)/], ["Finance", "/admin/financial", /^\/admin\/(financial|support-payments)(?:\/|$)/],
  ["Operations", "/admin/users", /^\/admin\/(users|activity|blog-engagement|security|system|settings)(?:\/|$)/],
];

export function PortfolioLink() {
  return <TextLink href="https://ggauravky.vercel.app/" target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center text-small">View Portfolio</TextLink>;
}

export default function AdminLayout({ children }) {
  const { pathname } = useLocation();
  const { signOut } = useAdminAuth();
  const [error, setError] = useState("");
  const [loggingOut, setLoggingOut] = useState(false);
  const submitting = useRef(false);

  async function handleLogout() {
    if (submitting.current) return;
    submitting.current = true;
    setLoggingOut(true);
    setError("");
    try { await signOut(); }
    catch (failure) { setError(failure.message); }
    finally { submitting.current = false; setLoggingOut(false); }
  }

  return <div className="flex min-h-screen flex-col">
    <SkipLink />
    <header className="border-b border-rule bg-ink">
      <div className="admin-wrap">
        <div className="flex items-center justify-between gap-2 py-2">
          <Link to="/admin" className="min-w-0 py-2 font-serif text-h3 hover:underline">Gaurav Kumar Yadav</Link>
          <span className="ml-auto hidden font-mono text-xs text-muted sm:inline">Private workspace</span>
          <Button variant="ghost" className="shrink-0" onClick={handleLogout} loading={loggingOut}>{loggingOut ? "Signing out…" : "Logout"}</Button>
        </div>
        <nav aria-label="Admin navigation" className="admin-nav">
          {destinations.map(([label, path, match]) => <Link key={path} to={path} aria-current={match.test(pathname) ? "page" : undefined}
            className="inline-flex min-h-11 items-center whitespace-nowrap text-small text-muted hover:text-paper">{label}</Link>)}
        </nav>
      </div>
    </header>
    <main id="main-content" tabIndex={-1} className="admin-wrap min-w-0 flex-1 py-step-4">
      {error && <InlineAlert tone="error" className="mb-4">{error}</InlineAlert>}
      {children}
    </main>
    <footer className="border-t border-rule">
      <div className="admin-wrap flex items-center justify-between gap-2 text-small text-muted">
        <span className="font-mono text-xs">Portfolio Admin</span><PortfolioLink />
      </div>
    </footer>
  </div>;
}
