// Deep-Verify — Local Storage Manager
const Storage = {
  KEYS: { HISTORY: 'dv_history', SETTINGS: 'dv_settings' },

  getHistory() {
    try {
      return JSON.parse(localStorage.getItem(this.KEYS.HISTORY) || '[]');
    } catch { return []; }
  },

  saveResult(result) {
    const history = this.getHistory();
    history.unshift({ ...result, id: Date.now(), date: new Date().toISOString() });
    if (history.length > 50) history.length = 50;
    localStorage.setItem(this.KEYS.HISTORY, JSON.stringify(history));
  },

  getResult(id) {
    return this.getHistory().find(r => r.id === id) || null;
  },

  deleteResult(id) {
    const history = this.getHistory().filter(r => r.id !== id);
    localStorage.setItem(this.KEYS.HISTORY, JSON.stringify(history));
  },

  clearHistory() {
    localStorage.removeItem(this.KEYS.HISTORY);
  },

  getStats() {
    const history = this.getHistory();
    return {
      totalScans: history.length,
      totalSources: history.reduce((s, r) => s + (r.sources?.length || 0), 0),
      avgScore: history.length ? Math.round(history.reduce((s, r) => s + (r.overallScore || 0), 0) / history.length) : 0
    };
  }
};
