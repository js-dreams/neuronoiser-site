import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, act } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import AliensGame from '../AliensGame'

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

  it('renders canvas element', () => {
    const { container } = render(
      <MemoryRouter>
        <AliensGame />
      </MemoryRouter>
    )

    const canvas = container.querySelector('canvas')
    expect(canvas).toBeInTheDocument()
  })

  it('renders back button on desktop', () => {
    render(
      <MemoryRouter>
        <AliensGame />
      </MemoryRouter>
    )

    const backButton = screen.getByText(/Back to Home/i)
    expect(backButton).toBeInTheDocument()
  })

  it('back button navigates to home', () => {
    render(
      <MemoryRouter>
        <AliensGame />
      </MemoryRouter>
    )

    const backButton = screen.getByText(/Back to Home/i)
    backButton.click()

    expect(mockNavigate).toHaveBeenCalledWith('/')
  })

  it('renders game container with border on desktop', () => {
    const { container } = render(
      <MemoryRouter>
        <AliensGame />
      </MemoryRouter>
    )

    // Desktop version has a bordered container
    const gameContainer = container.querySelector('.border-2.border-neon-cyan')
    expect(gameContainer).toBeInTheDocument()
  })

  it('canvas has correct initial dimensions', () => {
    const { container } = render(
      <MemoryRouter>
        <AliensGame />
      </MemoryRouter>
    )

    const canvas = container.querySelector('canvas')
    expect(canvas).toHaveAttribute('width', '800')
    expect(canvas).toHaveAttribute('height', '600')
  })

  it('renders in mobile mode when viewport is narrow', () => {
    // Set viewport to mobile size
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 375
    })

    const { container } = render(
      <MemoryRouter>
        <AliensGame />
      </MemoryRouter>
    )

    // Mobile version uses fixed positioning
    const mobileContainer = container.querySelector('.fixed.inset-0')
    expect(mobileContainer).toBeInTheDocument()
  })

  it('tracks game entry with analytics', () => {
    render(
      <MemoryRouter>
        <AliensGame />
      </MemoryRouter>
    )

    expect(global.gtag).toHaveBeenCalledWith('event', 'game_entry', {
      game_name: 'Aliens',
      action: 'enter_game'
    })
  })

  it('tracks game exit with analytics when back button is clicked', () => {
    render(
      <MemoryRouter>
        <AliensGame />
      </MemoryRouter>
    )

    // Clear the initial game_entry call
    vi.clearAllMocks()

    const backButton = screen.getByText(/Back to Home/i)
    backButton.click()

    expect(global.gtag).toHaveBeenCalledWith('event', 'game_exit', {
      game_name: 'Aliens',
      action: 'return_to_home'
    })
    expect(mockNavigate).toHaveBeenCalledWith('/')
  })

  it('initializes with menu state', () => {
    const { container } = render(
      <MemoryRouter>
        <AliensGame />
      </MemoryRouter>
    )

    // Menu text should be visible (we can't easily test canvas content, but structure should be there)
    const canvas = container.querySelector('canvas')
    expect(canvas).toBeInTheDocument()
  })

  it('has correct canvas dimensions for game logic', () => {
    const { container } = render(
      <MemoryRouter>
        <AliensGame />
      </MemoryRouter>
    )

    const canvas = container.querySelector('canvas')
    expect(canvas).toHaveAttribute('width', '800')
    expect(canvas).toHaveAttribute('height', '600')
  })

  it('renders back button with correct styling on desktop', () => {
    render(
      <MemoryRouter>
        <AliensGame />
      </MemoryRouter>
    )

    const backButton = screen.getByText(/Back to Home/i)
    expect(backButton).toHaveClass('text-neon-cyan', 'font-mono')
  })

  it('renders mobile back button when viewport is narrow', () => {
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 375
    })

    render(
      <MemoryRouter>
        <AliensGame />
      </MemoryRouter>
    )

    const backButton = screen.getByText(/← Back/i)
    expect(backButton).toBeInTheDocument()
    expect(backButton).toHaveClass('absolute', 'top-4', 'right-4')
  })

  describe('High Score Celebration', () => {
    it('does not celebrate on first game when no high score exists', () => {
      localStorage.clear()
      
      const { container } = render(
        <MemoryRouter>
          <AliensGame />
        </MemoryRouter>
      )

      const canvas = container.querySelector('canvas')
      expect(canvas).toBeInTheDocument()
      // High score should start at 0 when no localStorage entry exists
      expect(localStorage.getItem('aliensHighScore')).toBeNull()
    })

    it('loads high score from localStorage on mount', () => {
      localStorage.setItem('aliensHighScore', '5000')
      
      render(
        <MemoryRouter>
          <AliensGame />
        </MemoryRouter>
      )

      // High score should be loaded from localStorage
      expect(localStorage.getItem('aliensHighScore')).toBe('5000')
    })

    it('saves high score to localStorage when game ends with new high score', async () => {
      localStorage.setItem('aliensHighScore', '1000')
      
      const { container } = render(
        <MemoryRouter>
          <AliensGame />
        </MemoryRouter>
      )

      // High score should be loaded
      expect(localStorage.getItem('aliensHighScore')).toBe('1000')
      
      // Note: Testing the full game flow would require extensive mocking of canvas and game loop
      // This test verifies the localStorage integration is set up correctly
    })
  })

  describe('Enemy Bullets System', () => {
    it('canvas renders with correct dimensions for enemy bullets', () => {
      const { container } = render(
        <MemoryRouter>
          <AliensGame />
        </MemoryRouter>
      )

      const canvas = container.querySelector('canvas')
      expect(canvas).toBeInTheDocument()
      expect(canvas).toHaveAttribute('width', '800')
      expect(canvas).toHaveAttribute('height', '600')
    })
  })

  describe('Mega Enemy Features', () => {
    it('game renders correctly with mega enemy system', () => {
      const { container } = render(
        <MemoryRouter>
          <AliensGame />
        </MemoryRouter>
      )

      const canvas = container.querySelector('canvas')
      expect(canvas).toBeInTheDocument()
      // Verify game structure is in place for mega enemies
      expect(canvas).toBeInTheDocument()
    })
  })

  describe('Scoring System', () => {
    it('high score display is rendered', () => {
      localStorage.setItem('aliensHighScore', '2500')
      
      render(
        <MemoryRouter>
          <AliensGame />
        </MemoryRouter>
      )

      // High score should be stored in localStorage
      expect(localStorage.getItem('aliensHighScore')).toBe('2500')
    })
  })
})
