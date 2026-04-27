import { describe, expect, it } from 'vitest'
import {
  clampPage,
  getTotalPages,
  getVisiblePageItems,
  paginateSlice,
  paginationRangeLabel,
} from './pagination'

describe('getTotalPages', () => {
  it('minimum 1 page', () => {
    expect(getTotalPages(0, 10)).toBe(1)
    expect(getTotalPages(5, 10)).toBe(1)
    expect(getTotalPages(10, 10)).toBe(1)
  })

  it('compte les pages', () => {
    expect(getTotalPages(11, 10)).toBe(2)
    expect(getTotalPages(20, 8)).toBe(3)
  })
})

describe('paginateSlice', () => {
  const items = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]

  it('page 1 et taille 3', () => {
    expect(paginateSlice(items, 1, 3)).toEqual([1, 2, 3])
  })

  it('borne la page au total', () => {
    expect(paginateSlice(items, 99, 3)).toEqual([10])
  })
})

describe('clampPage', () => {
  it('borne entre 1 et total', () => {
    expect(clampPage(0, 5)).toBe(1)
    expect(clampPage(3, 5)).toBe(3)
    expect(clampPage(10, 5)).toBe(5)
  })
})

describe('paginationRangeLabel', () => {
  it('vide', () => {
    expect(paginationRangeLabel(1, 10, 0)).toEqual({ from: 0, to: 0, total: 0 })
  })

  it('première page', () => {
    expect(paginationRangeLabel(1, 5, 12)).toEqual({ from: 1, to: 5, total: 12 })
  })
})

describe('getVisiblePageItems', () => {
  it('liste courte sans gap', () => {
    expect(getVisiblePageItems(2, 5)).toEqual([1, 2, 3, 4, 5])
  })

  it('longue liste avec ellipses', () => {
    const v = getVisiblePageItems(6, 12)
    expect(v).toContain('gap')
    expect(v).toContain(1)
    expect(v).toContain(12)
  })
})
