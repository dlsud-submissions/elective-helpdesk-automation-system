import { useEffect } from 'react';

export const APP_TITLE = 'Harbor Tickets';

/** Sets a unique browser tab title per screen, e.g. "Chat · Harbor Tickets". */
export function useDocumentTitle(pageTitle: string | null | undefined): void {
  useEffect(() => {
    document.title = pageTitle ? `${pageTitle} · ${APP_TITLE}` : APP_TITLE;
  }, [pageTitle]);
}
