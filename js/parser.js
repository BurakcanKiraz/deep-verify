// Deep-Verify — Academic Reference Parser
const Parser = {
  // Main parse function
  parse(text) {
    const sources = [];
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
    
    for (const line of lines) {
      const parsed = this.parseLine(line);
      if (parsed) sources.push(parsed);
    }
    
    // If no structured refs found, try to find inline citations
    if (sources.length === 0) {
      const inlineRefs = this.extractInlineCitations(text);
      sources.push(...inlineRefs);
    }
    
    return sources;
  },

  parseLine(line) {
    // Skip very short lines or section headers
    if (line.length < 20) return null;
    // Skip lines that are clearly not references
    if (/^(abstract|keywords|giriş|introduction|sonuç|conclusion|özet|kaynaklar|references)/i.test(line)) return null;

    const ref = { raw: line, authors: [], title: '', year: null, doi: null, journal: '', volume: '', pages: '', publisher: '' };

    // Extract DOI
    const doiMatch = line.match(/\b(10\.\d{4,}\/[^\s,;>\]]+)/i);
    if (doiMatch) ref.doi = doiMatch[1].replace(/[.\s]+$/, '');

    // Extract year (1900-2099)
    const yearMatch = line.match(/\b(19\d{2}|20\d{2})\b/);
    if (yearMatch) ref.year = parseInt(yearMatch[1]);

    // Try APA style: Author, A. B. (Year). Title. Journal, Vol(Issue), pages.
    const apaMatch = line.match(/^(.+?)\s*\((\d{4})\)\.\s*(.+?)[\.\?!]\s*(.+)?$/);
    if (apaMatch) {
      ref.authors = this.parseAuthors(apaMatch[1]);
      ref.year = parseInt(apaMatch[2]);
      ref.title = apaMatch[3].trim();
      if (apaMatch[4]) {
        const rest = apaMatch[4];
        const journalMatch = rest.match(/^(.+?),\s*(\d+)/);
        if (journalMatch) {
          ref.journal = journalMatch[1].trim().replace(/\.$/, '');
          ref.volume = journalMatch[2];
        }
        const pagesMatch = rest.match(/(\d+)\s*[-–]\s*(\d+)/);
        if (pagesMatch) ref.pages = `${pagesMatch[1]}-${pagesMatch[2]}`;
      }
      return ref;
    }

    // Try numbered reference: [1] Author (Year). Title...
    const numberedMatch = line.match(/^\[?\d+\]?\s*\.?\s*(.+)$/);
    if (numberedMatch) {
      const content = numberedMatch[1];
      const innerApa = content.match(/^(.+?)\s*\((\d{4})\)\.\s*(.+?)[\.\?!]\s*(.+)?$/);
      if (innerApa) {
        ref.authors = this.parseAuthors(innerApa[1]);
        ref.year = parseInt(innerApa[2]);
        ref.title = innerApa[3].trim();
        if (innerApa[4]) {
          ref.journal = innerApa[4].split(',')[0].trim().replace(/\.$/, '');
        }
        return ref;
      }
      // IEEE style: [1] A. Author, "Title," Journal, vol. X, pp. Y-Z, Year.
      const ieeeMatch = content.match(/^(.+?),\s*"(.+?)"\s*,?\s*(.+)?$/);
      if (ieeeMatch) {
        ref.authors = this.parseAuthors(ieeeMatch[1]);
        ref.title = ieeeMatch[2].trim();
        if (ieeeMatch[3]) {
          ref.journal = ieeeMatch[3].split(',')[0].trim().replace(/\.$/, '');
        }
        return ref;
      }
    }

    // Fallback: try to extract something useful
    // If line has parenthesized year and enough text
    if (ref.year && line.length > 30) {
      const parts = line.split(/\(\d{4}\)/);
      if (parts[0]) ref.authors = this.parseAuthors(parts[0]);
      if (parts[1]) {
        const titleMatch = parts[1].match(/\.?\s*(.+?)[\.\?!]/);
        if (titleMatch) ref.title = titleMatch[1].trim();
      }
      if (ref.title || ref.authors.length > 0) return ref;
    }

    // Last resort: treat entire line as a reference with minimal parsing
    if (line.length > 30 && (ref.doi || ref.year)) {
      ref.title = line.substring(0, 100).replace(/^\[?\d+\]?\s*/, '').trim();
      return ref;
    }

    return null;
  },

  parseAuthors(str) {
    if (!str) return [];
    return str.split(/,\s*(?:&|and|ve)\s*|,\s*|\s+(?:&|and|ve)\s+/)
      .map(a => a.trim().replace(/^\[?\d+\]?\s*/, '').replace(/\.$/, '').trim())
      .filter(a => a.length > 1 && a.length < 50 && !/^\d+$/.test(a));
  },

  extractInlineCitations(text) {
    const refs = [];
    // Match (Author, Year) patterns
    const pattern = /\(([A-ZÇĞİÖŞÜ][a-zçğıöşü]+(?:\s+(?:ve|&|and)\s+[A-ZÇĞİÖŞÜ][a-zçğıöşü]+)*(?:\s+et\s+al\.?)?),?\s*(\d{4})\)/g;
    let match;
    const seen = new Set();
    while ((match = pattern.exec(text)) !== null) {
      const key = `${match[1]}-${match[2]}`;
      if (seen.has(key)) continue;
      seen.add(key);
      refs.push({
        raw: match[0],
        authors: [match[1].trim()],
        title: '',
        year: parseInt(match[2]),
        doi: null,
        journal: '',
        volume: '',
        pages: '',
        publisher: ''
      });
    }
    return refs;
  }
};
