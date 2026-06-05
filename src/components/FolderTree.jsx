import React, { useState } from 'react';
import { Folder, FolderOpen, Edit2, Trash2, Check, X, Plus } from 'lucide-react';

export default function FolderTree({
  folders,
  activeFolderId,
  onSelectFolder,
  onCreateFolder,
  onUpdateFolder,
  onDeleteFolder,
  onMovePDF,
  onReorderFolders
}) {
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState('');
  const [draggedFolderId, setDraggedFolderId] = useState(null);
  const [dragOverFolderId, setDragOverFolderId] = useState(null);

  const handleStartEdit = (folder, e) => {
    e.stopPropagation();
    setEditingId(folder.id);
    setEditName(folder.name);
  };

  const handleSaveEdit = async (id, e) => {
    e.stopPropagation();
    if (editName.trim() === '') return;
    await onUpdateFolder(id, { name: editName.trim() });
    setEditingId(null);
  };

  const handleCancelEdit = (e) => {
    e.stopPropagation();
    setEditingId(null);
  };

  // Drag & Drop for Folder Reordering and PDF Relocation
  const handleDragStart = (e, folderId) => {
    setDraggedFolderId(folderId);
    e.dataTransfer.setData('application/json', JSON.stringify({ type: 'folder', id: folderId }));
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e, targetFolderId) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverFolderId !== targetFolderId) {
      setDragOverFolderId(targetFolderId);
    }
  };

  const handleDragLeave = () => {
    setDragOverFolderId(null);
  };

  const handleDrop = async (e, targetFolderId) => {
    e.preventDefault();
    setDragOverFolderId(null);
    try {
      const dataStr = e.dataTransfer.getData('application/json');
      if (!dataStr) return;
      const data = JSON.parse(dataStr);

      if (data.type === 'pdf') {
        // PDF has been dropped onto a folder -> Move PDF to this folder
        await onMovePDF(data.id, targetFolderId);
      } else if (data.type === 'folder') {
        // Folder has been dropped onto another folder -> Reorder folders
        const sourceId = data.id;
        if (sourceId === targetFolderId) return;
        
        const sourceIndex = folders.findIndex(f => f.id === sourceId);
        const targetIndex = folders.findIndex(f => f.id === targetFolderId);
        
        if (sourceIndex === -1 || targetIndex === -1) return;

        const updatedFolders = [...folders];
        const [movedFolder] = updatedFolders.splice(sourceIndex, 1);
        updatedFolders.splice(targetIndex, 0, movedFolder);

        // Update orders
        const reordered = updatedFolders.map((f, index) => ({
          ...f,
          order: index
        }));

        await onReorderFolders(reordered);
      }
    } catch (err) {
      console.error('Error handling folder drop:', err);
    }
    setDraggedFolderId(null);
  };

  return (
    <div className="folder-tree-container">
      <div className="folder-list">
        {folders.map((folder) => {
          const isActive = folder.id === activeFolderId;
          const isDragOver = folder.id === dragOverFolderId;
          
          return (
            <div
              key={folder.id}
              className={`folder-item ${isActive ? 'active' : ''} ${isDragOver ? 'drag-over' : ''}`}
              onClick={() => onSelectFolder(folder.id)}
              draggable={editingId !== folder.id}
              onDragStart={(e) => handleDragStart(e, folder.id)}
              onDragOver={(e) => handleDragOver(e, folder.id)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, folder.id)}
            >
              <div className="folder-info">
                {isActive ? (
                  <FolderOpen className="logo-icon" size={18} />
                ) : (
                  <Folder size={18} style={{ color: 'var(--text-muted)' }} />
                )}
                
                {editingId === folder.id ? (
                  <input
                    type="text"
                    className="folder-name-input"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSaveEdit(folder.id, e);
                      if (e.key === 'Escape') handleCancelEdit(e);
                    }}
                    autoFocus
                  />
                ) : (
                  <span className="folder-name">{folder.name}</span>
                )}
              </div>

              <div className="folder-actions">
                {editingId === folder.id ? (
                  <>
                    <button
                      className="folder-action-btn"
                      onClick={(e) => handleSaveEdit(folder.id, e)}
                      title="저장"
                    >
                      <Check size={14} style={{ color: 'var(--success)' }} />
                    </button>
                    <button
                      className="folder-action-btn"
                      onClick={handleCancelEdit}
                      title="취소"
                    >
                      <X size={14} style={{ color: 'var(--danger)' }} />
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      className="folder-action-btn"
                      onClick={(e) => handleStartEdit(folder, e)}
                      title="이름 변경"
                    >
                      <Edit2 size={14} />
                    </button>
                    <button
                      className="folder-action-btn delete"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (confirm(`'${folder.name}' 폴더와 폴더 내부의 모든 PDF를 삭제하시겠습니까?`)) {
                          onDeleteFolder(folder.id);
                        }
                      }}
                      title="삭제"
                    >
                      <Trash2 size={14} />
                    </button>
                  </>
                )}
              </div>
            </div>
          );
        })}

        {folders.length === 0 && (
          <div className="empty-state" style={{ padding: '24px 12px' }}>
            <span style={{ fontSize: '0.85rem' }}>생성된 폴더가 없습니다.</span>
            <button
              className="btn-primary"
              style={{ padding: '6px 12px', fontSize: '0.8rem', marginTop: '8px' }}
              onClick={onCreateFolder}
            >
              <Plus size={14} /> 폴더 생성
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
