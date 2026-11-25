import { Link } from "react-router-dom";
import AdminLayout from "../../../components/AdminLayout";
import { control, PageHeader } from "../../../components/ui/Primitives";
import { routes } from "../../../components/data/Records";

export const status = (value) => value === true ? "Verified" : value === false ? "Unverified" : "Unknown";
export const subscribed = (value) => value === true ? "Active" : value === false ? "Unsubscribed" : "Unknown";
export const person = (row) => row.displayName || row.name || "Name unrecorded";

export function Workspace({ title, description, children, current }) {
  const navigation = [["Users", routes.users], ["Activity", routes.activity], ["Blog engagement", routes["blog-posts"]], ["Security", "/admin/security"],
    ["System health", "/admin/system"], ["Settings", "/admin/settings"]];
  return <AdminLayout><div className="min-w-0 space-y-5 px-4 sm:px-0">
    <PageHeader title={title} description={description} />
    <nav aria-label="Operations views" className="flex flex-wrap gap-2 border-b border-rule pb-3">
      {navigation.map(([name, path]) => <Link key={path} to={path} aria-current={current === path ? "page" : undefined}
        className={control}>{name}</Link>)}
    </nav>
    {children}
  </div></AdminLayout>;
}
