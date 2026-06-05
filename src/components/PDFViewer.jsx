import React, { useEffect, useState, useRef } from 'react';
import { X, Download, FileText, ChevronLeft, ChevronRight, Maximize2, Minimize2 } from 'lucide-react';
import { useI18n } from '../i18n.jsx';

export default function PDFViewer({ pdf, onClose, onPrev, onNext, hasPrev, hasNext }) {
  const { t } = useI18n();
  const [pdfUrl, setPdfUrl] = useState('');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const containerRef = useRef(null);

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

  // Append Fit layout parameters to Blob URL for optimized default view
  const iframeSrc = pdfUrl ? `${pdfUrl}#view=Fit` : '';

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
