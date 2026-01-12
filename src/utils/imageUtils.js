/**
 * Handles image loading errors by setting a fallback image
 * @param {Event} e - The error event
 * @param {string} fallbackUrl - The URL to use as fallback
 */
export function handleImageError(e, fallbackUrl) {
    e.target.onerror = null
    e.target.src = fallbackUrl
}
