import React, { useEffect, useState, useRef, useCallback } from 'react';
import { X, Download, FileText, ChevronLeft, ChevronRight, ChevronUp, ChevronDown, Maximize2, Minimize2, Search, Loader2 } from 'lucide-react';
import { useI18n } from '../i18n.jsx';

const PDFJS_VERSION = '3.11.174';
const WORKER_SRC = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDFJS_VERSION}/pdf.worker.min.js`;
const MAX_MATCHES = 300;

// Cache extracted page text per PDF id, shared across viewer opens in this session.
const TEXT_CACHE = new Map();

// Extract plain text per page using the already-loaded pdf.js (window.pdfjsLib).
async function extractPageTexts(pdf) {
  if (TEXT_CACHE.has(pdf.id)) return TEXT_CACHE.get(pdf.id);

  const lib = typeof window !== 'undefined' ? window.pdfjsLib : null;
  if (!lib) throw new Error('pdfjs-not-loaded');
  if (!lib.GlobalWorkerOptions.workerSrc) {
    lib.GlobalWorkerOptions.workerSrc = WORKER_SRC;
  }

  let data;
  if (pdf.fileData instanceof ArrayBuffer) {
    data = pdf.fileData.slice(0); // clone so pdf.js can't detach the buffer used by the iframe blob
  } else if (pdf.fileData instanceof Blob) {
    data = await pdf.fileData.arrayBuffer();
  } else {
    throw new Error('unsupported-file-data');
  }

  const doc = await lib.getDocument({ data }).promise;
  const pages = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    const text = content.items.map((item) => item.str).join(' ');
    pages.push({ page: i, text });
  }
  try {
    await doc.destroy();
  } catch {
    // ignore
  }

  TEXT_CACHE.set(pdf.id, pages);
  return pages;
}

// Find all (case-insensitive) occurrences with a surrounding snippet.
function buildMatches(pageTexts, rawQuery) {
  const needle = rawQuery.toLowerCase();
  const out = [];
  for (const { page, text } of pageTexts) {
    const hay = text.toLowerCase();
    let from = 0;
    while (from <= hay.length) {
      const idx = hay.indexOf(needle, from);
      if (idx === -1) break;
      const start = Math.max(0, idx - 40);
      const end = Math.min(text.length, idx + needle.length + 40);
      out.push({
        page,
        before: (start > 0 ? '…' : '') + text.slice(start, idx),
        match: text.slice(idx, idx + needle.length),
        after: text.slice(idx + needle.length, end) + (end < text.length ? '…' : ''),
      });
      if (out.length >= MAX_MATCHES) return out;
      from = idx + needle.length;
    }
  }
  return out;
}

export default function PDFViewer({ pdf, onClose, onPrev, onNext, hasPrev, hasNext }) {
  const { t } = useI18n();
  const [pdfUrl, setPdfUrl] = useState('');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const containerRef = useRef(null);

  // Search state
  const [query, setQuery] = useState('');
  const [matches, setMatches] = useState([]);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [isExtracting, setIsExtracting] = useState(false);
  const [searchFailed, setSearchFailed] = useState(false);
  const [targetPage, setTargetPage] = useState(1);

  // Generate object URL from ArrayBuffer to get high-performance native rendering
  useEffect(() => {
    if (!pdf || !pdf.fileData) return;

    setIsLoading(true);
    let activeUrl = '';

    try {
      let blob;
      if (pdf.fileData instanceof ArrayBuffer) {
        blob = new Blob([pdf.fileData], { type: 'application/pdf' });
      } else if (pdf.fileData instanceof Blob) {
        blob = pdf.fileData;
      } else {
        throw new Error('지원되지 않는 파일 데이터 형식입니다.');
      }

      activeUrl = URL.createObjectURL(blob);
      setPdfUrl(activeUrl);
      setIsLoading(false);
    } catch (err) {
      console.error('Failed to create PDF URL:', err);
      alert(t('viewer.processError'));
      setIsLoading(false);
    }

    return () => {
      if (activeUrl) {
        URL.revokeObjectURL(activeUrl);
      }
    };
  }, [pdf, t]);

  // Reset search whenever the open document changes
  useEffect(() => {
    setQuery('');
    setMatches([]);
    setActiveIndex(-1);
    setSearchFailed(false);
    setIsExtracting(false);
    setTargetPage(1);
  }, [pdf]);

  // Run the (debounced) in-document search
  useEffect(() => {
    const q = query.trim();
    if (!q) {
      setMatches([]);
      setActiveIndex(-1);
      setSearchFailed(false);
      setIsExtracting(false);
      return;
    }

    let cancelled = false;
    setIsExtracting(true);
    setSearchFailed(false);

    const timer = setTimeout(async () => {
      try {
        const pages = await extractPageTexts(pdf);
        if (cancelled) return;
        const found = buildMatches(pages, q);
        setMatches(found);
        setIsExtracting(false);
        if (found.length > 0) {
          setActiveIndex(0);
          setTargetPage(found[0].page);
        } else {
          setActiveIndex(-1);
        }
      } catch (err) {
        if (cancelled) return;
        console.error('PDF search failed:', err);
        setSearchFailed(true);
        setMatches([]);
        setActiveIndex(-1);
        setIsExtracting(false);
      }
    }, 300);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, pdf]);

  const goToMatch = useCallback(
    (index) => {
      if (matches.length === 0) return;
      const next = (index + matches.length) % matches.length; // wrap around
      setActiveIndex(next);
      setTargetPage(matches[next].page);
    },
    [matches]
  );

  // Fullscreen event listener to sync state with browser native events (e.g. Esc key)
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);

  const toggleFullscreen = () => {
    if (!containerRef.current) return;

    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch((err) => {
        console.error('Error enabling fullscreen:', err);
      });
    } else {
      document.exitFullscreen();
    }
  };

  if (!pdf) return null;

  // Open at the active match's page; native viewer honours the #page parameter.
  const iframeSrc = pdfUrl ? `${pdfUrl}#page=${targetPage}&view=Fit` : '';
  const hasMatches = matches.length > 0;

  return (
    <div ref={containerRef} id="pdf-viewer-container" className="viewer-overlay">
      <div className="viewer-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0, flex: 1 }}>
          <FileText size={20} style={{ color: 'var(--danger)', flexShrink: 0 }} />
          <h2 className="viewer-title" title={pdf.name}>
            {pdf.name}
          </h2>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>

          {/* File Navigation Controls (Prev/Next PDF File) */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginRight: '8px', borderRight: '1px solid var(--border)', paddingRight: '12px' }}>
            <button
              className="btn-secondary"
              onClick={onPrev}
              disabled={!hasPrev}
              style={{ padding: '6px', opacity: hasPrev ? 1 : 0.4, cursor: hasPrev ? 'pointer' : 'not-allowed' }}
              title={t('viewer.prev')}
            >
              <ChevronLeft size={18} />
            </button>
            <button
              className="btn-secondary"
              onClick={onNext}
              disabled={!hasNext}
              style={{ padding: '6px', opacity: hasNext ? 1 : 0.4, cursor: hasNext ? 'pointer' : 'not-allowed' }}
              title={t('viewer.next')}
            >
              <ChevronRight size={18} />
            </button>
          </div>

          {/* Fullscreen Control */}
          <button
            className="btn-secondary"
            onClick={toggleFullscreen}
            style={{ padding: '6px' }}
            title={isFullscreen ? t('viewer.fullscreenOff') : t('viewer.fullscreenOn')}
          >
            {isFullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
          </button>

          {/* Download Control */}
          <button
            className="btn-secondary"
            onClick={() => {
              const blob = pdf.fileData instanceof Blob ? pdf.fileData : new Blob([pdf.fileData], { type: 'application/pdf' });
              const url = URL.createObjectURL(blob);
              const link = document.createElement('a');
              link.href = url;
              link.download = pdf.name;
              document.body.appendChild(link);
              link.click();
              document.body.removeChild(link);
              URL.revokeObjectURL(url);
            }}
            style={{ padding: '6px 12px', fontSize: '0.85rem' }}
            title={t('viewer.downloadTitle')}
          >
            <Download size={14} /> {t('viewer.download')}
          </button>

          {/* Close Control */}
          <button
            className="viewer-close-btn"
            onClick={onClose}
            title={t('viewer.close')}
          >
            <X size={18} />
          </button>
        </div>
      </div>

      {/* In-document full-text search */}
      <div className="viewer-search">
        <div className="viewer-search-field">
          <Search size={16} className="viewer-search-icon" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                goToMatch(activeIndex + (e.shiftKey ? -1 : 1));
              } else if (e.key === 'Escape') {
                setQuery('');
              }
            }}
            placeholder={t('viewer.searchPlaceholder')}
            aria-label={t('viewer.searchPlaceholder')}
          />
          {query && (
            <button
              className="btn-secondary"
              onClick={() => setQuery('')}
              style={{ padding: '2px', border: 'none', background: 'transparent' }}
              title={t('viewer.clearSearch')}
            >
              <X size={15} />
            </button>
          )}
        </div>

        {/* Status / match navigation */}
        {isExtracting ? (
          <span className="viewer-search-status" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />
            {t('viewer.searching')}
          </span>
        ) : searchFailed ? (
          <span className="viewer-search-status">{t('viewer.searchError')}</span>
        ) : query.trim() && !hasMatches ? (
          <span className="viewer-search-status">{t('viewer.noMatches')}</span>
        ) : hasMatches ? (
          <div className="viewer-search-nav">
            <span className="viewer-search-status" style={{ fontVariantNumeric: 'tabular-nums' }}>
              {activeIndex + 1} / {matches.length}{matches.length >= MAX_MATCHES ? '+' : ''}
            </span>
            <button
              className="btn-secondary"
              onClick={() => goToMatch(activeIndex - 1)}
              style={{ padding: '4px' }}
              title={t('viewer.prevMatch')}
            >
              <ChevronUp size={16} />
            </button>
            <button
              className="btn-secondary"
              onClick={() => goToMatch(activeIndex + 1)}
              style={{ padding: '4px' }}
              title={t('viewer.nextMatch')}
            >
              <ChevronDown size={16} />
            </button>
          </div>
        ) : null}

        {/* Results dropdown */}
        {hasMatches && (
          <div className="viewer-search-results">
            {matches.map((m, i) => (
              <button
                key={`${m.page}-${i}`}
                className={`viewer-search-result ${i === activeIndex ? 'active' : ''}`}
                onClick={() => goToMatch(i)}
              >
                <span className="result-page">{t('viewer.page', m.page)}</span>
                <span className="result-snippet">
                  {m.before}
                  <mark>{m.match}</mark>
                  {m.after}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="viewer-body">
        {isLoading ? (
          <div className="empty-state">
            <p>{t('viewer.loading')}</p>
          </div>
        ) : iframeSrc ? (
          <iframe
            key={pdf.id} // Revert to only remounting when changing the PDF document, avoiding flash
            src={iframeSrc}
            title={pdf.name}
            className="viewer-iframe"
            frameBorder="0"
          >
            {t('viewer.unsupported')}
          </iframe>
        ) : (
          <div className="empty-state">
            <p>{t('viewer.parseFailed')}</p>
          </div>
        )}
      </div>
    </div>
  );
}
