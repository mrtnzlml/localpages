// Reload on source-file change AND when the server actually restarts.
// The server tags every 'hello' event with a per-process ID; we remember the
// first one we see and only reload when a later hello carries a *different*
// ID. A plain EventSource reconnect (same ID) is ignored.
//
// Chrome aborts an opening print preview if the page navigates during the
// preview flow, so we also track print state and defer any reload until the
// dialog closes — otherwise saving the source file mid-print would yank the
// dialog out from under the user.
let isPrinting = false;
let pendingReload = false;
window.addEventListener('beforeprint', () => { isPrinting = true; });
window.addEventListener('afterprint', () => {
  isPrinting = false;
  if (pendingReload) { pendingReload = false; location.reload(); }
});
const scheduleReload = () => { if (isPrinting) pendingReload = true; else location.reload(); };

let serverId = null;
const es = new EventSource('/__reload');
es.addEventListener('hello', (ev) => {
  if (serverId === null) serverId = ev.data;
  else if (ev.data !== serverId) scheduleReload();
});
es.addEventListener('change', () => scheduleReload());
