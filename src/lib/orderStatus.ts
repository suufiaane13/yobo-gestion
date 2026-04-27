import type { CashSessionDto } from '../types/cash'
import type { OrderItem } from '../types/orders'
import type { Role } from '../types/yoboApp'

/** Recette et compteurs : uniquement commandes validées. */
export function orderCountsTowardRevenue(o: Pick<OrderItem, 'status'>): boolean {
  return o.status === 'validated'
}

export function orderStatusLabelFr(status: string): string {
  if (status === 'validated') return 'Validée'
  if (status === 'cancelled') return 'Annulée'
  if (status === 'modified') return 'Modifiée'
  return status
}

/** Annulation : session ouverte, commande de cette session, validée, droits caissier/gérant. */
export function canRequestOrderCancel(input: {
  order: Pick<OrderItem, 'status' | 'cashSessionId' | 'userId'>
  cashSession: CashSessionDto | null
  currentUserId: number | null
  role: Role
}): boolean {
  const { order, cashSession, currentUserId, role } = input
  if (currentUserId == null || cashSession == null) return false
  if (order.status !== 'validated') return false
  const sid = order.cashSessionId
  if (sid == null || sid !== cashSession.id) return false
  if (role === 'gerant') return true
  if (role !== 'caissier') return false
  return cashSession.userId === currentUserId || order.userId === currentUserId
}
