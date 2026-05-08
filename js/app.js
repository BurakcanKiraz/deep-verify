// Deep-Verify — Main App Controller
const App = {
  currentPage: 'home',
  currentResults: null,

  init() {
    this.bindNav();
    this.renderHome();
    this.navigate('home');
  },

  bindNav() {
    document.querySelectorAll('.nav-item').forEach(item => {
      item.addEventListener('click', () => this.navigate(item.dataset.page));
    });
  },

  navigate(page) {
    this.currentPage = page;
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    const pageEl = document.getElementById(`page-${page}`);
    const navEl = document.querySelector(`[data-page="${page}"]`);
    if (pageEl) pageEl.classList.add('active');
    if (navEl) navEl.classList.add('active');

    if (page === 'home') this.renderHome();
    if (page === 'history') this.renderHistory();
  },

  renderHome() {
    const stats = Storage.getStats();
    const el = document.getElementById('home-stats');
    if (el) {
      el.innerHTML = `
        <div class="card"><div class="stat"><div class="stat-value text-gradient">${stats.totalScans}</div><div class="stat-label">Tarama</div></div></div>
        <div class="card"><div class="stat"><div class="stat-value text-gradient">${stats.totalSources}</div><div class="stat-label">Kaynak</div></div></div>
        <div class="card"><div class="stat"><div class="stat-value text-gradient">${stats.avgScore || '-'}</div><div class="stat-label">Ort. Skor</div></div></div>`;
    }
    // Recent history
    const recentEl = document.getElementById('home-recent');
    if (recentEl) {
      const history = Storage.getHistory().slice(0, 3);
      if (history.length === 0) {
        recentEl.innerHTML = '<div class="empty-state"><div class="empty-state-icon">📋</div><div class="empty-state-title">Henüz tarama yok</div><div class="empty-state-desc">İlk doğrulamanızı başlatmak için Doğrula sekmesine gidin</div></div>';
      } else {
        recentEl.innerHTML = history.map(h => {
          const sc = h.overallScore || 0;
          const c = sc >= 70 ? 'var(--success-400)' : sc >= 40 ? 'var(--warning-500)' : 'var(--danger-400)';
          return `<div class="history-item"><div class="card" onclick="App.viewResult(${h.id})">
            <div class="history-date">${UI.formatDate(h.date)}</div>
            <div class="history-summary">
              <span style="font-size:var(--font-size-sm);color:var(--text-secondary)">${h.sources?.length || 0} kaynak doğrulandı</span>
              <span class="history-score" style="color:${c}">${sc}/100</span>
            </div></div></div>`;
        }).join('');
      }
    }
  },

  async startVerification() {
    const textarea = document.getElementById('verify-input');
    const text = textarea?.value?.trim();
    if (!text) { UI.showToast('Lütfen akademik metin girin', 'error'); return; }
    if (text.length < 30) { UI.showToast('Metin çok kısa, daha fazla içerik girin', 'error'); return; }

    // Show loading
    const contentEl = document.getElementById('verify-content');
    const loadingEl = document.getElementById('verify-loading');
    const resultsPage = document.getElementById('page-results');
    contentEl.style.display = 'none';
    loadingEl.style.display = 'flex';

    // Parse
    this.updateLoadingStep(0, 'active');
    await new Promise(r => setTimeout(r, 500));
    const sources = Parser.parse(text);
    this.updateLoadingStep(0, 'done');

    if (sources.length === 0) {
      contentEl.style.display = 'block';
      loadingEl.style.display = 'none';
      UI.showToast('Kaynak bulunamadı. Lütfen kaynakça bölümü içeren bir metin girin.', 'error');
      return;
    }

    this.updateLoadingStep(1, 'active');
    document.getElementById('loading-count').textContent = `${sources.length} kaynak tespit edildi`;

    // Verify
    const results = await Verifier.verifyAll(sources, (i, total) => {
      document.getElementById('loading-progress-text').textContent = `${i + 1}/${total} doğrulanıyor...`;
      const pct = Math.round(((i + 1) / total) * 100);
      document.getElementById('loading-bar-fill').style.width = pct + '%';
    });
    this.updateLoadingStep(1, 'done');
    this.updateLoadingStep(2, 'active');
    await new Promise(r => setTimeout(r, 400));
    this.updateLoadingStep(2, 'done');

    // Calculate overall score
    const overallScore = results.length ? Math.round(results.reduce((s, r) => s + r.score, 0) / results.length) : 0;
    const verified = results.filter(r => r.status === 'verified').length;
    const partial = results.filter(r => r.status === 'partial').length;
    const notFound = results.filter(r => r.status === 'not_found').length;

    this.currentResults = { sources: results, overallScore, verified, partial, notFound, textPreview: text.substring(0, 200) };

    // Save to history
    Storage.saveResult(this.currentResults);

    // Reset form
    contentEl.style.display = 'block';
    loadingEl.style.display = 'none';

    // Show results
    this.renderResults(this.currentResults);
    this.navigate('results');
  },

  updateLoadingStep(index, status) {
    const steps = document.querySelectorAll('.loading-step');
    if (steps[index]) {
      steps[index].className = `loading-step ${status}`;
      const icon = steps[index].querySelector('.loading-step-icon');
      if (status === 'done') icon.textContent = '✓';
      else if (status === 'active') icon.textContent = '⟳';
      else icon.textContent = '○';
    }
  },

  renderResults(data) {
    if (!data) return;
    const { sources, overallScore, verified, partial, notFound } = data;

    // Ring
    const ringEl = document.getElementById('results-ring');
    UI.renderProgressRing(ringEl, overallScore, 140);

    // Stats
    document.getElementById('results-verified').textContent = verified;
    document.getElementById('results-partial').textContent = partial;
    document.getElementById('results-notfound').textContent = notFound;

    // Source list
    const listEl = document.getElementById('results-list');
    listEl.innerHTML = sources.map((r, i) => UI.renderSourceCard(r, i)).join('');
  },

  viewResult(id) {
    const result = Storage.getResult(id);
    if (result) {
      this.currentResults = result;
      this.renderResults(result);
      this.navigate('results');
    }
  },

  renderHistory() {
    const el = document.getElementById('history-list');
    const history = Storage.getHistory();
    if (history.length === 0) {
      el.innerHTML = '<div class="empty-state"><div class="empty-state-icon">📋</div><div class="empty-state-title">Geçmiş boş</div><div class="empty-state-desc">Doğrulama yaptığınızda burada görünecek</div></div>';
      return;
    }
    el.innerHTML = history.map(h => {
      const sc = h.overallScore || 0;
      const c = sc >= 70 ? 'var(--success-400)' : sc >= 40 ? 'var(--warning-500)' : 'var(--danger-400)';
      const srcCount = h.sources?.length || 0;
      const v = h.verified || 0;
      return `<div class="history-item"><div class="card" onclick="App.viewResult(${h.id})">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:var(--space-2)">
          <div class="history-date">${UI.formatDate(h.date)}</div>
          <span class="badge ${sc >= 70 ? 'badge-success' : sc >= 40 ? 'badge-warning' : 'badge-danger'}">${sc}/100</span>
        </div>
        <div style="font-size:var(--font-size-sm);color:var(--text-secondary);margin-bottom:var(--space-2)">${srcCount} kaynak • ${v} doğrulanmış</div>
        ${UI.renderProgressBar(sc, c)}
        <div style="font-size:var(--font-size-xs);color:var(--text-tertiary);margin-top:var(--space-2);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${UI.escapeHtml(h.textPreview || '')}</div>
      </div></div>`;
    }).join('');
  },

  clearHistory() {
    if (confirm('Tüm geçmiş silinecek. Emin misiniz?')) {
      Storage.clearHistory();
      this.renderHistory();
      this.renderHome();
      UI.showToast('Geçmiş temizlendi', 'success');
    }
  },

  exportResults() {
    if (!this.currentResults) return;
    const data = JSON.stringify(this.currentResults, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `deep-verify-rapor-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    UI.showToast('Rapor indirildi', 'success');
  },

  loadSampleText() {
    const textarea = document.getElementById('verify-input');
    textarea.value = `Yapay zeka alanında önemli çalışmalar yapılmıştır. Bu çalışmalar arasında derin öğrenme ve doğal dil işleme yer almaktadır.

Kaynaklar:

[1] Vaswani, A., Shazeer, N., Parmar, N., Uszkoreit, J., Jones, L., Gomez, A. N., Kaiser, Ł., & Polosukhin, I. (2017). Attention is all you need. Advances in Neural Information Processing Systems, 30, 5998-6008.

[2] Devlin, J., Chang, M. W., Lee, K., & Toutanova, K. (2019). BERT: Pre-training of deep bidirectional transformers for language understanding. Proceedings of NAACL-HLT, 4171-4186.

[3] Brown, T. B., Mann, B., Ryder, N., Subbiah, M., Kaplan, J., Dhariwal, P., ... & Amodei, D. (2020). Language models are few-shot learners. Advances in Neural Information Processing Systems, 33, 1877-1901.

[4] Sahoo, U., Karakurt, B., & Yılmaz, A. (2024). Uydurma bir kaynak testi. Var Olmayan Dergi, 99, 1-50.

[5] OpenAI (2023). GPT-4 technical report. arXiv preprint arXiv:2303.08774.`;
    textarea.style.height = 'auto';
    textarea.style.height = textarea.scrollHeight + 'px';
    UI.showToast('Örnek metin yüklendi', 'info');
  }
};

// Init
document.addEventListener('DOMContentLoaded', () => App.init());
