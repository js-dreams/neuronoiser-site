import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import Footer from '../Footer'

describe('Footer', () => {
  it('renders copyright text', () => {
    const { getByText } = render(
      <MemoryRouter>
        <Footer />
      </MemoryRouter>
    )
    expect(getByText(/2026 neuronoiser/i)).toBeInTheDocument()
  })

  it('renders contact link', () => {
    const { getByText } = render(
      <MemoryRouter>
        <Footer />
      </MemoryRouter>
    )
    const contactLink = getByText(/Contact \/ Press Inquiries/i)
    expect(contactLink).toBeInTheDocument()
    expect(contactLink.closest('a')).toHaveAttribute('href', 'mailto:danny@neuronoiser.com')
  })

  it('matches snapshot', () => {
    const { container } = render(
      <MemoryRouter>
        <Footer />
      </MemoryRouter>
    )
    expect(container).toMatchSnapshot()
  })
})
