import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import Footer from '../Footer'

describe('Footer', () => {
  it('renders copyright text', () => {
    const { getByText } = render(<Footer />)
    expect(getByText(/2026 neuronoiser/i)).toBeInTheDocument()
  })

  it('renders contact link', () => {
    const { getByText } = render(<Footer />)
    const contactLink = getByText(/Contact \/ Press Inquiries/i)
    expect(contactLink).toBeInTheDocument()
    expect(contactLink.closest('a')).toHaveAttribute('href', 'mailto:danny@neuronoiser.com')
  })

  it('matches snapshot', () => {
    const { container } = render(<Footer />)
    expect(container).toMatchSnapshot()
  })
})
