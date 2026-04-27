/**
 * Catalogue centralisé YOBO — snack / POS / gestion.
 * Étendre `YOBO_EMOJI_GROUPS` pour de nouveaux métiers ou produits.
 */
export type YoboEmojiItem = {
  /** Glyphe Unicode affiché */
  char: string
  /** Mots-clés pour la recherche (minuscules, sans accent optionnel côté filtre) */
  tags: string[]
}

export type YoboEmojiGroup = {
  id: string
  label: string
  items: YoboEmojiItem[]
}

export const DEFAULT_PRODUCT_EMOJI = '🍽️'
export const DEFAULT_CATEGORY_EMOJI = '📦'

export const YOBO_EMOJI_GROUPS: YoboEmojiGroup[] = [
  {
    id: 'pizza-pasta',
    label: 'Pizza & pâtes',
    items: [
      { char: '🍕', tags: ['pizza', 'italien', 'fromage'] },
      { char: '🍝', tags: ['pates', 'spaghetti', 'italien'] },
      { char: '🥫', tags: ['sauce', 'tomate', 'conserve'] },
      { char: '🧀', tags: ['fromage', 'cheddar', 'garniture'] },
    ],
  },
  {
    id: 'burger-sandwich',
    label: 'Burgers & sandwichs',
    items: [
      { char: '🍔', tags: ['burger', 'hamburger', 'viande'] },
      { char: '🍟', tags: ['frites', 'accompagnement', 'potatoes'] },
      { char: '🌭', tags: ['hot dog', 'saucisse'] },
      { char: '🥪', tags: ['sandwich', 'panini', 'club'] },
      { char: '🌯', tags: ['wrap', 'burrito', 'tex mex'] },
      { char: '🥙', tags: ['kebab', 'falafel', 'pita'] },
    ],
  },
  {
    id: 'snack-salade',
    label: 'Snacks & salades',
    items: [
      { char: '🥗', tags: ['salade', 'healthy', 'vert'] },
      { char: '🥨', tags: ['bretzel', 'snack'] },
      { char: '🥯', tags: ['bagel', 'pain'] },
      { char: '🧇', tags: ['gaufre', 'sweet'] },
      { char: '🥞', tags: ['crepe', 'pancake', 'petit dejeuner'] },
      { char: '🧈', tags: ['beurre', 'garniture'] },
    ],
  },
  {
    id: 'boissons-froides',
    label: 'Boissons froides',
    items: [
      { char: '🥤', tags: ['soda', 'gobelet', 'soft'] },
      { char: '🧃', tags: ['jus', 'brique', 'enfant'] },
      { char: '🧊', tags: ['glacons', 'frais'] },
      { char: '🥛', tags: ['lait', 'shake'] },
      { char: '🍹', tags: ['cocktail', 'exotique'] },
      { char: '🍺', tags: ['biere', 'pression'] },
      { char: '🍻', tags: ['biere', 'toast'] },
      { char: '🥂', tags: ['champagne', 'bulles'] },
      { char: '🍷', tags: ['vin', 'rouge'] },
      { char: '🧉', tags: ['mate', 'infusion'] },
    ],
  },
  {
    id: 'cafe-the',
    label: 'Café & thé',
    items: [
      { char: '☕', tags: ['cafe', 'espresso', 'chaud'] },
      { char: '🍵', tags: ['the', 'vert', 'matcha'] },
    ],
  },
  {
    id: 'desserts',
    label: 'Desserts & sucré',
    items: [
      { char: '🍰', tags: ['gateau', 'part', 'patisserie'] },
      { char: '🧁', tags: ['cupcake', 'muffin'] },
      { char: '🍩', tags: ['donut', 'beignet'] },
      { char: '🍪', tags: ['cookie', 'biscuit'] },
      { char: '🍫', tags: ['chocolat', 'barre'] },
      { char: '🍬', tags: ['bonbon', 'sucrerie'] },
      { char: '🍭', tags: ['sucette'] },
      { char: '🍦', tags: ['glace', 'cornet', 'italienne'] },
      { char: '🍨', tags: ['glace', 'coupe'] },
      { char: '🎂', tags: ['anniversaire', 'gateau'] },
      { char: '🥧', tags: ['tarte', 'pie'] },
    ],
  },
  {
    id: 'fruits',
    label: 'Fruits',
    items: [
      { char: '🍎', tags: ['pomme', 'fruit'] },
      { char: '🍊', tags: ['orange', 'agrumes'] },
      { char: '🍋', tags: ['citron', 'citrus'] },
      { char: '🍌', tags: ['banane'] },
      { char: '🍇', tags: ['raisin'] },
      { char: '🍓', tags: ['fraise', 'rouge'] },
      { char: '🥝', tags: ['kiwi'] },
      { char: '🍑', tags: ['peche'] },
    ],
  },
  {
    id: 'viande-poisson',
    label: 'Viande & poisson',
    items: [
      { char: '🍗', tags: ['poulet', 'cuisse', 'roti'] },
      { char: '🥩', tags: ['steak', 'viande', 'boeuf'] },
      { char: '🥓', tags: ['bacon', 'lard'] },
      { char: '🍖', tags: ['os', 'barbecue'] },
      { char: '🐟', tags: ['poisson', 'filet'] },
      { char: '🦐', tags: ['crevette', 'fruit de mer'] },
    ],
  },
  {
    id: 'asiatique',
    label: 'Asiatique & bol',
    items: [
      { char: '🍜', tags: ['ramen', 'nouilles', 'bol'] },
      { char: '🍱', tags: ['bento', 'japonais'] },
      { char: '🍣', tags: ['sushi', 'japonais'] },
      { char: '🥟', tags: ['ravioli', 'gyoza', 'dim sum'] },
      { char: '🥡', tags: ['emporter', 'chinois', 'boite'] },
    ],
  },
  {
    id: 'yobo-menu',
    label: 'Menu YOBO',
    items: [
      { char: '🥖', tags: ['pain maison', 'tex mex', 'marocain', 'yobo'] },
      { char: '🥟', tags: ['calzone', 'poulet', 'viande hachee', 'mixte'] },
      { char: '🌮', tags: ['tacos', 'gratine', 'xl', 'l'] },
      { char: '🥪', tags: ['panini', 'sandwich', 'sandwich chaud', 'sandwich hollandais'] },
      { char: '🍔', tags: ['american burger', 'chicken burger', 'chees burger', 'big burger', 'burger yobo'] },
      { char: '🍝', tags: ['pasticcio', 'pates'] },
      { char: '🦐', tags: ['fruits de mer'] },
      { char: '🍗', tags: ['poulet', 'cordon bleu'] },
      { char: '🥩', tags: ['viande hachee'] },
      { char: '🐟', tags: ['thon'] },
      { char: '🧀', tags: ['4 fromages', 'fromage supplementaire'] },
      { char: '🍟', tags: ['frites', 'supplement'] },
      { char: '🧒', tags: ['menu kids', 'enfant', 'kids yobo'] },
      { char: '🥤', tags: ['boissons', 'soda', 'pepsi', 'coca cola', 'sprite', 'fanta', 'mirinda'] },
      { char: '🪽', tags: ['nuggets'] },
      { char: '🧇', tags: ['crepe', 'sucre', 'nutella', 'oreo', 'lotus', 'kit kat', 'kunafa'] },
      { char: '🍓', tags: ['avec fruits', 'banane'] },
      { char: '💧', tags: ['eau'] },
      { char: '🥫', tags: ['sauce', 'sirop supplementaire'] },
      { char: '➕', tags: ['supplements', 'extra', 'ajout'] },
    ],
  },
  {
    id: 'ui-metier',
    label: 'Icônes métier',
    items: [
      { char: '🍽️', tags: ['assiette', 'couvert', 'menu', 'plat', 'defaut'] },
      { char: '📦', tags: ['carton', 'stock', 'categorie', 'colis'] },
      { char: '🏷️', tags: ['etiquette', 'prix', 'promo'] },
      { char: '⭐', tags: ['favori', 'vedette', 'etoile'] },
      { char: '🔥', tags: ['populaire', 'tendance', 'epice'] },
      { char: '✨', tags: ['nouveau', 'special'] },
      { char: '💰', tags: ['promo', 'prix', 'economie'] },
      { char: '🕐', tags: ['horaire', 'service'] },
      { char: '📋', tags: ['liste', 'commande'] },
      { char: '✅', tags: ['actif', 'valide'] },
      { char: '❌', tags: ['inactif', 'stop'] },
    ],
  },
]

/** Liste plate unique (ordre d’apparition des groupes) */
export function getAllYoboEmojiChars(): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const g of YOBO_EMOJI_GROUPS) {
    for (const { char } of g.items) {
      if (!seen.has(char)) {
        seen.add(char)
        out.push(char)
      }
    }
  }
  return out
}

const ALL_CHARS = getAllYoboEmojiChars()

/** Vérifie si le caractère fait partie du catalogue (utile pour migration / validation). */
export function isCatalogEmoji(char: string): boolean {
  const t = char.trim()
  return ALL_CHARS.includes(t)
}

/**
 * Si la valeur n’est pas dans le catalogue, on la garde quand même (données existantes).
 * Le picker affichera quand même la valeur courante.
 */
export function normalizePickerValue(value: string, fallback: string): string {
  const t = value.trim()
  return t.length > 0 ? t : fallback
}
