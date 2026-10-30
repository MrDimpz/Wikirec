const TAB_SESSION_KEY = 'wkt_tab_session_id';

export function getOrInitTabSessionId(): string {
  try {
    let id = sessionStorage.getItem(TAB_SESSION_KEY);
    if (!id) {
      id = `tab_${Math.random().toString(36).slice(2, 9)}_${Date.now().toString(36)}`;
      sessionStorage.setItem(TAB_SESSION_KEY, id);
    }
    return id;
  } catch {
    return `tab_${Math.random().toString(36).slice(2, 9)}`;
  }
}
