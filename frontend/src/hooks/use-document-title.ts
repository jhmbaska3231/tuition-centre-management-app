// frontend/src/hooks/use-document-title.ts

import { useEffect } from 'react';
import { usePublicOrg } from '@/api/queries/org';

export const useDocumentTitle = (title?: string): void => {
  const { data: org } = usePublicOrg();
  const name = org?.name ?? 'Tuition Centre';
  useEffect(() => {
    document.title = title ? `${title} | ${name}` : name;
  }, [title, name]);
};