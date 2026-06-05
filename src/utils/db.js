const DB_NAME = 'PDFStudyViewerDB';
const DB_VERSION = 1;

let dbInstance = null;

export function initDB() {
  if (dbInstance) {
    return Promise.resolve(dbInstance);
  }

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = (event) => {
      console.error('Database error:', event.target.error);
      reject(event.target.error);
    };

    request.onsuccess = (event) => {
      dbInstance = event.target.result;
      
      // Prevent connection leaks
      dbInstance.onversionchange = () => {
        dbInstance.close();
        dbInstance = null;
      };
      
      resolve(dbInstance);
    };

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      
      // Create folders store
      if (!db.objectStoreNames.contains('folders')) {
        db.createObjectStore('folders', { keyPath: 'id' });
      }

      // Create pdfs store
      if (!db.objectStoreNames.contains('pdfs')) {
        const pdfStore = db.createObjectStore('pdfs', { keyPath: 'id' });
        pdfStore.createIndex('folderId', 'folderId', { unique: false });
      }
    };
  });
}

// FOLDERS API
export async function getFolders() {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('folders', 'readonly');
    const store = transaction.objectStore('folders');
    const request = store.getAll();

    request.onsuccess = () => {
      const folders = request.result;
      // Sort by order asc, then by name
      folders.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
      resolve(folders);
    };

    request.onerror = () => reject(request.error);
  });
}

export async function saveFolder(folder) {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('folders', 'readwrite');
    const store = transaction.objectStore('folders');
    const request = store.put(folder);

    request.onsuccess = () => resolve(folder);
    request.onerror = () => reject(request.error);
  });
}

export async function deleteFolder(folderId) {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['folders', 'pdfs'], 'readwrite');
    
    // Delete folder
    const folderStore = transaction.objectStore('folders');
    folderStore.delete(folderId);

    // Delete associated pdfs
    const pdfStore = transaction.objectStore('pdfs');
    const index = pdfStore.index('folderId');
    const request = index.openCursor(IDBKeyRange.only(folderId));

    request.onsuccess = (event) => {
      const cursor = event.target.result;
      if (cursor) {
        cursor.delete();
        cursor.continue();
      }
    };

    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
}

export async function saveFolders(folders) {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('folders', 'readwrite');
    const store = transaction.objectStore('folders');
    
    folders.forEach(folder => {
      store.put(folder);
    });

    transaction.oncomplete = () => resolve(folders);
    transaction.onerror = () => reject(transaction.error);
  });
}

// PDFs API
export async function getPDFs(folderId) {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('pdfs', 'readonly');
    const store = transaction.objectStore('pdfs');
    const index = store.index('folderId');
    const request = index.getAll(IDBKeyRange.only(folderId));

    request.onsuccess = () => {
      const pdfs = request.result;
      // Sort by order asc, then addedAt
      pdfs.sort((a, b) => {
        if ((a.order ?? 0) !== (b.order ?? 0)) {
          return (a.order ?? 0) - (b.order ?? 0);
        }
        return new Date(a.addedAt).getTime() - new Date(b.addedAt).getTime();
      });
      resolve(pdfs);
    };

    request.onerror = () => reject(request.error);
  });
}

export async function savePDF(pdf) {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('pdfs', 'readwrite');
    const store = transaction.objectStore('pdfs');
    const request = store.put(pdf);

    request.onsuccess = () => resolve(pdf);
    request.onerror = () => reject(request.error);
  });
}

export async function deletePDF(pdfId) {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('pdfs', 'readwrite');
    const store = transaction.objectStore('pdfs');
    const request = store.delete(pdfId);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function savePDFs(pdfs) {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('pdfs', 'readwrite');
    const store = transaction.objectStore('pdfs');
    
    pdfs.forEach(pdf => {
      store.put(pdf);
    });

    transaction.oncomplete = () => resolve(pdfs);
    transaction.onerror = () => reject(transaction.error);
  });
}

export async function getAllPDFs() {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('pdfs', 'readonly');
    const store = transaction.objectStore('pdfs');
    const request = store.getAll();

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function deletePDFsInFolder(folderId) {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('pdfs', 'readwrite');
    const pdfStore = transaction.objectStore('pdfs');
    const index = pdfStore.index('folderId');
    const request = index.openCursor(IDBKeyRange.only(folderId));

    request.onsuccess = (event) => {
      const cursor = event.target.result;
      if (cursor) {
        cursor.delete();
        cursor.continue();
      }
    };

    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
}
