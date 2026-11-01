import { algorithmProblems } from '@/lib/problems/algorithms';
import { foundationProblems } from '@/lib/problems/foundations';
import { frontendProblems } from '@/lib/problems/frontend';
import { linkedListProblems } from '@/lib/problems/linked-lists';

export const codeProblems = [...foundationProblems, ...algorithmProblems, ...linkedListProblems, ...frontendProblems];
