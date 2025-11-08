import { useEffect, useRef } from 'react';
import { useLocation, useNavigationType } from 'react-router-dom';

/**
 * Manages scroll restoration between routes.
 * - PUSH/REPLACE navigations reset to the top of the page.
 * - POP (back/forward) restores the last saved scroll position.
 */
const ScrollToTop = () => {
  const location = useLocation();
  const navigationType = useNavigationType();
  const positionsRef = useRef(new Map());
  const isBrowser = typeof window !== 'undefined';

  useEffect(() => {
    if (!isBrowser || !window.history || !('scrollRestoration' in window.history)) {
      return undefined;
    }
    const { scrollRestoration } = window.history;
    window.history.scrollRestoration = 'manual';
    return () => {
      window.history.scrollRestoration = scrollRestoration;
    };
  }, [isBrowser]);

  useEffect(() => {
    if (!isBrowser) return undefined;
    const key = location.key || location.pathname;
    return () => {
      positionsRef.current.set(key, window.scrollY || window.pageYOffset || 0);
    };
  }, [location, isBrowser]);

  useEffect(() => {
    if (!isBrowser) return;
    const key = location.key || location.pathname;
    const saved = positionsRef.current.get(key);
    if (navigationType === 'POP' && saved !== undefined) {
      window.scrollTo({ top: saved, left: 0, behavior: 'auto' });
    } else {
      window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    }
  }, [location, navigationType, isBrowser]);

  return null;
};

export default ScrollToTop;
