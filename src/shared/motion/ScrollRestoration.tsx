import { useEffect, useLayoutEffect } from 'react'
import { useLocation, useNavigationType } from "react-router-dom";

// Shared state to keep track of active IgnoreScrollRules components
let ignoreScrollRulesCount = 0;

export function IgnoreScrollRules() {
  useLayoutEffect(() => {
    ignoreScrollRulesCount++;
    return () => {
      ignoreScrollRulesCount--;
    };
  }, []);
  return null;
}

export function ScrollToTop() {
  const { pathname } = useLocation();
  const navigationType = useNavigationType();

  useEffect(() => {
    if (ignoreScrollRulesCount > 0) return;

    // If it's a POP navigation (back/forward button), let the browser handle it.
    // We only want to scroll to top for PUSH or REPLACE navigations.
    if (navigationType !== "POP") {
      // Instant scroll to avoid visual jumps during page transitions
      window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    }
  }, [pathname, navigationType]);

  return null;
}
