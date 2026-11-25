import { control, PageHeader } from "../../components/ui/Primitives";
import { useState } from "react";
import AdminLayout from "../../components/AdminLayout";
import Overview from "./chat/Overview";
import Conversations from "./chat/Conversations";
import Operations from "./chat/Operations";

const views = { Overview, Conversations, Operations };

export default function Chats() {
  const [tab, setTab] = useState("Overview");
  const View = views[tab];
  return <AdminLayout>
    <div className="space-y-5">
      <PageHeader title="AI Intelligence" description="Review recorded assistant conversations, retrieval activity, and shared operational signals." />
      <nav aria-label="AI Intelligence views" className="flex flex-wrap gap-2 border-b border-rule pb-3">
        {Object.keys(views).map((name) => <button type="button" key={name} className={control}
          aria-pressed={tab === name} onClick={() => setTab(name)}>{name}</button>)}
      </nav>
      <section aria-label={tab}><View /></section>
    </div>
  </AdminLayout>;
}
