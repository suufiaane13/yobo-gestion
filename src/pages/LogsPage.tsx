import { GerantLogsPage } from './GerantLogsPage'
import { useYoboStore } from '../store'

export function LogsPage() {
  const userId = useYoboStore((s) => s.userId)
  if (userId === null) return null
  return <GerantLogsPage userId={userId} />
}
