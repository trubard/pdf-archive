/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useCallback, useEffect, useMemo, useState } from 'react';

const STORAGE_KEY = 'pdf-archive-lang';
export const LANGUAGES = ['ko', 'en'];

// Translation dictionary. Values are either strings or functions (for interpolation).
const translations = {
  ko: {
    // App / sidebar
    'app.newFolder': '새 폴더 만들기',
    'app.loading': '로딩 중...',
    'app.exportBackup': '데이터 백업 내보내기',
    'app.exporting': '백업 내보내는 중...',
    'app.importBackup': '백업 가져오기',
    'app.importing': '데이터 복원 중...',
    'app.selectFolder': '폴더를 선택하세요',
    'app.materialCount': (n) => `강의자료 ${n}개`,
    'app.emptyFolder': '폴더 비우기',
    'app.emptyFolderTitle': '이 폴더의 모든 파일 삭제',
    'app.defaultFolderName': (n) => `새 폴더 ${n}`,
    'app.confirmEmptyFolder': (name, count) =>
      `정말로 이 폴더('${name}') 안의 모든 PDF 강의자료(${count}개)를 삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다.`,
    'app.uploadError': '파일 업로드 도중 오류가 발생했습니다.',
    'app.bulkDeleteError': '파일 일괄 삭제 중 오류가 발생했습니다.',
    'app.moveError': '파일을 이동하는 도중 오류가 발생했습니다.',
    'app.exportError': '백업 파일 생성 중 오류가 발생했습니다. 파일 크기가 너무 클 수 있습니다.',
    'app.importSuccess': '백업 데이터 복원이 완료되었습니다!',
    'app.importError': '데이터 복원 중 오류가 발생했습니다. 백업 파일이 손상되었거나 형식이 맞지 않습니다.',

    // Language switcher
    'lang.switchTo': 'English로 보기',

    // FolderTree
    'folder.save': '저장',
    'folder.cancel': '취소',
    'folder.rename': '이름 변경',
    'folder.delete': '삭제',
    'folder.confirmDelete': (name) => `'${name}' 폴더와 폴더 내부의 모든 PDF를 삭제하시겠습니까?`,
    'folder.empty': '생성된 폴더가 없습니다.',
    'folder.create': '폴더 생성',

    // PDFList
    'pdf.onlyPdf': 'PDF 파일만 업로드할 수 있습니다.',
    'pdf.noFolderSelected': '선택된 폴더가 없습니다',
    'pdf.noFolderHint': '왼쪽 사이드바에서 폴더를 선택하거나 새로 생성해 주세요.',
    'pdf.uploadTitle': '강의자료 PDF 파일 업로드',
    'pdf.uploadDesc': '여기로 드래그 앤 드롭하거나 클릭하여 파일을 선택하세요. (PDF만 가능)',
    'pdf.confirmDelete': (name) => `'${name}' 파일을 삭제하시겠습니까?`,
    'pdf.delete': '삭제',
    'pdf.view': '보기',
    'pdf.folderEmpty': '이 폴더는 비어있습니다',
    'pdf.folderEmptyHint': '상단의 업로드 영역을 이용해 PDF 강의 자료를 추가해 보세요.',

    // PDFViewer
    'viewer.prev': '이전 파일',
    'viewer.next': '다음 파일',
    'viewer.fullscreenOff': '전체화면 축소',
    'viewer.fullscreenOn': '전체화면 확대',
    'viewer.download': '다운로드',
    'viewer.downloadTitle': '파일 다운로드',
    'viewer.close': '뷰어 닫기',
    'viewer.loading': 'PDF 문서를 로드하는 중...',
    'viewer.unsupported': '이 브라우저는 PDF 표시를 지원하지 않습니다. 아래 다운로드 단추를 눌러 파일로 열어주세요.',
    'viewer.parseFailed': 'PDF 문서를 해석하지 못했습니다.',
    'viewer.processError': 'PDF 강의자료를 처리하는 중 오류가 발생했습니다.',
    'viewer.searchPlaceholder': '이 문서에서 검색',
    'viewer.searching': '문서 텍스트 분석 중…',
    'viewer.noMatches': '검색 결과가 없습니다',
    'viewer.searchError': '문서 텍스트를 읽을 수 없습니다 (스캔 이미지 PDF일 수 있어요).',
    'viewer.prevMatch': '이전 결과',
    'viewer.nextMatch': '다음 결과',
    'viewer.clearSearch': '검색 지우기',
    'viewer.page': (n) => `${n}쪽`,
    'viewer.searchProgress': (done, total) => `분석 중… (${done}/${total})`,
    'search.scopeFile': '현재 파일',
    'search.scopeFolder': '현재 폴더',
    'search.scopeAll': '전체 폴더',
    'search.scopeLabel': '검색 범위',

    // Welcome toast
    'toast.reopen': '서비스 안내 다시 보기',
    'toast.close': '안내 닫기',
    'toast.title': 'PDF Archive에 오신 걸 환영합니다',
    'toast.subtitle': '강의·학습용 PDF를 폴더로 정리하고 브라우저에서 바로 보는 프라이빗 저장소예요.',
    'toast.feature1': '폴더로 강의 자료를 깔끔하게 분류',
    'toast.feature2': '드래그 앤 드롭으로 순서 정렬 · 즉시 뷰어 열람',
    'toast.feature3': '모든 파일은 서버 없이 내 기기에만 저장',
    'toast.cta': '시작하기',
  },
  en: {
    // App / sidebar
    'app.newFolder': 'New folder',
    'app.loading': 'Loading...',
    'app.exportBackup': 'Export backup',
    'app.exporting': 'Exporting backup...',
    'app.importBackup': 'Import backup',
    'app.importing': 'Restoring data...',
    'app.selectFolder': 'Select a folder',
    'app.materialCount': (n) => `${n} ${n === 1 ? 'file' : 'files'}`,
    'app.emptyFolder': 'Empty folder',
    'app.emptyFolderTitle': 'Delete all files in this folder',
    'app.defaultFolderName': (n) => `New folder ${n}`,
    'app.confirmEmptyFolder': (name, count) =>
      `Delete all ${count} PDF file(s) inside the folder "${name}"?\nThis action cannot be undone.`,
    'app.uploadError': 'An error occurred while uploading files.',
    'app.bulkDeleteError': 'An error occurred while deleting files.',
    'app.moveError': 'An error occurred while moving the file.',
    'app.exportError': 'Failed to create the backup file. The file size may be too large.',
    'app.importSuccess': 'Backup data restored successfully!',
    'app.importError': 'Failed to restore data. The backup file may be corrupted or in the wrong format.',

    // Language switcher
    'lang.switchTo': '한국어로 보기',

    // FolderTree
    'folder.save': 'Save',
    'folder.cancel': 'Cancel',
    'folder.rename': 'Rename',
    'folder.delete': 'Delete',
    'folder.confirmDelete': (name) => `Delete the folder "${name}" and all PDFs inside it?`,
    'folder.empty': 'No folders yet.',
    'folder.create': 'Create folder',

    // PDFList
    'pdf.onlyPdf': 'Only PDF files can be uploaded.',
    'pdf.noFolderSelected': 'No folder selected',
    'pdf.noFolderHint': 'Select a folder from the left sidebar or create a new one.',
    'pdf.uploadTitle': 'Upload PDF files',
    'pdf.uploadDesc': 'Drag and drop here, or click to choose files. (PDF only)',
    'pdf.confirmDelete': (name) => `Delete the file "${name}"?`,
    'pdf.delete': 'Delete',
    'pdf.view': 'View',
    'pdf.folderEmpty': 'This folder is empty',
    'pdf.folderEmptyHint': 'Use the upload area above to add PDF files.',

    // PDFViewer
    'viewer.prev': 'Previous file',
    'viewer.next': 'Next file',
    'viewer.fullscreenOff': 'Exit fullscreen',
    'viewer.fullscreenOn': 'Enter fullscreen',
    'viewer.download': 'Download',
    'viewer.downloadTitle': 'Download file',
    'viewer.close': 'Close viewer',
    'viewer.loading': 'Loading PDF document...',
    'viewer.unsupported': 'This browser cannot display PDFs. Click the download button below to open the file.',
    'viewer.parseFailed': 'Could not render the PDF document.',
    'viewer.processError': 'An error occurred while processing the PDF file.',
    'viewer.searchPlaceholder': 'Search in this document',
    'viewer.searching': 'Analyzing document text…',
    'viewer.noMatches': 'No matches found',
    'viewer.searchError': 'Could not read the document text (it may be a scanned image PDF).',
    'viewer.prevMatch': 'Previous match',
    'viewer.nextMatch': 'Next match',
    'viewer.clearSearch': 'Clear search',
    'viewer.page': (n) => `p.${n}`,
    'viewer.searchProgress': (done, total) => `Analyzing… (${done}/${total})`,
    'search.scopeFile': 'This file',
    'search.scopeFolder': 'This folder',
    'search.scopeAll': 'All folders',
    'search.scopeLabel': 'Search scope',

    // Welcome toast
    'toast.reopen': 'Show the intro again',
    'toast.close': 'Dismiss',
    'toast.title': 'Welcome to PDF Archive',
    'toast.subtitle': 'A private archive to organize study PDFs into folders and read them right in your browser.',
    'toast.feature1': 'Organize study materials neatly into folders',
    'toast.feature2': 'Reorder by drag & drop · open in the viewer instantly',
    'toast.feature3': 'Every file is stored only on your device, never a server',
    'toast.cta': 'Get started',
  },
};

function detectLanguage() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && LANGUAGES.includes(saved)) return saved;
  } catch {
    // ignore
  }
  const nav = (typeof navigator !== 'undefined' && navigator.language) || '';
  // English browsers -> English, everything else -> Korean
  return nav.toLowerCase().startsWith('en') ? 'en' : 'ko';
}

const I18nContext = createContext(null);

export function I18nProvider({ children }) {
  const [lang, setLangState] = useState(detectLanguage);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const setLang = useCallback((next) => {
    setLangState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // ignore
    }
  }, []);

  const toggleLang = useCallback(() => {
    setLang(lang === 'ko' ? 'en' : 'ko');
  }, [lang, setLang]);

  const t = useCallback(
    (key, ...args) => {
      const dict = translations[lang] || translations.ko;
      const value = dict[key];
      if (value === undefined) return key; // surface missing keys instead of blank
      return typeof value === 'function' ? value(...args) : value;
    },
    [lang]
  );

  const ctx = useMemo(() => ({ lang, setLang, toggleLang, t }), [lang, setLang, toggleLang, t]);

  return <I18nContext.Provider value={ctx}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used within an I18nProvider');
  return ctx;
}
