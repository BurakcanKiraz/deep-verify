// Deep-Verify — UI Manager
const UI = {
  showToast(message, type = 'info') {
    let container = document.querySelector('.toast-container');
    if (!container) {
      container = document.createElement('div');
      container.className = 'toast-container';
      document.body.appendChild(container);
    }
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `<span>${type === 'success' ? '✓' : type === 'error' ? '✕' : 'ℹ'}</span><span>${message}</span>`;
    container.appendChild(toast);
    setTimeout(() => { toast.style.opacity = '0'; toast.style.transform = 'translateY(-10px)'; setTimeout(() => toast.remove(), 300); }, 3000);
  },

  renderProgressRing(container, value, size = 120, color = null) {
    const r = (size - 16) / 2;
    const circ = 2 * Math.PI * r;
    const offset = circ - (value / 100) * circ;
    const c = color || (value >= 70 ? 'var(--success-400)' : value >= 40 ? 'var(--warning-500)' : 'var(--danger-400)');
    container.innerHTML = `
      <div class="progress-ring-container" style="width:${size}px;height:${size}px">
        <svg class="progress-ring" width="${size}" height="${size}">
          <circle class="progress-ring-bg" cx="${size/2}" cy="${size/2}" r="${r}"/>
          <circle class="progress-ring-fill" cx="${size/2}" cy="${size/2}" r="${r}"
            stroke="${c}" stroke-dasharray="${circ}" stroke-dashoffset="${circ}"
            style="transition:stroke-dashoffset 1.2s ease-out"/>
        </svg>
        <div class="progress-ring-text">
          <span class="progress-ring-value" style="color:${c}">0</span>
          <span class="progress-ring-label">Güven</span>
        </div>
      </div>`;
    // Animate
    requestAnimationFrame(() => {
      setTimeout(() => {
        container.querySelector('.progress-ring-fill').style.strokeDashoffset = offset;
        this.animateNumber(container.querySelector('.progress-ring-value'), 0, value, 1000);
      }, 100);
    });
  },

  animateNumber(el, from, to, duration) {
    const start = performance.now();
    const update = (now) => {
      const p = Math.min((now - start) / duration, 1);
      el.textContent = Math.round(from + (to - from) * this.easeOut(p));
      if (p < 1) requestAnimationFrame(update);
    };
    requestAnimationFrame(update);
  },

  easeOut(t) { return 1 - Math.pow(1 - t, 3); },

  renderProgressBar(value, color) {
    const c = color || (value >= 70 ? 'var(--success-400)' : value >= 40 ? 'var(--warning-500)' : 'var(--danger-400)');
    return `<div class="progress-bar"><div class="progress-bar-fill" style="width:${value}%;background:${c}"></div></div>`;
  },

  renderSourceCard(result, index) {
    const { source, checks, score, status } = result;
    const statusBadge = status === 'verified' ? '<span class="badge badge-success">✓ Doğrulandı</span>'
      : status === 'partial' ? '<span class="badge badge-warning">⚠ Kısmi</span>'
      : '<span class="badge badge-danger">✕ Bulunamadı</span>';

    const checkItems = [
      { label: 'DOI', ...checks.doi },
      { label: 'Başlık', ...checks.title },
      { label: 'Yazar', ...checks.author },
      { label: 'Yıl', ...checks.year },
      { label: 'Dergi', ...checks.journal }
    ].map(c => `
      <div class="source-check">
        <div class="source-check-icon ${c.pass ? 'pass' : 'fail'}">${c.pass ? '✓' : '✕'}</div>
        <span style="color:var(--text-secondary)">${c.label}:</span>
        <span style="color:var(--text-tertiary);flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${c.detail || '-'}</span>
      </div>`).join('');

    const title = source.title || source.raw?.substring(0, 80) || 'Bilinmeyen Kaynak';
    const authorStr = source.authors?.length ? source.authors.slice(0, 2).join(', ') : '';
    const c = score >= 70 ? 'var(--success-400)' : score >= 40 ? 'var(--warning-500)' : 'var(--danger-400)';

    return `
      <div class="source-card animate-fade-in-up" style="animation-delay:${index * 0.08}s">
        <div class="card">
          <div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:var(--space-2)">
            <span class="badge badge-primary">#${index + 1}</span>
            ${statusBadge}
          </div>
          <div class="source-title">${this.escapeHtml(title)}</div>
          <div class="source-meta">
            ${authorStr ? `<span class="source-meta-item">👤 ${this.escapeHtml(authorStr)}</span>` : ''}
            ${source.year ? `<span class="source-meta-item">📅 ${source.year}</span>` : ''}
            ${source.doi ? `<span class="source-meta-item">🔗 DOI</span>` : ''}
          </div>
          <div class="source-checks">${checkItems}</div>
          <div class="source-score">
            <div class="source-score-bar">${this.renderProgressBar(score, c)}</div>
            <div class="source-score-value" style="color:${c}">${score}</div>
          </div>
        </div>
      </div>`;
  },

  escapeHtml(str) {
    const d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
  },

  formatDate(dateStr) {
    const d = new Date(dateStr);
    return d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  },

  showModal(title, content) {
    let backdrop = document.querySelector('.modal-backdrop');
    if (!backdrop) {
      backdrop = document.createElement('div');
      backdrop.className = 'modal-backdrop';
      backdrop.innerHTML = '<div class="modal"><div class="modal-handle"></div><div class="modal-content"></div></div>';
      backdrop.addEventListener('click', e => { if (e.target === backdrop) this.hideModal(); });
      document.body.appendChild(backdrop);
    }
    const mc = backdrop.querySelector('.modal-content');
    mc.innerHTML = `<h3 style="margin-bottom:var(--space-4)">${title}</h3>${content}`;
    requestAnimationFrame(() => backdrop.classList.add('active'));
  },

  hideModal() {
    const b = document.querySelector('.modal-backdrop');
    if (b) { b.classList.remove('active'); }
  }
};
