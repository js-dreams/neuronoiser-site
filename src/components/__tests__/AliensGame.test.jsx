import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
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
})
