// frontend/src/features/parent/children/relationships.ts

import { RELATIONSHIPS, type Relationship } from '@tuition/shared';

export const RELATIONSHIP_LABELS: Record<Relationship, string> = {
  mother: 'Mother',
  father: 'Father',
  guardian: 'Guardian',
};

export const relationshipOptions = RELATIONSHIPS.map(value => ({ value, label: RELATIONSHIP_LABELS[value] }));