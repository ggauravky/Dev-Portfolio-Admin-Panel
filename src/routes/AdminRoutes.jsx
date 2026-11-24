import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAdminAuth } from "../context/AdminAuth";

export function intendedDestination(value) {
  if (typeof value !== "string" || !/^\/admin(?:\/[a-z0-9/-]*)?(?:[?#][^\\\r\n]*)?$/i.test(value) ||
      /^\/admin\/login(?:[/?#]|$)/i.test(value)) return "/admin";
  return value;
}

export default function AdminRoutes() {
  const { status, message, restore } = useAdminAuth();
  const location = useLocation();
  if (status === "checking") return <p role="status" className="p-8">Checking administrator session…</p>;
  if (status === "unavailable") return (
    <div className="p-8 space-y-3">
      <p role="alert">{message || "The admin API is unavailable."}</p>
      <button type="button" className="border rounded px-3 py-2" onClick={() => restore({ hide: true })}>Retry</button>
    </div>
  );
  if (status !== "authenticated") {
    const from = intendedDestination(location.pathname + location.search + location.hash);
    return <Navigate to="/admin/login" replace state={{ from }} />;
  }
  return <Outlet />;
}
