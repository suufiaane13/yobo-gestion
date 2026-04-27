export function isNonEmpty(s: string) {
  return s.trim().length > 0
}

export function capitalizeFirstLetter(s: string) {
  const t = s.trim()
  if (!t) return t
  return `${t.charAt(0).toUpperCase()}${t.slice(1)}`
}

export function firstLetterUpper(s: string) {
  const t = s.trim()
  if (!t) return ''
  return t.charAt(0).toUpperCase()
}
