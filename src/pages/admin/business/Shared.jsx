import { PageHeader } from "../../../components/ui/Primitives";

export const status = (value) => value === true ? "Verified" : value === false ? "Unverified" : "Unknown";
export const subscribed = (value) => value === true ? "Active" : value === false ? "Unsubscribed" : "Unknown";
export const person = (row) => row.displayName || row.name || "Name unrecorded";

export function Workspace({ title, description, children }) {
  return <div className="workspace-page">
    <PageHeader title={title} description={description} />
    {children}
  </div>;
}
