import { Navigate, useLocation } from "react-router-dom";
import { lazy, Suspense } from "react";
import { useAdminAuth } from "../context/AdminAuth";
import { Button, InlineAlert } from "../components/ui/Primitives";
import { intendedDestination } from "./workspace";

const WorkspaceShell = lazy(() => import("../components/layout/WorkspaceShell"));

export default function AdminRoutes() {
  const { status, message, restore } = useAdminAuth();
  const location = useLocation();
  if (status === "checking") return <main className="admin-wrap py-step-4"><InlineAlert>Checking administrator session…</InlineAlert></main>;
  if (status === "unavailable") return (
    <main className="admin-wrap space-y-3 py-step-4">
      <InlineAlert tone="error">{message || "The admin API is unavailable."}</InlineAlert>
      <Button onClick={() => restore({ hide: true })}>Retry</Button>
    </main>
  );
  if (status !== "authenticated") {
    const from = intendedDestination(location.pathname + location.search + location.hash);
    return <Navigate to="/admin/login" replace state={{ from }} />;
  }
  return <Suspense fallback={<main className="admin-wrap py-step-4"><InlineAlert>Loading workspace…</InlineAlert></main>}><WorkspaceShell /></Suspense>;
}
