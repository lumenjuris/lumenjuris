import { useEffect, useRef, useCallback } from 'react';
import { ClauseRisk } from '../types';
import { modernHighlighter } from '../utils/modernHighlighter';

interface Props {
    containerRef: React.RefObject<HTMLDivElement>;
    clauses: ClauseRisk[];
    text: string;
    editingClauseId: string | null;
}

export function useClauseHighlight({
    containerRef,
    clauses,
    text,
    editingClauseId,
}: Props) {

    const highlightKeyRef = useRef('')


    const runHighlight = useCallback(() => {

        if (!containerRef.current || clauses.length === 0 || !text) return

        const key = `${text.length}|${clauses.map(c => c.id).join(',')}`;
        if (highlightKeyRef.current === key && editingClauseId === null) {
            modernHighlighter.clearAllHighlights()
            modernHighlighter.highlightAllClauses(clauses, containerRef.current)
            return
        }

        if (highlightKeyRef.current === key) return;

        highlightKeyRef.current = key;
        modernHighlighter.clearAllHighlights();
        modernHighlighter.highlightAllClauses(clauses, containerRef.current);
    }, [clauses, text, editingClauseId]);



    useEffect(() => {
        runHighlight();
    }, [runHighlight]);



    const clear = () => {
        modernHighlighter.clearHighlights();
        highlightKeyRef.current = '';
    };


    const reHighlight = () => {
        highlightKeyRef.current = '';
        runHighlight();
    };


    const highlightOne = (clause: ClauseRisk) => {
        if (!containerRef.current) return;
        modernHighlighter.highlightClause(clause, containerRef.current);
    };

    return { clear, reHighlight, highlightOne };
}
