import React, { useEffect, useState, useRef } from 'react';
import { X, Download, FileText, ChevronLeft, ChevronRight, Maximize2, Minimize2 } from 'lucide-react';

export default function PDFViewer({ pdf, onClose, onPrev, onNext, hasPrev, hasNext }) {
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
      alert('PDF 강의자료를 처리하는 중 오류가 발생했습니다.');
      setIsLoading(false);
    }

    return () => {
      if (activeUrl) {
        URL.revokeObjectURL(activeUrl);
      }
    };
  }, [pdf]);

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
              title="이전 파일"
            >
              <ChevronLeft size={18} />
            </button>
            <button
              className="btn-secondary"
              onClick={onNext}
              disabled={!hasNext}
              style={{ padding: '6px', opacity: hasNext ? 1 : 0.4, cursor: hasNext ? 'pointer' : 'not-allowed' }}
              title="다음 파일"
            >
              <ChevronRight size={18} />
            </button>
          </div>

          {/* Fullscreen Control */}
          <button
            className="btn-secondary"
            onClick={toggleFullscreen}
            style={{ padding: '6px' }}
            title={isFullscreen ? "전체화면 축소" : "전체화면 확대"}
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
            title="파일 다운로드"
          >
            <Download size={14} /> 다운로드
          </button>

          {/* Close Control */}
          <button
            className="viewer-close-btn"
            onClick={onClose}
            title="뷰어 닫기"
          >
            <X size={18} />
          </button>
        </div>
      </div>
      
      <div className="viewer-body">
        {isLoading ? (
          <div className="empty-state">
            <p>PDF 문서를 로드하는 중...</p>
          </div>
        ) : iframeSrc ? (
          <iframe
            key={pdf.id} // Revert to only remounting when changing the PDF document, avoiding flash
            src={iframeSrc}
            title={pdf.name}
            className="viewer-iframe"
            frameBorder="0"
          >
            이 브라우저는 PDF 표시를 지원하지 않습니다. 아래 다운로드 단추를 눌러 파일로 열어주세요.
          </iframe>
        ) : (
          <div className="empty-state">
            <p>PDF 문서를 해석하지 못했습니다.</p>
          </div>
        )}
      </div>
    </div>
  );
}
