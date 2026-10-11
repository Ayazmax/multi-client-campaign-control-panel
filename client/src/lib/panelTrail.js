// In-panel pages only. Sign-in is never stored, so Back cannot land on the login screen.
const KEY = "ops-trail";

function read() {
  try {
    const parsed = JSON.parse(sessionStorage.getItem(KEY) || "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item) => typeof item === "string" && item.startsWith("/") && !item.startsWith("/app/login"));
  } catch {
    return [];
  }
}

function write(trail) {
  sessionStorage.setItem(KEY, JSON.stringify(trail.slice(-20)));
}

export function notePanelVisit(path) {
  if (!path || path.startsWith("/app/login")) return;
  const trail = read();
  if (trail.at(-1) === path) return;
  trail.push(path);
  write(trail);
}

export function panelBackTarget(path) {
  const trail = read();
  const index = trail.lastIndexOf(path);
  for (let i = (index === -1 ? trail.length : index) - 1; i >= 0; i -= 1) {
    if (trail[i] !== path) return trail[i];
  }
  return parentPath(path);
}

export function stepBack(path) {
  const target = panelBackTarget(path);
  const trail = read();
  const index = trail.lastIndexOf(path);
  write(index === -1 ? trail : trail.slice(0, index));
  return target;
}

function parentPath(path) {
  const clone = path.match(/^\/app\/sites\/([^/]+)\/clone$/);
  if (clone) return `/app/sites/${clone[1]}`;
  const restore = path.match(/^\/app\/sites\/([^/]+)\/restore\//);
  if (restore) return `/app/history?site=${restore[1]}`;
  const backupReview = path.match(/^\/app\/sites\/([^/]+)\/backups\/[^/]+$/);
  if (backupReview) return `/app/sites/${backupReview[1]}/backups`;
  const backups = path.match(/^\/app\/sites\/([^/]+)\/backups$/);
  if (backups) return `/app/sites/${backups[1]}`;
  const move = path.match(/^\/app\/sites\/([^/]+)\/move$/);
  if (move) return `/app/sites/${move[1]}`;
  if (path.startsWith("/app/sites/")) return "/app";
  const preview = path.match(/^\/s\/([^/]+)\/preview/);
  if (preview) return `/app/sites/${preview[1]}`;
  return null;
}
