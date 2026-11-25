const paths = {
  overview: "M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z",
  mail: "M3 5h18v14H3zM3 6l9 7 9-7", newsletter: "M3 4h14v16H3zM17 9h4v11h-4M6 8h8M6 12h8M6 16h5",
  users: "M16 20v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2M16 5a3 3 0 0 1 0 6m1 3a4 4 0 0 1 4 4v2M12 8a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z",
  chat: "M4 4h16v12H9l-5 4zm4 5h8m-8 3h5", finance: "M3 20h18M6 16v-5m6 5V7m6 9V4",
  transactions: "M4 8h16m-4-4 4 4-4 4M20 16H4m4-4-4 4 4 4", calendar: "M4 6h16v14H4zM8 3v6m8-6v6M4 11h16m-12 4h2m4 0h2",
  support: "M12 20 4.6 12.6A4.6 4.6 0 0 1 11 6l1 1 1-1a4.6 4.6 0 0 1 6.4 6.6Z", article: "M5 4h14v16H5zM8 8h8m-8 4h8m-8 4h5",
  activity: "M2 12h5l3-7 4 14 3-7h5",
  system: "M4 4h16v6H4zm0 10h16v6H4zm3-7h.01m0 10h.01m4-10h6m-6 10h6", settings: "M4 6h16M4 12h16M4 18h16M8 4v4m8 2v4m-6 2v4",
  menu: "M3 6h18M3 12h18M3 18h18", panel: "M3 4h18v16H3zm6 0v16m6-12-3 4 3 4", logout: "M10 5H4v14h6m4-12 5 5-5 5m-6-5h11",
};

export function WorkspaceIcon({ name }) {
  return <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill="none" aria-hidden="true" focusable="false">
    <path d={paths[name]} stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>;
}
