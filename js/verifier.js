// Deep-Verify — Source Verifier (CrossRef + OpenAlex)
const Verifier = {
  CROSSREF_API: 'https://api.crossref.org/works',
  OPENALEX_API: 'https://api.openalex.org/works',

  async verifyAll(sources, onProgress) {
    const results = [];
    for (let i = 0; i < sources.length; i++) {
      if (onProgress) onProgress(i, sources.length, sources[i]);
      const result = await this.verifySingle(sources[i]);
      results.push(result);
      // Small delay to respect rate limits
      if (i < sources.length - 1) await this.delay(300);
    }
    return results;
  },

  async verifySingle(source) {
    const result = {
      source,
      checks: { doi: { pass: false, detail: '' }, title: { pass: false, detail: '' }, author: { pass: false, detail: '' }, year: { pass: false, detail: '' }, journal: { pass: false, detail: '' } },
      score: 0,
      status: 'not_found', // verified, partial, not_found
      matchedData: null
    };

    try {
      let data = null;
      // Strategy 1: DOI lookup
      if (source.doi) {
        data = await this.lookupByDOI(source.doi);
      }
      // Strategy 2: Title search
      if (!data && source.title) {
        data = await this.searchByTitle(source.title, source.authors);
      }
      // Strategy 3: OpenAlex fallback
      if (!data && (source.title || source.authors.length > 0)) {
        data = await this.searchOpenAlex(source);
      }

      if (data) {
        result.matchedData = data;
        this.runChecks(result, source, data);
      } else {
        result.checks.doi.detail = source.doi ? 'DOI bulunamadı' : 'DOI bilgisi yok';
        result.checks.title.detail = 'Eşleşme bulunamadı';
        result.checks.author.detail = 'Doğrulanamadı';
        result.checks.year.detail = 'Doğrulanamadı';
        result.checks.journal.detail = 'Doğrulanamadı';
        result.status = 'not_found';
        result.score = 0;
      }
    } catch (err) {
      console.warn('Verification error:', err);
      result.checks.doi.detail = 'API hatası';
      result.status = 'not_found';
      result.score = 0;
    }

    return result;
  },

  runChecks(result, source, data) {
    let score = 0;

    // DOI check (30 pts)
    if (data.doi) {
      result.checks.doi.pass = true;
      result.checks.doi.detail = data.doi;
      score += 30;
    } else {
      result.checks.doi.detail = 'DOI kaydı yok';
    }

    // Title check (20 pts)
    if (data.title && source.title) {
      const sim = this.similarity(source.title.toLowerCase(), data.title.toLowerCase());
      if (sim > 0.6) {
        result.checks.title.pass = true;
        result.checks.title.detail = `Eşleşme: %${Math.round(sim * 100)}`;
        score += 20;
      } else {
        result.checks.title.detail = `Düşük eşleşme: %${Math.round(sim * 100)}`;
      }
    } else if (data.title) {
      result.checks.title.pass = true;
      result.checks.title.detail = data.title.substring(0, 60);
      score += 15;
    } else {
      result.checks.title.detail = 'Başlık bilgisi bulunamadı';
    }

    // Author check (20 pts)
    if (data.authors && data.authors.length > 0 && source.authors.length > 0) {
      const matched = this.matchAuthors(source.authors, data.authors);
      if (matched) {
        result.checks.author.pass = true;
        result.checks.author.detail = `${data.authors.length} yazar doğrulandı`;
        score += 20;
      } else {
        result.checks.author.detail = 'Yazar eşleşmesi düşük';
        score += 5;
      }
    } else if (data.authors && data.authors.length > 0) {
      result.checks.author.pass = true;
      result.checks.author.detail = data.authors.slice(0, 3).join(', ');
      score += 15;
    } else {
      result.checks.author.detail = 'Yazar bilgisi yok';
    }

    // Year check (15 pts)
    if (data.year && source.year) {
      if (data.year === source.year) {
        result.checks.year.pass = true;
        result.checks.year.detail = `${data.year} ✓`;
        score += 15;
      } else {
        result.checks.year.detail = `Beklenen: ${source.year}, Bulunan: ${data.year}`;
        score += 5;
      }
    } else if (data.year) {
      result.checks.year.pass = true;
      result.checks.year.detail = `${data.year}`;
      score += 10;
    } else {
      result.checks.year.detail = 'Yıl bilgisi yok';
    }

    // Journal check (15 pts)
    if (data.journal) {
      if (source.journal) {
        const sim = this.similarity(source.journal.toLowerCase(), data.journal.toLowerCase());
        if (sim > 0.5) {
          result.checks.journal.pass = true;
          result.checks.journal.detail = data.journal;
          score += 15;
        } else {
          result.checks.journal.detail = `Farklı: ${data.journal}`;
          score += 5;
        }
      } else {
        result.checks.journal.pass = true;
        result.checks.journal.detail = data.journal;
        score += 10;
      }
    } else {
      result.checks.journal.detail = 'Dergi bilgisi yok';
    }

    result.score = score;
    result.status = score >= 70 ? 'verified' : score >= 30 ? 'partial' : 'not_found';
  },

  async lookupByDOI(doi) {
    try {
      const res = await fetch(`${this.CROSSREF_API}/${encodeURIComponent(doi)}`, {
        headers: { 'Accept': 'application/json' }
      });
      if (!res.ok) return null;
      const json = await res.json();
      return this.normalizeCrossRef(json.message);
    } catch { return null; }
  },

  async searchByTitle(title, authors) {
    try {
      let query = `query.bibliographic=${encodeURIComponent(title)}`;
      if (authors && authors[0]) query += `&query.author=${encodeURIComponent(authors[0])}`;
      query += '&rows=3&select=DOI,title,author,published-print,published-online,container-title,volume,page';
      const res = await fetch(`${this.CROSSREF_API}?${query}`, {
        headers: { 'Accept': 'application/json' }
      });
      if (!res.ok) return null;
      const json = await res.json();
      const items = json.message?.items;
      if (!items || items.length === 0) return null;
      // Find best match
      for (const item of items) {
        const itemTitle = Array.isArray(item.title) ? item.title[0] : item.title;
        if (itemTitle && this.similarity(title.toLowerCase(), itemTitle.toLowerCase()) > 0.5) {
          return this.normalizeCrossRef(item);
        }
      }
      return this.normalizeCrossRef(items[0]);
    } catch { return null; }
  },

  async searchOpenAlex(source) {
    try {
      let query = '';
      if (source.title) query = `search=${encodeURIComponent(source.title)}`;
      else if (source.authors[0]) query = `filter=author.search:${encodeURIComponent(source.authors[0])}`;
      else return null;
      const res = await fetch(`${this.OPENALEX_API}?${query}&per_page=3`, {
        headers: { 'Accept': 'application/json' }
      });
      if (!res.ok) return null;
      const json = await res.json();
      const results = json.results;
      if (!results || results.length === 0) return null;
      const item = results[0];
      return {
        doi: item.doi?.replace('https://doi.org/', '') || null,
        title: item.title || '',
        authors: (item.authorships || []).map(a => a.author?.display_name).filter(Boolean),
        year: item.publication_year || null,
        journal: item.primary_location?.source?.display_name || ''
      };
    } catch { return null; }
  },

  normalizeCrossRef(item) {
    if (!item) return null;
    const authors = (item.author || []).map(a => [a.given, a.family].filter(Boolean).join(' '));
    const pubDate = item['published-print'] || item['published-online'] || {};
    const year = pubDate['date-parts']?.[0]?.[0] || null;
    return {
      doi: item.DOI || null,
      title: Array.isArray(item.title) ? item.title[0] || '' : item.title || '',
      authors,
      year,
      journal: Array.isArray(item['container-title']) ? item['container-title'][0] || '' : item['container-title'] || '',
      volume: item.volume || '',
      pages: item.page || ''
    };
  },

  // Levenshtein-based similarity
  similarity(a, b) {
    if (a === b) return 1;
    const longer = a.length > b.length ? a : b;
    const shorter = a.length > b.length ? b : a;
    if (longer.length === 0) return 1;
    const costs = [];
    for (let i = 0; i <= shorter.length; i++) {
      let lastVal = i;
      for (let j = 0; j <= longer.length; j++) {
        if (i === 0) { costs[j] = j; continue; }
        if (j > 0) {
          let newVal = costs[j - 1];
          if (shorter[i - 1] !== longer[j - 1]) newVal = Math.min(newVal, lastVal, costs[j]) + 1;
          costs[j - 1] = lastVal;
          lastVal = newVal;
        }
      }
      if (i > 0) costs[longer.length] = lastVal;
    }
    return (longer.length - costs[longer.length]) / longer.length;
  },

  matchAuthors(srcAuthors, dataAuthors) {
    const normalize = s => s.toLowerCase().replace(/[^a-zçğıöşü]/g, '');
    for (const sa of srcAuthors) {
      const nsa = normalize(sa);
      if (nsa.length < 2) continue;
      for (const da of dataAuthors) {
        if (normalize(da).includes(nsa) || nsa.includes(normalize(da))) return true;
      }
    }
    return false;
  },

  delay(ms) { return new Promise(r => setTimeout(r, ms)); }
};
