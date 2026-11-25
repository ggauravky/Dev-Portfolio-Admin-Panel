import { useState } from "react";
import { Button } from "./Primitives";

export function CopyAction({ value, label }) {
  const [notice, setNotice] = useState("");
  if (!value) return null;
  return <span className="inline-flex flex-wrap items-center gap-2">
    <Button onClick={async () => {
      try { await navigator.clipboard.writeText(String(value)); setNotice(`${label} copied.`); }
      catch { setNotice("Clipboard unavailable. Select the value to copy it."); }
    }}>Copy {label.toLowerCase()}</Button>
    {notice && <span role="status" className="text-small text-muted">{notice}</span>}
  </span>;
}
