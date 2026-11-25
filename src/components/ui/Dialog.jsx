import { useEffect, useId, useRef } from "react";
import { Button, heading, IconButton } from "./Primitives";

export function Dialog({ title, description, onDismiss, children, drawer = false }) {
  const ref = useRef(null);
  const backdropDown = useRef(false);
  const id = useId();
  useEffect(() => {
    const node = ref.current;
    const opener = document.activeElement;
    if (!node.open) node.showModal();
    node.querySelector("[data-initial-focus]")?.focus();
    return () => {
      if (node.open) node.close();
      if (opener?.isConnected) opener.focus({ preventScroll: true });
    };
  }, []);
  const outside = (event) => {
    const box = event.currentTarget.getBoundingClientRect();
    return event.target === event.currentTarget && (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom);
  };
  return <dialog ref={ref} className={`ui-dialog ${drawer ? "ui-drawer" : ""}`} aria-labelledby={`${id}-title`}
    aria-describedby={description ? `${id}-description` : undefined} onCancel={(event) => { event.preventDefault(); onDismiss(); }}
    onPointerDown={drawer ? (event) => { backdropDown.current = outside(event); } : undefined}
    onClick={drawer ? (event) => { if (backdropDown.current && outside(event)) onDismiss(); } : undefined}>
    <header className="flex items-center justify-between gap-2">
      <h2 className={heading} id={`${id}-title`}>{title}</h2>
      <IconButton data-initial-focus={drawer || !children ? "" : undefined} name="close" label={drawer ? "Close navigation" : "Close dialog"} onClick={onDismiss} />
    </header>
    {description && <p id={`${id}-description`} className="mt-2 text-small text-muted">{description}</p>}
    {children}
  </dialog>;
}

export function ConfirmDialog({ title, description, action, onDismiss, onConfirm }) {
  return <Dialog title={title} description={description} onDismiss={onDismiss}>
    <div className="mt-6 flex flex-wrap justify-end gap-2">
      <Button data-initial-focus onClick={onDismiss}>Cancel</Button>
      <Button variant="destructive" onClick={onConfirm}>{action}</Button>
    </div>
  </Dialog>;
}
