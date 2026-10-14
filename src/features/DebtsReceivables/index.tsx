import { useMemo } from 'react'

import { computeDebtsReceivables } from './computeDebtsReceivables'
import { DebtsReceivablesCard } from './DebtsReceivablesCard'
import { useDebtsReceivables } from './useDebtsReceivables'

interface DebtsReceivablesProps { privacyMode: boolean; viewerOpen?: boolean; onToggleViewer?: () => void; selectedRecord?: string | null; onSelectRecord?: (key: string) => void }

/** Authenticated data wrapper for the presentational DebtsReceivablesCard. */
export default function DebtsReceivables({ privacyMode, viewerOpen = false, onToggleViewer, selectedRecord = null, onSelectRecord = () => {} }: DebtsReceivablesProps) {
  const { rows, fxMap, isLoading, isError } = useDebtsReceivables()
  const views = useMemo(() => computeDebtsReceivables(rows, fxMap).map((view, index) => ({ view, index })).sort((a, b) => {
    const ta = a.view.sortTs
    const tb = b.view.sortTs
    if (ta === null && tb === null) return a.index - b.index
    if (ta === null) return 1
    if (tb === null) return -1
    return tb - ta || a.index - b.index
  }).map(({ view }) => view), [rows, fxMap])
  return <DebtsReceivablesCard privacyMode={privacyMode} views={views} isLoading={isLoading} isError={isError} viewerOpen={viewerOpen} onToggleViewer={onToggleViewer} selectedRecord={selectedRecord} onSelectRecord={onSelectRecord} />
}

export { DebtsReceivablesCard } from './DebtsReceivablesCard'
export { DebtsReceivablesViewerCard, type DebtActivityParticipant, type DebtActivityView, type DebtsReceivablesViewerCardProps } from './DebtsReceivablesViewerCard'
