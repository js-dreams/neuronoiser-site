import { describe, it, expect } from 'vitest'

// Test the difficulty scaling formulas
// These match the logic in AliensGame.jsx

describe('Game Difficulty Calculations', () => {
  const getEnemySpeed = (currentLevel) => {
    // Level 1: 2, Level 10: 5 (easy to very hard)
    return 2 + (currentLevel - 1) * (3 / 9)
  }

  const getEnemySpawnRate = (currentLevel) => {
    // Level 1: 60 frames, Level 10: 20 frames (slower to faster spawning)
    return Math.max(20, 60 - (currentLevel - 1) * (40 / 9))
  }

  describe('getEnemySpeed', () => {
    it('returns speed 2 for level 1', () => {
      expect(getEnemySpeed(1)).toBe(2)
    })

    it('returns speed 5 for level 10', () => {
      expect(getEnemySpeed(10)).toBe(5)
    })

    it('increases speed as level increases', () => {
      const speed1 = getEnemySpeed(1)
      const speed5 = getEnemySpeed(5)
      const speed10 = getEnemySpeed(10)
      
      expect(speed5).toBeGreaterThan(speed1)
      expect(speed10).toBeGreaterThan(speed5)
    })

    it('scales linearly between levels', () => {
      const speed1 = getEnemySpeed(1)
      const speed2 = getEnemySpeed(2)
      const speed3 = getEnemySpeed(3)
      
      // Each level should increase by approximately 3/9 = 0.333...
      expect(speed2 - speed1).toBeCloseTo(3 / 9, 5)
      expect(speed3 - speed2).toBeCloseTo(3 / 9, 5)
    })
  })

  describe('getEnemySpawnRate', () => {
    it('returns 60 frames for level 1', () => {
      expect(getEnemySpawnRate(1)).toBe(60)
    })

    it('returns 20 frames for level 10', () => {
      expect(getEnemySpawnRate(10)).toBe(20)
    })

    it('decreases spawn rate (faster spawning) as level increases', () => {
      const rate1 = getEnemySpawnRate(1)
      const rate5 = getEnemySpawnRate(5)
      const rate10 = getEnemySpawnRate(10)
      
      expect(rate5).toBeLessThan(rate1)
      expect(rate10).toBeLessThan(rate5)
    })

    it('never goes below 20 frames', () => {
      for (let level = 1; level <= 10; level++) {
        expect(getEnemySpawnRate(level)).toBeGreaterThanOrEqual(20)
      }
    })
  })
})
