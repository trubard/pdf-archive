import React, { useEffect, useState, useRef, useCallback } from 'react';
import { X, Download, FileText, ChevronLeft, ChevronRight, ChevronUp, ChevronDown, Maximize2, Minimize2, Search, Loader2 } from 'lucide-react';
import { useI18n } from '../i18n.jsx';
import { getAllPDFs } from '../utils/db';

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

// Search a list of PDFs (case-insensitive), returning matches with file + page + snippet.
async function searchPdfs(pdfList, rawQuery, onProgress) {
  const needle = rawQuery.toLowerCase();
  const matches = [];
  let processed = 0;
  let anySuccess = false;

  for (const pdf of pdfList) {
    try {
      const pages = await extractPageTexts(pdf);
      anySuccess = true;
      for (const { page, text } of pages) {
        const hay = text.toLowerCase();
        let from = 0;
        while (from <= hay.length) {
          const idx = hay.indexOf(needle, from);
          if (idx === -1) break;
          const start = Math.max(0, idx - 40);
          const end = Math.min(text.length, idx + needle.length + 40);
          matches.push({
            pdfId: pdf.id,
            pdfName: pdf.name,
            pdfRef: pdf,
            page,
            before: (start > 0 ? '…' : '') + text.slice(start, idx),
            match: text.slice(idx, idx + needle.length),
            after: text.slice(idx + needle.length, end) + (end < text.length ? '…' : ''),
          });
          if (matches.length >= MAX_MATCHES) {
            onProgress?.(pdfList.length, pdfList.length);
            return { matches, anySuccess, capped: true };
          }
          from = idx + needle.length;
        }
      }
    } catch (err) {
      console.warn('Search skipped a PDF:', pdf?.name, err);
    } finally {
      processed += 1;
      onProgress?.(processed, pdfList.length);
    }
  }

  return { matches, anySuccess, capped: false };
}

export default function PDFViewer({
  pdf,
  onClose,
  onPrev,
  onNext,
  hasPrev,
  hasNext,
  folderPdfs = [],
  onOpenResult,
  initialPage = 1,
}) {
  const { t } = useI18n();
  const [pdfUrl, setPdfUrl] = useState('');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const containerRef = useRef(null);

  // Search state
  const [query, setQuery] = useState('');
  const [scope, setScope] = useState('file'); // 'file' | 'folder' | 'all'
  const [matches, setMatches] = useState([]);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [isSearching, setIsSearching] = useState(false);
  const [searchFailed, setSearchFailed] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [targetPage, setTargetPage] = useState(initialPage);

  // Keep the latest target page available to the (non-dependent) search effect.
  const targetPageRef = useRef(initialPage);
  useEffect(() => {
    targetPageRef.current = targetPage;
  }, [targetPage]);

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

  // When the open document changes, jump to the requested page (1 for normal opens,
  // the result's page when opened from a cross-file search hit). The query is kept
  // so global search results stay usable while navigating between files.
  useEffect(() => {
    setTargetPage(initialPage || 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pdf]);

  // Run the (debounced) search across the selected scope
  useEffect(() => {
    const q = query.trim();
    if (!q) {
      setMatches([]);
      setActiveIndex(-1);
      setSearchFailed(false);
      setIsSearching(false);
      setProgress({ done: 0, total: 0 });
      return;
    }

    let cancelled = false;
    setIsSearching(true);
    setSearchFailed(false);
    setProgress({ done: 0, total: 0 });

    const timer = setTimeout(async () => {
      try {
        let list;
        if (scope === 'file') {
          list = [pdf];
        } else if (scope === 'folder') {
          list = folderPdfs && folderPdfs.length ? folderPdfs : [pdf];
        } else {
          list = await getAllPDFs();
        }
        if (cancelled) return;

        const { matches: found, anySuccess } = await searchPdfs(list, q, (done, total) => {
          if (!cancelled) setProgress({ done, total });
        });
        if (cancelled) return;

        setMatches(found);
        setIsSearching(false);
        setSearchFailed(found.length === 0 && !anySuccess);

        // Highlight the hit on the page we're currently viewing, if any.
        const tp = targetPageRef.current;
        setActiveIndex(found.findIndex((m) => m.pdfId === pdf.id && m.page === tp));
      } catch (err) {
        if (cancelled) return;
        console.error('PDF search failed:', err);
        setSearchFailed(true);
        setMatches([]);
        setActiveIndex(-1);
        setIsSearching(false);
      }
    }, 300);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, scope, pdf, folderPdfs]);

  const goToMatch = useCallback(
    (index) => {
      if (matches.length === 0) return;
      const next = (index + matches.length) % matches.length; // wrap around
      const m = matches[next];
      setActiveIndex(next);
      if (m.pdfId === pdf.id) {
        setTargetPage(m.page);
      } else if (onOpenResult) {
        onOpenResult(m.pdfRef, m.page);
      }
    },
    [matches, pdf, onOpenResult]
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

  // Open at the active match's page; the native viewer honours #page only on a fresh
  // load, so targetPage is part of the iframe key to force a remount on each jump.
  const iframeSrc = pdfUrl ? `${pdfUrl}#page=${targetPage}&view=Fit` : '';
  const hasMatches = matches.length > 0;
  const showFileName = scope !== 'file';

  return (
    <div ref={containerRef} id="pdf-viewer-container" className="viewer-overlay">
      <div className="viewer-header">
        <div className="viewer-header-left">
          <FileText size={20} style={{ color: 'var(--danger)', flexShrink: 0 }} />
          <h2 className="viewer-title" title={pdf.name}>
            {pdf.name}
          </h2>
        </div>

        {/* In-document / archive search — sits in the free space next to the title */}
        <div className="viewer-search">
          <select
            className="viewer-search-scope"
            value={scope}
            onChange={(e) => setScope(e.target.value)}
            title={t('search.scopeLabel')}
            aria-label={t('search.scopeLabel')}
          >
            <option value="file">{t('search.scopeFile')}</option>
            <option value="folder">{t('search.scopeFolder')}</option>
            <option value="all">{t('search.scopeAll')}</option>
          </select>

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
                onClick={() => setQuery('')}
                className="viewer-search-clear"
                title={t('viewer.clearSearch')}
                aria-label={t('viewer.clearSearch')}
              >
                <X size={15} />
              </button>
            )}
          </div>

          {/* Status / match navigation */}
          {isSearching ? (
            <span className="viewer-search-status" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
              <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />
              {progress.total > 1 ? t('viewer.searchProgress', progress.done, progress.total) : t('viewer.searching')}
            </span>
          ) : searchFailed ? (
            <span className="viewer-search-status">{t('viewer.searchError')}</span>
          ) : query.trim() && !hasMatches ? (
            <span className="viewer-search-status">{t('viewer.noMatches')}</span>
          ) : hasMatches ? (
            <div className="viewer-search-nav">
              <span className="viewer-search-status" style={{ fontVariantNumeric: 'tabular-nums' }}>
                {activeIndex >= 0 ? activeIndex + 1 : '–'} / {matches.length}{matches.length >= MAX_MATCHES ? '+' : ''}
              </span>
              <button className="btn-secondary" onClick={() => goToMatch(activeIndex - 1)} style={{ padding: '4px' }} title={t('viewer.prevMatch')}>
                <ChevronUp size={16} />
              </button>
              <button className="btn-secondary" onClick={() => goToMatch(activeIndex + 1)} style={{ padding: '4px' }} title={t('viewer.nextMatch')}>
                <ChevronDown size={16} />
              </button>
            </div>
          ) : null}

          {/* Results dropdown */}
          {hasMatches && (
            <div className="viewer-search-results">
              {matches.map((m, i) => (
                <button
                  key={`${m.pdfId}-${m.page}-${i}`}
                  className={`viewer-search-result ${i === activeIndex ? 'active' : ''}`}
                  onClick={() => goToMatch(i)}
                >
                  <span className="result-page">{t('viewer.page', m.page)}</span>
                  <span className="result-snippet">
                    {showFileName && <span className="result-file">{m.pdfName}</span>}
                    {m.before}
                    <mark>{m.match}</mark>
                    {m.after}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="viewer-header-right">
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
          <button className="viewer-close-btn" onClick={onClose} title={t('viewer.close')}>
            <X size={18} />
          </button>
        </div>
      </div>

      <div className="viewer-body">
        {isLoading ? (
          <div className="empty-state">
            <p>{t('viewer.loading')}</p>
          </div>
        ) : iframeSrc ? (
          <iframe
            key={`${pdf.id}::${targetPage}`} // remount on page jump so the native viewer honours #page
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
