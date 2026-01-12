import { describe, it, expect, vi } from 'vitest'
import { handleImageError } from '../imageUtils'

describe('imageUtils', () => {
  describe('handleImageError', () => {
    it('sets fallback image on error', () => {
      const mockEvent = {
        target: {
          onerror: null,
          src: 'original.jpg'
        }
      }
      const fallbackUrl = 'fallback.jpg'

      handleImageError(mockEvent, fallbackUrl)

      expect(mockEvent.target.onerror).toBeNull()
      expect(mockEvent.target.src).toBe(fallbackUrl)
    })

    it('handles multiple error calls', () => {
      const mockEvent = {
        target: {
          onerror: vi.fn(),
          src: 'original.jpg'
        }
      }
      const fallbackUrl = 'fallback.jpg'

      handleImageError(mockEvent, fallbackUrl)
      handleImageError(mockEvent, fallbackUrl)

      expect(mockEvent.target.src).toBe(fallbackUrl)
      expect(mockEvent.target.onerror).toBeNull()
    })
  })
})
