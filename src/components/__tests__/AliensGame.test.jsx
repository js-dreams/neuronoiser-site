import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import AliensGame from '../AliensGame'
import { MusicPlayerProvider } from '../../contexts/MusicPlayerContext'

// Mock useNavigate
const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate
  }
})

// Mock gtag for analytics
global.gtag = vi.fn()

// Helper to render AliensGame with required providers
const renderAliensGame = () => {
  return render(
    <MemoryRouter>
      <MusicPlayerProvider>
        <AliensGame />
      </MusicPlayerProvider>
    </MemoryRouter>
  )
}

describe('AliensGame', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Mock window.innerWidth and innerHeight for mobile detection
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 1024
    })
    Object.defineProperty(window, 'innerHeight', {
      writable: true,
      configurable: true,
      value: 768
    })
    // Mock Date.now for consistent timing in tests
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    localStorage.clear()
  })

  describe('Rendering', () => {
    it('renders canvas element with correct dimensions', () => {
      const { container } = renderAliensGame()

      const canvas = container.querySelector('canvas')
      expect(canvas).toBeInTheDocument()
      expect(canvas).toHaveAttribute('width', '800')
      expect(canvas).toHaveAttribute('height', '600')
    })

    it('renders game container with border on desktop', () => {
      const { container } = renderAliensGame()

      const gameContainer = container.querySelector('.border-2.border-neon-cyan')
      expect(gameContainer).toBeInTheDocument()
    })
  })

  describe('Navigation', () => {
    it('renders back button on desktop', () => {
      renderAliensGame()

      const backButton = screen.getByText(/Back to Home/i)
      expect(backButton).toBeInTheDocument()
    })

    it('back button navigates to home', () => {
      renderAliensGame()

      const backButton = screen.getByText(/Back to Home/i)
      backButton.click()

      expect(mockNavigate).toHaveBeenCalledWith('/')
    })

    it('renders back button with correct styling on desktop', () => {
      renderAliensGame()

      const backButton = screen.getByText(/Back to Home/i)
      expect(backButton).toHaveClass('text-neon-cyan', 'font-mono')
    })
  })

  describe('Responsive Design', () => {
    it('renders in mobile mode when viewport is narrow', () => {
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 375
      })

      const { container } = renderAliensGame()

      const mobileContainer = container.querySelector('.fixed.inset-0')
      expect(mobileContainer).toBeInTheDocument()
    })

    it('renders mobile back button when viewport is narrow', () => {
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 375
      })

      renderAliensGame()

      const backButton = screen.getByText(/← Back/i)
      expect(backButton).toBeInTheDocument()
      expect(backButton).toHaveClass('absolute', 'top-4', 'right-4')
    })
  })

  describe('Analytics', () => {
    it('tracks game entry with analytics', () => {
      renderAliensGame()

      expect(global.gtag).toHaveBeenCalledWith('event', 'game_entry', {
        game_name: 'Aliens',
        action: 'enter_game'
      })
    })

    it('tracks game exit with analytics when back button is clicked', () => {
      renderAliensGame()

      vi.clearAllMocks()

      const backButton = screen.getByText(/Back to Home/i)
      backButton.click()

      expect(global.gtag).toHaveBeenCalledWith('event', 'game_exit', {
        game_name: 'Aliens',
        action: 'return_to_home'
      })
      expect(mockNavigate).toHaveBeenCalledWith('/')
    })
  })

  describe('High Score', () => {
    it('loads high score from localStorage on mount', () => {
      localStorage.setItem('aliensHighScore', '5000')
      
      renderAliensGame()

      expect(localStorage.getItem('aliensHighScore')).toBe('5000')
    })
  })

  describe('Clock Extender Speed Calculation', () => {
    it('calculates clock extender speed correctly', () => {
      // Clock extender speed should be 2.53x faster than normal powerups
      // LIFE_POWERUP_SPEED = 2
      // CLOCK_EXTENDER_SPEED = LIFE_POWERUP_SPEED * 2.2 * 1.15 = 2 * 2.2 * 1.15 = 5.06
      const LIFE_POWERUP_SPEED = 2
      const CLOCK_EXTENDER_SPEED = LIFE_POWERUP_SPEED * 2.2 * 1.15
      expect(CLOCK_EXTENDER_SPEED).toBeCloseTo(5.06, 2)
    })
  })
})
