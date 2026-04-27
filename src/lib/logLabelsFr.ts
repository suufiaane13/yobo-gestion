/** Libellés FR pour les journaux (`append_log` côté Rust). */

const TYPE_LABELS: Record<string, string> = {
  auth: 'Authentification',
  order: 'Commande',
  cash: 'Caisse',
  menu: 'Menu',
  user: 'Utilisateurs',
  profile: 'Profil',
  settings: 'Paramètres',
}

/** Clé composite `type/action` → libellé action en français. */
const ACTION_LABELS: Record<string, string> = {
  'auth/login_failed': 'Échec connexion (compte)',
  'auth/login_failed_pin': 'Échec connexion (PIN)',
  'auth/login_ok': 'Connexion réussie',
  'auth/logout': 'Déconnexion',
  'order/create': 'Nouvelle commande',
  'cash/session_open': 'Ouverture de caisse',
  'cash/session_close': 'Fermeture de caisse',
  'menu/add_category': 'Ajout catégorie',
  'menu/delete_category': 'Suppression catégorie',
  'menu/add_product': 'Ajout produit',
  'menu/set_product_active': 'Activation / désactivation produit',
  'menu/update_product': 'Modification produit',
  'menu/delete_product': 'Suppression produit',
  'user/create_caissier': 'Création caissier',
  'user/set_caissier_active': 'Activation / désactivation caissier',
  'user/reset_caissier_pin': 'Réinitialisation PIN caissier',
  'profile/change_pin': 'Changement de PIN',
  'profile/change_name': 'Changement de nom',
  'settings/ticket_shop': 'En-tête / téléphone tickets',
}

export function logTypeLabelFr(actionType: string): string {
  return TYPE_LABELS[actionType] ?? actionType
}

/** Extrait `active=true|false` depuis le champ `meta` des journaux (Rust : `id=… active=…`). */
function parseLogMetaActive(meta: string | null | undefined): boolean | null {
  if (meta == null || !meta.trim()) return null
  const m = meta.match(/active\s*=\s*(true|false)/i)
  if (!m) return null
  return m[1].toLowerCase() === 'true'
}

/**
 * Libellé action FR. Pour certaines actions, `meta` permet de distinguer activation vs désactivation.
 */
export function logActionLabelFr(actionType: string, action: string, meta?: string | null): string {
  const key = `${actionType}/${action}`
  const fallback = ACTION_LABELS[key] ?? action.replace(/_/g, ' ')

  if (key === 'user/set_caissier_active') {
    const on = parseLogMetaActive(meta)
    if (on === true) return 'Activation caissier'
    if (on === false) return 'Désactivation caissier'
    return fallback
  }

  if (key === 'menu/set_product_active') {
    const on = parseLogMetaActive(meta)
    if (on === true) return 'Activation produit'
    if (on === false) return 'Désactivation produit'
    return fallback
  }

  return fallback
}

/** Liste des types connus (référence code / tests). */
export const LOG_TYPES_REFERENCE_FR: { code: string; label: string }[] = Object.entries(TYPE_LABELS).map(
  ([code, label]) => ({ code, label }),
)

const KNOWN_LOG_TYPES = new Set(Object.keys(TYPE_LABELS))

/** Classes CSS pour pastille colorée par catégorie (voir `.yobo-log-cat` dans `index.css`). */
export function logCategoryBadgeClass(actionType: string): string {
  const key = KNOWN_LOG_TYPES.has(actionType) ? actionType : 'unknown'
  return `yobo-log-cat yobo-log-cat--${key}`
}
