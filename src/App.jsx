import React, { useState, useEffect } from 'react';
import { Plus, Download, Upload, RefreshCw, Layers, Trash2, Languages } from 'lucide-react';
import { useI18n } from './i18n.jsx';
import {
  getFolders,
  saveFolder,
  deleteFolder,
  saveFolders,
  getPDFs,
  savePDF,
  deletePDF,
  savePDFs,
  getAllPDFs,
  deletePDFsInFolder,
  seedSampleData
} from './utils/db';
import FolderTree from './components/FolderTree';
import PDFList from './components/PDFList';
import PDFViewer from './components/PDFViewer';
import WelcomeToast from './components/Toast';

export default function App() {
  const { t, toggleLang } = useI18n();
  const [folders, setFolders] = useState([]);
  const [activeFolderId, setActiveFolderId] = useState(null);
  const [pdfs, setPDFs] = useState([]);
  const [selectedPDF, setSelectedPDF] = useState(null);
  const [viewerInitialPage, setViewerInitialPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

  // Load initial folder data
  useEffect(() => {
    async function loadInitialData() {
      try {
        setIsLoading(true);
        let folderList = await getFolders();

        // First-time visitor with an empty archive → seed a sample folder + PDF
        // so the app isn't blank. Runs once (guarded by a localStorage flag).
        if (folderList.length === 0 && localStorage.getItem('pdf-archive-seeded') !== '1') {
          try {
            await seedSampleData();
            localStorage.setItem('pdf-archive-seeded', '1');
            folderList = await getFolders();
          } catch (seedErr) {
            console.error('Failed to seed sample data:', seedErr);
          }
        }

        setFolders(folderList);
        if (folderList.length > 0) {
          setActiveFolderId(folderList[0].id);
        }
      } catch (err) {
        console.error('Failed to load folders:', err);
      } finally {
        setIsLoading(false);
      }
    }
    loadInitialData();
  }, []);

  // Load PDFs when active folder changes
  useEffect(() => {
    async function loadPDFs() {
      if (!activeFolderId) {
        setPDFs([]);
        return;
      }
      try {
        const pdfList = await getPDFs(activeFolderId);
        setPDFs(pdfList);
      } catch (err) {
        console.error('Failed to load PDFs:', err);
      }
    }
    loadPDFs();
  }, [activeFolderId]);

  // Folder actions
  const handleCreateFolder = async () => {
    const newFolder = {
      id: crypto.randomUUID(),
      name: t('app.defaultFolderName', folders.length + 1),
      order: folders.length,
      createdAt: new Date()
    };
    try {
      await saveFolder(newFolder);
      const updatedFolders = [...folders, newFolder];
      setFolders(updatedFolders);
      setActiveFolderId(newFolder.id);
    } catch (err) {
      console.error('Error creating folder:', err);
    }
  };

  const handleUpdateFolder = async (folderId, updates) => {
    const updatedFolders = folders.map(f => {
      if (f.id === folderId) {
        return { ...f, ...updates };
      }
      return f;
    });
    setFolders(updatedFolders);

    const folderToUpdate = updatedFolders.find(f => f.id === folderId);
    if (folderToUpdate) {
      try {
        await saveFolder(folderToUpdate);
      } catch (err) {
        console.error('Error updating folder in DB:', err);
      }
    }
  };

  const handleDeleteFolder = async (folderId) => {
    try {
      await deleteFolder(folderId);
      const updatedFolders = folders.filter(f => f.id !== folderId);
      setFolders(updatedFolders);
      
      // If we deleted the active folder, change selection
      if (activeFolderId === folderId) {
        if (updatedFolders.length > 0) {
          setActiveFolderId(updatedFolders[0].id);
        } else {
          setActiveFolderId(null);
        }
      }
    } catch (err) {
      console.error('Error deleting folder:', err);
    }
  };

  const handleReorderFolders = async (reorderedFolders) => {
    setFolders(reorderedFolders);
    try {
      await saveFolders(reorderedFolders);
    } catch (err) {
      console.error('Failed to save folders order:', err);
    }
  };

  // PDF actions
  const handleUploadPDFs = async (files) => {
    if (!activeFolderId) return;

    try {
      const uploadPromises = files.map(async (file, index) => {
        const arrayBuffer = await file.arrayBuffer();
        const newPDF = {
          id: crypto.randomUUID(),
          name: file.name,
          folderId: activeFolderId,
          fileData: arrayBuffer, // Store ArrayBuffer to bypass WebKit Blob bugs
          order: pdfs.length + index,
          addedAt: new Date()
        };
        await savePDF(newPDF);
        return newPDF;
      });

      const uploadedPDFs = await Promise.all(uploadPromises);
      setPDFs([...pdfs, ...uploadedPDFs]);
    } catch (err) {
      console.error('Error uploading PDFs:', err);
      alert(t('app.uploadError'));
    }
  };

  const handleDeletePDF = async (pdfId) => {
    try {
      await deletePDF(pdfId);
      setPDFs(pdfs.filter(p => p.id !== pdfId));
      if (selectedPDF && selectedPDF.id === pdfId) {
        setSelectedPDF(null);
      }
    } catch (err) {
      console.error('Error deleting PDF:', err);
    }
  };

  const handleDeleteAllPDFsInFolder = async () => {
    if (!activeFolderId) return;

    const confirmDelete = window.confirm(
      t('app.confirmEmptyFolder', activeFolder?.name, pdfs.length)
    );

    if (!confirmDelete) return;

    try {
      await deletePDFsInFolder(activeFolderId);
      setPDFs([]);
      if (selectedPDF && selectedPDF.folderId === activeFolderId) {
        setSelectedPDF(null);
      }
    } catch (err) {
      console.error('Error deleting all PDFs in folder:', err);
      alert(t('app.bulkDeleteError'));
    }
  };

  const handleReorderPDFs = async (reorderedPdfs) => {
    setPDFs(reorderedPdfs);
    try {
      await savePDFs(reorderedPdfs);
    } catch (err) {
      console.error('Failed to save PDFs order:', err);
    }
  };

  const handleMovePDF = async (pdfId, targetFolderId) => {
    try {
      // Find the PDF in current state or load from DB
      const pdfToMove = pdfs.find(p => p.id === pdfId) || 
        (await getPDFs(activeFolderId)).find(p => p.id === pdfId);

      if (!pdfToMove) return;

      // Check order in target folder
      const targetPDFs = await getPDFs(targetFolderId);
      
      const updatedPDF = {
        ...pdfToMove,
        folderId: targetFolderId,
        order: targetPDFs.length
      };

      await savePDF(updatedPDF);
      
      // Remove from current view list
      setPDFs(pdfs.filter(p => p.id !== pdfId));
      
      // Inform success
      console.log(`Moved PDF ${pdfToMove.name} to folder ${targetFolderId}`);
    } catch (err) {
      console.error('Failed to move PDF:', err);
      alert(t('app.moveError'));
    }
  };

  // Import / Export backups
  const handleExportBackup = async () => {
    try {
      setIsExporting(true);
      const allPdfs = await getAllPDFs();

      // Read PDF blobs into base64 strings to build a self-contained JSON
      const pdfsWithBase64 = await Promise.all(
        allPdfs.map(async (pdf) => {
          return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => {
              resolve({
                id: pdf.id,
                name: pdf.name,
                folderId: pdf.folderId,
                order: pdf.order,
                addedAt: pdf.addedAt,
                base64Data: reader.result
              });
            };
            const blob = new Blob([pdf.fileData], { type: 'application/pdf' });
            reader.readAsDataURL(blob);
          });
        })
      );

      const backupData = {
        version: '1.0',
        folders: folders,
        pdfs: pdfsWithBase64
      };

      const jsonString = JSON.stringify(backupData, null, 2);
      const blob = new Blob([jsonString], { type: 'application/json' });
      const url = URL.createObjectURL(blob);

      const link = document.createElement('a');
      link.href = url;
      link.download = `pdf_archive_backup_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Export backup failed:', err);
      alert(t('app.exportError'));
    } finally {
      setIsExporting(false);
    }
  };

  const handleImportBackup = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsImporting(true);
      const reader = new FileReader();
      
      reader.onload = async (event) => {
        try {
          const content = event.target.result;
          const data = JSON.parse(content);

          if (!data.folders || !data.pdfs) {
            throw new Error('올바르지 않은 백업 파일 형식입니다.');
          }

          // Convert base64 back to Blobs
          const importPDFPromises = data.pdfs.map(async (pdf) => {
            // base64 format: data:application/pdf;base64,iVBORw0KGgoAAAANSUhEUgAA...
            const res = await fetch(pdf.base64Data);
            const blob = await res.blob();
            const arrayBuffer = await blob.arrayBuffer();

            const pdfItem = {
              id: pdf.id,
              name: pdf.name,
              folderId: pdf.folderId,
              order: pdf.order,
              addedAt: new Date(pdf.addedAt),
              fileData: arrayBuffer
            };

            await savePDF(pdfItem);
          });

          // Save folders
          const importFolderPromises = data.folders.map(async (folder) => {
            await saveFolder({
              id: folder.id,
              name: folder.name,
              order: folder.order,
              createdAt: new Date(folder.createdAt || Date.now())
            });
          });

          await Promise.all([...importFolderPromises, ...importPDFPromises]);

          // Refresh state
          const refreshedFolders = await getFolders();
          setFolders(refreshedFolders);
          if (refreshedFolders.length > 0) {
            setActiveFolderId(refreshedFolders[0].id);
          } else {
            setActiveFolderId(null);
          }

          alert(t('app.importSuccess'));
        } catch (err) {
          console.error('Parsing backup failed:', err);
          alert(t('app.importError'));
        } finally {
          setIsImporting(false);
          e.target.value = null; // Clear input
        }
      };

      reader.readAsText(file);
    } catch (err) {
      console.error('Import backup file error:', err);
      setIsImporting(false);
    }
  };

  const activeFolder = folders.find(f => f.id === activeFolderId);

  const currentPdfIndex = selectedPDF ? pdfs.findIndex(p => p.id === selectedPDF.id) : -1;
  const hasPrev = currentPdfIndex > 0;
  const hasNext = currentPdfIndex !== -1 && currentPdfIndex < pdfs.length - 1;

  const handlePrevPDF = () => {
    if (hasPrev) {
      setViewerInitialPage(1);
      setSelectedPDF(pdfs[currentPdfIndex - 1]);
    }
  };

  const handleNextPDF = () => {
    if (hasNext) {
      setViewerInitialPage(1);
      setSelectedPDF(pdfs[currentPdfIndex + 1]);
    }
  };

  // Open a PDF from the file list (always at the first page)
  const handleViewPDF = (pdf) => {
    setViewerInitialPage(1);
    setSelectedPDF(pdf);
  };

  // Open a PDF from a search result, jumping to the matched page
  const handleOpenSearchResult = (pdf, page) => {
    setViewerInitialPage(page || 1);
    setSelectedPDF(pdf);
  };

  return (
    <div className="app-container">
      {/* Sidebar Section */}
      <aside className="sidebar">
        <div className="sidebar-header">
          <div className="logo-section">
            <Layers className="logo-icon" size={24} />
            <h1>PDF Archive</h1>
          </div>
          <button
            className="new-folder-btn"
            onClick={handleCreateFolder}
            title={t('app.newFolder')}
          >
            <Plus size={18} />
          </button>
        </div>

        <div className="sidebar-content">
          {isLoading ? (
            <div className="empty-state" style={{ padding: '32px 0' }}>
              <RefreshCw className="empty-state-icon" style={{ animation: 'spin 2s linear infinite' }} />
              <p>{t('app.loading')}</p>
            </div>
          ) : (
            <FolderTree
              folders={folders}
              activeFolderId={activeFolderId}
              onSelectFolder={setActiveFolderId}
              onCreateFolder={handleCreateFolder}
              onUpdateFolder={handleUpdateFolder}
              onDeleteFolder={handleDeleteFolder}
              onMovePDF={handleMovePDF}
              onReorderFolders={handleReorderFolders}
            />
          )}
        </div>

        <div className="sidebar-footer">
          <button
            className="btn-secondary"
            onClick={handleExportBackup}
            disabled={isExporting || folders.length === 0}
            style={{ width: '100%', justifyContent: 'center' }}
          >
            <Download size={16} />
            {isExporting ? t('app.exporting') : t('app.exportBackup')}
          </button>

          <label className="btn-secondary" style={{ width: '100%', justifyContent: 'center', cursor: 'pointer', textAlign: 'center' }}>
            <Upload size={16} />
            {isImporting ? t('app.importing') : t('app.importBackup')}
            <input
              type="file"
              accept=".json"
              style={{ display: 'none' }}
              onChange={handleImportBackup}
              disabled={isImporting}
            />
          </label>

          <button
            className="btn-secondary"
            onClick={toggleLang}
            style={{ width: '100%', justifyContent: 'center' }}
            title={t('lang.switchTo')}
          >
            <Languages size={16} />
            {t('lang.switchTo')}
          </button>
        </div>
      </aside>

      {/* Main Panel Section */}
      <main className="main-area">
        <header className="main-header">
          <div className="header-title-section">
            <h2 className="header-title">
              {activeFolder ? activeFolder.name : t('app.selectFolder')}
            </h2>
            {activeFolder && (
              <span className="header-meta">
                {t('app.materialCount', pdfs.length)}
              </span>
            )}
          </div>
          {activeFolder && pdfs.length > 0 && (
            <button
              className="btn-secondary"
              onClick={handleDeleteAllPDFsInFolder}
              style={{
                borderColor: 'var(--danger)',
                color: 'var(--danger)',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '0.85rem',
                padding: '6px 12px',
                cursor: 'pointer'
              }}
              title={t('app.emptyFolderTitle')}
            >
              <Trash2 size={14} />
              {t('app.emptyFolder')}
            </button>
          )}
        </header>

        <section className="main-content">
          <PDFList
            pdfs={pdfs}
            activeFolder={activeFolder}
            onUploadPDFs={handleUploadPDFs}
            onDeletePDF={handleDeletePDF}
            onViewPDF={handleViewPDF}
            onReorderPDFs={handleReorderPDFs}
          />
        </section>
      </main>

      {/* PDF View Modal Overlay */}
      {selectedPDF && (
        <PDFViewer
          pdf={selectedPDF}
          onClose={() => setSelectedPDF(null)}
          onPrev={handlePrevPDF}
          onNext={handleNextPDF}
          hasPrev={hasPrev}
          hasNext={hasNext}
          folderPdfs={pdfs}
          onOpenResult={handleOpenSearchResult}
          initialPage={viewerInitialPage}
        />
      )}

      {/* First-visit welcome toast */}
      <WelcomeToast />
    </div>
  );
}
