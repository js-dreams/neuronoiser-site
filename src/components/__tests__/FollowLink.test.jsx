import { render } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import FollowLink from '../FollowLink'

describe('FollowLink', () => {
  it('links to the X account', () => {
    const { getByRole } = render(<FollowLink />)
    const link = getByRole('link')
    expect(link).toHaveAttribute('href', 'https://x.com/neuronoiser')
  })

  it('opens in a new tab without leaking the referrer window', () => {
    const { getByRole } = render(<FollowLink />)
    const link = getByRole('link')
    expect(link).toHaveAttribute('target', '_blank')
    expect(link).toHaveAttribute('rel', expect.stringContaining('noopener'))
  })

  it('spells out the handle rather than showing a bare glyph', () => {
    // The brief was "much more visible than the mail contact" — an unlabelled
    // icon is the thing Danny's design notes call out as understated-to-the-
    // point-of-invisible.
    const { getByText } = render(<FollowLink />)
    expect(getByText(/@neuronoiser/)).toBeInTheDocument()
    expect(getByText(/Follow/)).toBeInTheDocument()
  })

  it('is reachable by assistive tech', () => {
    const { getByLabelText } = render(<FollowLink />)
    expect(getByLabelText(/Follow neuronoiser on X/i)).toBeInTheDocument()
  })
})
