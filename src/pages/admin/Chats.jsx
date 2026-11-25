import { PageHeader } from "../../components/ui/Primitives";
import { Link, useLocation } from "react-router-dom";
import { aiView, aiViews } from "../../routes/workspace";
import Overview from "./chat/Overview";
import Conversations from "./chat/Conversations";
import Operations from "./chat/Operations";

const views = { overview: Overview, conversations: Conversations, operations: Operations };

export default function Chats() {
  const { search } = useLocation();
  const tab = aiView(search);
  const View = views[tab];
  return <div className="workspace-page">
      <PageHeader title="AI Intelligence" description="Assistant conversations, retrieval, and operating signals." />
      <nav aria-label="AI Intelligence views" className="workspace-tabs">
        {Object.entries(aiViews).map(([key, label]) => <Link key={key} to={`?view=${key}`} aria-current={tab === key ? "page" : undefined}>{label}</Link>)}
      </nav>
      <section aria-label={aiViews[tab]}><View /></section>
    </div>;
}
