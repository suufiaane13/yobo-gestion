export function normalizeCategoryKey(label: string) {
  const raw = label.trim().toLowerCase()
  if (raw.includes('pizza')) return 'pizza'
  if (raw.includes('tacos')) return 'tacos'
  if (raw.includes('burger')) return 'burger'
  if (raw.includes('panini')) return 'panini'
  if (raw.includes('crepe') || raw.includes('crêpe')) return 'crepe'
  if (raw.includes('boisson')) return 'boisson'
  if (raw.includes('dessert')) return 'dessert'
  return raw.replace(/\s+/g, '_')
}
