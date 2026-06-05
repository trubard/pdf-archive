import React, { useState, useEffect } from 'react';
import { Plus, Download, Upload, RefreshCw, Layers, Trash2 } from 'lucide-react';
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
  deletePDFsInFolder
} from './utils/db';
import FolderTree from './components/FolderTree';
import PDFList from './components/PDFList';
import PDFViewer from './components/PDFViewer';

export default function App() {
  const [folders, setFolders] = useState([]);
  const [activeFolderId, setActiveFolderId] = useState(null);
  const [pdfs, setPDFs] = useState([]);
  const [selectedPDF, setSelectedPDF] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

  // Load initial folder data
  useEffect(() => {
    async function loadInitialData() {
      try {
        setIsLoading(true);
        const folderList = await getFolders();
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
      name: `새 폴더 ${folders.length + 1}`,
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
      alert('파일 업로드 도중 오류가 발생했습니다.');
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
      `정말로 이 폴더('${activeFolder?.name}') 안의 모든 PDF 강의자료(${pdfs.length}개)를 삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다.`
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
      alert('파일 일괄 삭제 중 오류가 발생했습니다.');
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
      alert('파일을 이동하는 도중 오류가 발생했습니다.');
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
      alert('백업 파일 생성 중 오류가 발생했습니다. 파일 크기가 너무 클 수 있습니다.');
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

          alert('백업 데이터 복원이 완료되었습니다!');
        } catch (err) {
          console.error('Parsing backup failed:', err);
          alert('데이터 복원 중 오류가 발생했습니다. 백업 파일이 손상되었거나 형식이 맞지 않습니다.');
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
      setSelectedPDF(pdfs[currentPdfIndex - 1]);
    }
  };

  const handleNextPDF = () => {
    if (hasNext) {
      setSelectedPDF(pdfs[currentPdfIndex + 1]);
    }
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
            title="새 폴더 만들기"
          >
            <Plus size={18} />
          </button>
        </div>

        <div className="sidebar-content">
          {isLoading ? (
            <div className="empty-state" style={{ padding: '32px 0' }}>
              <RefreshCw className="empty-state-icon" style={{ animation: 'spin 2s linear infinite' }} />
              <p>로딩 중...</p>
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
            {isExporting ? '백업 내보내는 중...' : '데이터 백업 내보내기'}
          </button>

          <label className="btn-secondary" style={{ width: '100%', justifyContent: 'center', cursor: 'pointer', textAlign: 'center' }}>
            <Upload size={16} />
            {isImporting ? '데이터 복원 중...' : '백업 가져오기'}
            <input
              type="file"
              accept=".json"
              style={{ display: 'none' }}
              onChange={handleImportBackup}
              disabled={isImporting}
            />
          </label>
        </div>
      </aside>

      {/* Main Panel Section */}
      <main className="main-area">
        <header className="main-header">
          <div className="header-title-section">
            <h2 className="header-title">
              {activeFolder ? activeFolder.name : '폴더를 선택하세요'}
            </h2>
            {activeFolder && (
              <span className="header-meta">
                강의자료 {pdfs.length}개
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
              title="이 폴더의 모든 파일 삭제"
            >
              <Trash2 size={14} />
              폴더 비우기
            </button>
          )}
        </header>

        <section className="main-content">
          <PDFList
            pdfs={pdfs}
            activeFolder={activeFolder}
            onUploadPDFs={handleUploadPDFs}
            onDeletePDF={handleDeletePDF}
            onViewPDF={setSelectedPDF}
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
        />
      )}
    </div>
  );
}
