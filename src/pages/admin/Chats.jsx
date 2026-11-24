import { useState } from "react";
import AdminLayout from "../../components/AdminLayout";
import Overview from "./chat/Overview";
import Conversations from "./chat/Conversations";
import Operations from "./chat/Operations";
import { control } from "./chat/Shared";

const views = { Overview, Conversations, Operations };

export default function Chats() {
  const [tab, setTab] = useState("Overview");
  const View = views[tab];
  return <AdminLayout>
    <div className="px-4 sm:px-0 space-y-5">
      <header>
        <h1 className="text-3xl font-bold text-slate-900">AI Intelligence</h1>
        <p className="mt-2 text-sm text-slate-600">Review recorded assistant conversations, retrieval activity, and shared operational signals.</p>
      </header>
      <nav aria-label="AI Intelligence views" className="flex flex-wrap gap-2 border-b border-slate-200 pb-3">
        {Object.keys(views).map((name) => <button type="button" key={name} className={control + (name === tab ? " !border-teal-700 !bg-teal-50" : "")}
          aria-pressed={tab === name} onClick={() => setTab(name)}>{name}</button>)}
      </nav>
      <section aria-label={tab}><View /></section>
    </div>
  </AdminLayout>;
}
