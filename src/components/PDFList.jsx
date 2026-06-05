import React, { useRef, useState } from 'react';
import { FileText, Upload, Trash2, Eye, FileWarning } from 'lucide-react';
import { useI18n } from '../i18n.jsx';

export default function PDFList({
  pdfs,
  activeFolder,
  onUploadPDFs,
  onDeletePDF,
  onViewPDF,
  onReorderPDFs
}) {
  const { t } = useI18n();
  const [isDragActive, setIsDragActive] = useState(false);
  const [draggedPdfId, setDraggedPdfId] = useState(null);
  const [dragOverPdfId, setDragOverPdfId] = useState(null);
  const fileInputRef = useRef(null);

  // File size formatter
  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Trigger file selection dialog
  const handleDropzoneClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  // Handle file selection from input
  const handleFileChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      onUploadPDFs(Array.from(e.target.files));
      e.target.value = null; // Reset input
    }
  };

  // Drag over dropzone (for file uploading)
  const handleUploadDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setIsDragActive(true);
    } else if (e.type === 'dragleave') {
      setIsDragActive(false);
    }
  };

  const handleUploadDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const files = Array.from(e.dataTransfer.files).filter(
        file => file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
      );
      if (files.length > 0) {
        onUploadPDFs(files);
      } else {
        alert(t('pdf.onlyPdf'));
      }
    }
  };

  // Drag & Drop for reordering PDF items
  const handlePDFDragStart = (e, pdfId) => {
    setDraggedPdfId(pdfId);
    e.dataTransfer.setData('application/json', JSON.stringify({ type: 'pdf', id: pdfId }));
    e.dataTransfer.effectAllowed = 'move';
  };

  const handlePDFDragOver = (e, targetPdfId) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverPdfId !== targetPdfId) {
      setDragOverPdfId(targetPdfId);
    }
  };

  const handlePDFDragLeave = () => {
    setDragOverPdfId(null);
  };

  const handlePDFDrop = (e, targetPdfId) => {
    e.preventDefault();
    setDragOverPdfId(null);
    try {
      const dataStr = e.dataTransfer.getData('application/json');
      if (!dataStr) return;
      const data = JSON.parse(dataStr);

      if (data.type === 'pdf') {
        const sourceId = data.id;
        if (sourceId === targetPdfId) return;

        const sourceIndex = pdfs.findIndex(p => p.id === sourceId);
        const targetIndex = pdfs.findIndex(p => p.id === targetPdfId);

        if (sourceIndex === -1 || targetIndex === -1) return;

        const updatedPdfs = [...pdfs];
        const [movedPdf] = updatedPdfs.splice(sourceIndex, 1);
        updatedPdfs.splice(targetIndex, 0, movedPdf);

        // Assign new order values
        const reordered = updatedPdfs.map((p, index) => ({
          ...p,
          order: index
        }));

        onReorderPDFs(reordered);
      }
    } catch (err) {
      console.error('Error reordering PDFs:', err);
    }
    setDraggedPdfId(null);
  };

  if (!activeFolder) {
    return (
      <div className="empty-state">
        <FileWarning className="empty-state-icon" />
        <h2 className="empty-state-title">{t('pdf.noFolderSelected')}</h2>
        <p>{t('pdf.noFolderHint')}</p>
      </div>
    );
  }

  return (
    <div className="pdf-list-container">
      {/* Upload Dropzone */}
      <div
        className={`upload-dropzone ${isDragActive ? 'drag-active' : ''}`}
        onDragEnter={handleUploadDrag}
        onDragOver={handleUploadDrag}
        onDragLeave={handleUploadDrag}
        onDrop={handleUploadDrop}
        onClick={handleDropzoneClick}
      >
        <input
          type="file"
          ref={fileInputRef}
          className="file-input-hidden"
          accept=".pdf,application/pdf"
          multiple
          onChange={handleFileChange}
        />
        <Upload className="upload-icon" />
        <div className="upload-title">{t('pdf.uploadTitle')}</div>
        <div className="upload-desc">{t('pdf.uploadDesc')}</div>
      </div>

      {/* PDF List Grid */}
      {pdfs.length > 0 ? (
        <div className="pdf-grid">
          {pdfs.map((pdf) => {
            const isDragging = pdf.id === draggedPdfId;
            const isDragOver = pdf.id === dragOverPdfId;

            return (
              <div
                key={pdf.id}
                className={`pdf-card ${isDragging ? 'dragging' : ''} ${isDragOver ? 'drag-over-item' : ''}`}
                draggable
                onDragStart={(e) => handlePDFDragStart(e, pdf.id)}
                onDragOver={(e) => handlePDFDragOver(e, pdf.id)}
                onDragLeave={handlePDFDragLeave}
                onDrop={(e) => handlePDFDrop(e, pdf.id)}
              >
                <div className="pdf-thumbnail">
                  <FileText className="pdf-icon-bg" />
                </div>
                <div className="pdf-info">
                  <div className="pdf-title" title={pdf.name}>
                    {pdf.name}
                  </div>
                  <div className="pdf-meta">
                    <span>{formatFileSize(pdf.fileData ? (pdf.fileData.byteLength ?? pdf.fileData.size ?? 0) : 0)}</span>
                    <span>{new Date(pdf.addedAt).toLocaleDateString()}</span>
                  </div>
                </div>
                <div className="pdf-card-actions">
                  <button
                    className="pdf-btn delete"
                    onClick={() => {
                      if (confirm(t('pdf.confirmDelete', pdf.name))) {
                        onDeletePDF(pdf.id);
                      }
                    }}
                    title={t('pdf.delete')}
                  >
                    <Trash2 size={14} />
                  </button>
                  <button
                    className="pdf-btn view"
                    onClick={() => onViewPDF(pdf)}
                  >
                    <Eye size={14} /> {t('pdf.view')}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="empty-state" style={{ border: '1px dashed var(--border)', borderRadius: 'var(--radius-lg)' }}>
          <FileText className="empty-state-icon" />
          <h3 className="empty-state-title">{t('pdf.folderEmpty')}</h3>
          <p>{t('pdf.folderEmptyHint')}</p>
        </div>
      )}
    </div>
  );
}
