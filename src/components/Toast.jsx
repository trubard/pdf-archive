import { useCallback, useEffect, useState } from 'react';
import { Sparkles, X, FolderTree, MousePointerClick, ShieldCheck, HelpCircle } from 'lucide-react';
import { useI18n } from '../i18n.jsx';
import './Toast.css';

const STORAGE_KEY = 'pdf-archive-welcomed';
const AUTO_DISMISS_MS = 12000;

export default function WelcomeToast() {
  const { t } = useI18n();
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
          aria-label={t('toast.reopen')}
          title={t('toast.reopen')}
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
          <button className="welcome-toast__close" onClick={handleClose} aria-label={t('toast.close')}>
            <X size={16} />
          </button>

          <div className="welcome-toast__header">
            <span className="welcome-toast__badge">
              <Sparkles size={16} />
            </span>
            <div>
              <strong className="welcome-toast__title">{t('toast.title')}</strong>
              <p className="welcome-toast__subtitle">{t('toast.subtitle')}</p>
            </div>
          </div>

          <ul className="welcome-toast__list">
            <li>
              <FolderTree size={15} />
              <span>{t('toast.feature1')}</span>
            </li>
            <li>
              <MousePointerClick size={15} />
              <span>{t('toast.feature2')}</span>
            </li>
            <li>
              <ShieldCheck size={15} />
              <span>{t('toast.feature3')}</span>
            </li>
          </ul>

          <button className="welcome-toast__cta" onClick={handleClose}>
            {t('toast.cta')}
          </button>
        </div>
      )}
    </>
  );
}
