/** Clés de catégories pour le menu statique (fallback si pas de catalogue API). */
export type MenuFallbackCategory =
  | 'pain_maison'
  | 'calzone'
  | 'tacos'
  | 'panini'
  | 'burger'
  | 'pasticcio'
  | 'sandwichs'
  | 'menus_kids'
  | 'pizza'
  | 'pates'
  | 'risotto'
  | 'entrees'
  | 'plats'
  | 'crepes'
  | 'boissons'
  | 'jus_mojito'
  | 'supplements'

/** Libellé court pour ticket (sans emoji) quand le catalogue SQLite n’est pas chargé. */
export const MENU_FALLBACK_CATEGORY_TITLE: Record<MenuFallbackCategory, string> = {
  pain_maison: 'PAIN MAISON',
  calzone: 'CALZONE',
  tacos: 'TACOS',
  panini: 'PANINI',
  burger: 'BURGER',
  pasticcio: 'PASTICCIO',
  sandwichs: 'SANDWICH',
  menus_kids: 'MENU KIDS',
  pizza: 'PIZZA',
  pates: 'PATES',
  risotto: 'RISOTTO',
  entrees: 'ENTREES',
  plats: 'PLATS',
  crepes: 'CREPES',
  boissons: 'BOISSONS',
  jus_mojito: 'JUS & MOJITO',
  supplements: 'SUPPLÉMENT',
}

export type MenuFallbackItem = {
  id?: number
  emoji: string
  name: string
  sizes: Record<string, number>
  position?: number
  active?: boolean
}

export const MENU_ITEMS: Record<MenuFallbackCategory, MenuFallbackItem[]> = {
  pain_maison: [
    { emoji: '🍗', name: 'Poulet Tex-Mex', sizes: { S: 35 } },
    { emoji: '🥙', name: 'Marocain', sizes: { S: 37 } },
    { emoji: '🦐', name: 'Fruits de Mer', sizes: { S: 40 } },
    { emoji: '🥖', name: 'Yobo', sizes: { S: 42 } },
  ],
  calzone: [
    { emoji: '🍗', name: 'Poulet', sizes: { S: 35 } },
    { emoji: '🥩', name: 'Viande Hachée', sizes: { S: 40 } },
    { emoji: '🥟', name: 'Mixte', sizes: { S: 40 } },
    { emoji: '🦐', name: 'Fruits de Mer', sizes: { S: 45 } },
  ],
  tacos: [
    { emoji: '🍗', name: 'Poulet', sizes: { L: 30, XL: 45 } },
    { emoji: '🍖', name: 'Dinde', sizes: { L: 30, XL: 45 } },
    { emoji: '🍗', name: 'Nuggets', sizes: { L: 35, XL: 50 } },
    { emoji: '🌮', name: 'Mixte', sizes: { L: 35, XL: 50 } },
    { emoji: '🧀', name: 'Cordon Bleu', sizes: { L: 35, XL: 50 } },
    { emoji: '🥩', name: 'Viande Hachée', sizes: { L: 35, XL: 50 } },
    { emoji: '🦐', name: 'Fruits de Mer', sizes: { L: 40, XL: 55 } },
  ],
  panini: [
    { emoji: '🍗', name: 'Poulet', sizes: { S: 25 } },
    { emoji: '🍖', name: 'Dinde', sizes: { S: 25 } },
    { emoji: '🐟', name: 'Thon', sizes: { S: 25 } },
    { emoji: '🥪', name: 'Mixte', sizes: { S: 25 } },
    { emoji: '🥩', name: 'Viande Hachée', sizes: { S: 27 } },
    { emoji: '🧀', name: '4 Fromages', sizes: { S: 27 } },
    { emoji: '🦐', name: 'Fruits de Mer', sizes: { S: 30 } },
  ],
  burger: [
    { emoji: '🍔', name: 'American Burger', sizes: { S: 30 } },
    { emoji: '🍔', name: 'Chicken Burger', sizes: { S: 30 } },
    { emoji: '🍔', name: 'Chees Burger', sizes: { S: 30 } },
    { emoji: '🍔', name: 'Big Burger', sizes: { S: 37 } },
    { emoji: '🍔', name: 'Burger Yobo', sizes: { S: 40 } },
  ],
  pasticcio: [
    { emoji: '🍗', name: 'Poulet', sizes: { S: 30 } },
    { emoji: '🍖', name: 'Dinde', sizes: { S: 30 } },
    { emoji: '🦐', name: 'Fruits de Mer', sizes: { S: 45 } },
    { emoji: '🍗', name: 'Nuggets', sizes: { S: 35 } },
    { emoji: '🍝', name: 'Mixte', sizes: { S: 35 } },
    { emoji: '🧀', name: 'Cordon Bleu', sizes: { S: 37 } },
    { emoji: '🥩', name: 'Viande Hachée', sizes: { S: 35 } },
  ],
  sandwichs: [
    { emoji: '🥖', name: 'Simple', sizes: { S: 12 } },
    { emoji: '🍓', name: 'Avec fruits', sizes: { S: 15 } },
    { emoji: '🍗', name: 'Poulet', sizes: { S: 20 } },
    { emoji: '🍖', name: 'Dinde', sizes: { S: 20 } },
    { emoji: '🥩', name: 'Viande Hachée', sizes: { S: 20 } },
    { emoji: '🥪', name: 'Mixte', sizes: { S: 30 } },
    { emoji: '🍗', name: 'Nuggets', sizes: { S: 30 } },
    { emoji: '🧀', name: 'Cordon Bleu', sizes: { S: 30 } },
    { emoji: '🦐', name: 'Fruits de Mer', sizes: { S: 40 } },
  ],
  menus_kids: [
    { emoji: '👶', name: 'Cheeseburger + Frites + Boisson', sizes: { S: 30 } },
    { emoji: '👶', name: '6 Nuggets + Frites + Boisson', sizes: { S: 30 } },
    { emoji: '👶', name: 'Sandwich Poulet Kids + Frites + Boisson', sizes: { S: 30 } },
  ],
  pizza: [
    { emoji: '🍕', name: 'Margherita', sizes: { S: 25 } },
    { emoji: '🍕', name: 'Viande Hachée', sizes: { S: 30, M: 45, L: 60 } },
    { emoji: '🍕', name: 'Poulet', sizes: { S: 30, M: 45, L: 60 } },
    { emoji: '🍕', name: 'Dinde', sizes: { S: 30, M: 45, L: 60 } },
    { emoji: '🍕', name: 'Dinde Fumée', sizes: { S: 35, M: 45, L: 60 } },
    { emoji: '🍕', name: 'Thon', sizes: { S: 30, M: 45, L: 60 } },
    { emoji: '🦐', name: 'Fruits de Mer', sizes: { S: 40, M: 55, L: 75 } },
    { emoji: '🥬', name: 'Végétarienne', sizes: { S: 40, M: 45, L: 60 } },
    { emoji: '🍕', name: '4 Saisons', sizes: { S: 30, M: 55, L: 75 } },
    { emoji: '🧀', name: '4 Fromages', sizes: { S: 35, M: 45, L: 65 } },
    { emoji: '🍕', name: 'Mixte', sizes: { S: 40, M: 50, L: 65 } },
    { emoji: '🌾', name: 'Fermière', sizes: { S: 40, M: 50, L: 65 } },
    { emoji: '🥖', name: 'Yobo', sizes: { S: 40, M: 50, L: 70 } },
  ],
  pates: [
    { emoji: '🍝', name: "All'arrabbiata", sizes: { S: 37 } },
    { emoji: '🥓', name: 'Carbonara', sizes: { S: 45 } },
    { emoji: '🐟', name: 'Thon', sizes: { S: 45 } },
    { emoji: '🧄', name: 'Alfredo', sizes: { S: 45 } },
    { emoji: '🍅', name: 'Bolognaise', sizes: { S: 48 } },
    { emoji: '🧀', name: '4 Fromages', sizes: { S: 48 } },
    { emoji: '🦐', name: 'Fruits de Mer', sizes: { S: 50 } },
    { emoji: '⭐', name: 'Trio Yobo', sizes: { S: 60 } },
  ],
  risotto: [
    { emoji: '🍚', name: 'Risotto Végétarien', sizes: { S: 42 } },
    { emoji: '🍗', name: 'Risotto Poulet Champignons', sizes: { S: 45 } },
    { emoji: '🦐', name: 'Risotto Fruits de Mer', sizes: { S: 55 } },
  ],
  entrees: [
    { emoji: '🥗', name: 'Salade César au poulet', sizes: { S: 37 } },
    { emoji: '🥗', name: 'Salade Marocaine', sizes: { S: 22 } },
    { emoji: '🍆', name: "Mille-feuille d'aubergine", sizes: { S: 30 } },
    { emoji: '🍄', name: 'Gratin poulet aux champignons', sizes: { S: 35 } },
    { emoji: '🦐', name: 'Gratin fruits de mer', sizes: { S: 40 } },
    { emoji: '🦐', name: 'Crevette pil pil', sizes: { S: 47 } },
    { emoji: '🍗', name: 'Plat nuggets 6 pièces + frites', sizes: { S: 30 } },
  ],
  plats: [
    { emoji: '🥩', name: 'Brochettes viande hachée grillées', sizes: { S: 50 } },
    { emoji: '🍗', name: 'Brochettes poulet à la coriandre', sizes: { S: 48 } },
    { emoji: '🍢', name: 'Brochettes mixtes', sizes: { S: 51 } },
    { emoji: '🍄', name: 'Émincé poulet aux champignons', sizes: { S: 50 } },
    { emoji: '🍗', name: 'Escalope Milanaise', sizes: { S: 49 } },
    { emoji: '🍳', name: 'Tajine viande hachée - œufs', sizes: { S: 37 } },
  ],
  crepes: [
    { emoji: '🧂', name: 'Sucre', sizes: { S: 15 } },
    { emoji: '🍫', name: 'Nutella', sizes: { S: 20 } },
    { emoji: '🧈', name: 'Lotus', sizes: { S: 23 } },
    { emoji: '🍪', name: 'Oreo', sizes: { S: 22 } },
    { emoji: '🍌', name: 'Banane', sizes: { S: 22 } },
    { emoji: '🍫', name: 'Kit Kat', sizes: { S: 22 } },
    { emoji: '🥞', name: 'Mixte', sizes: { S: 25 } },
    { emoji: '🌰', name: 'Kunafa Pistache', sizes: { S: 30 } },
    { emoji: '🥞', name: 'Yobo', sizes: { S: 35 } },
  ],
  boissons: [
    { emoji: '💧', name: 'Eau', sizes: { Petite: 2, Grande: 3 } },
    { emoji: '🥤', name: 'Coca Cola', sizes: { S: 5 } },
    { emoji: '🥤', name: 'Pepsi', sizes: { S: 5 } },
    { emoji: '🥤', name: 'Sprite', sizes: { S: 5 } },
    { emoji: '🥤', name: 'Fanta', sizes: { S: 5 } },
    { emoji: '🥤', name: 'Mirinda', sizes: { S: 7 } },
    { emoji: '🥤', name: 'Oasis', sizes: { S: 10 } },
    { emoji: '🥤', name: 'Rostoy', sizes: { S: 10 } },
    { emoji: '🥤', name: 'Simon', sizes: { S: 10 } },
    { emoji: '⚡', name: 'Red Bull', sizes: { S: 20 } },
    { emoji: '🥤', name: 'LINX', sizes: { S: 10 } },
    { emoji: '🥤', name: 'B52', sizes: { S: 10 } },
  ],
  jus_mojito: [
    { emoji: '🍊', name: "Jus d'orange", sizes: { S: 12 } },
    { emoji: '🥑', name: 'Jus avocat', sizes: { S: 18 } },
    { emoji: '🍌', name: 'Jus banane', sizes: { S: 12 } },
    { emoji: '🍋', name: 'Jus citron', sizes: { S: 12 } },
    { emoji: '🧃', name: 'Jus mix', sizes: { S: 16 } },
    { emoji: '🌿', name: 'Mojito classique', sizes: { S: 17 } },
    { emoji: '⚡', name: 'Mojito Red Bull', sizes: { S: 28 } },
  ],
  supplements: [
    { emoji: '🍟', name: 'Frites', sizes: { S: 5 } },
  ],
}
