import { useCallback, useEffect, useState } from 'react';
import { Sparkles, X, FolderTree, MousePointerClick, ShieldCheck, HelpCircle } from 'lucide-react';
import './Toast.css';

const STORAGE_KEY = 'pdf-archive-welcomed';
const AUTO_DISMISS_MS = 12000;

export default function WelcomeToast() {
  const [visible, setVisible] = useState(false);
  const [leaving, setLeaving] = useState(false);

  const handleClose = useCallback(() => {
    setLeaving(true);
    try {
      localStorage.setItem(STORAGE_KEY, '1');
    } catch {
      // ignore
    }
    // Wait for the exit animation before unmounting
    setTimeout(() => {
      setVisible(false);
      setLeaving(false);
    }, 300);
  }, []);

  const handleOpen = useCallback(() => {
    setLeaving(false);
    setVisible(true);
  }, []);

  // Auto-show on first visit only
  useEffect(() => {
    let hasSeen = false;
    try {
      hasSeen = localStorage.getItem(STORAGE_KEY) === '1';
    } catch {
      // localStorage unavailable (private mode) — show the toast anyway
    }
    if (hasSeen) return;

    // Small delay so the app paints first, then the toast slides in
    const showTimer = setTimeout(() => setVisible(true), 600);
    const autoTimer = setTimeout(() => handleClose(), 600 + AUTO_DISMISS_MS);
    return () => {
      clearTimeout(showTimer);
      clearTimeout(autoTimer);
    };
  }, [handleClose]);

  return (
    <>
      {/* Persistent help button — re-opens the welcome toast anytime */}
      {!visible && (
        <button
          className="welcome-help-fab"
          onClick={handleOpen}
          aria-label="서비스 안내 다시 보기"
          title="서비스 안내 다시 보기"
        >
          <HelpCircle size={22} />
        </button>
      )}

      {visible && (
        <div
          className={`welcome-toast ${leaving ? 'is-leaving' : ''}`}
          role="status"
          aria-live="polite"
        >
          <button className="welcome-toast__close" onClick={handleClose} aria-label="안내 닫기">
            <X size={16} />
          </button>

          <div className="welcome-toast__header">
            <span className="welcome-toast__badge">
              <Sparkles size={16} />
            </span>
            <div>
              <strong className="welcome-toast__title">PDF Archive에 오신 걸 환영합니다</strong>
              <p className="welcome-toast__subtitle">
                강의·학습용 PDF를 폴더로 정리하고 브라우저에서 바로 보는 프라이빗 저장소예요.
              </p>
            </div>
          </div>

          <ul className="welcome-toast__list">
            <li>
              <FolderTree size={15} />
              <span>폴더로 강의 자료를 깔끔하게 분류</span>
            </li>
            <li>
              <MousePointerClick size={15} />
              <span>드래그 앤 드롭으로 순서 정렬 · 즉시 뷰어 열람</span>
            </li>
            <li>
              <ShieldCheck size={15} />
              <span>모든 파일은 서버 없이 내 기기에만 저장</span>
            </li>
          </ul>

          <button className="welcome-toast__cta" onClick={handleClose}>
            시작하기
          </button>
        </div>
      )}
    </>
  );
}
