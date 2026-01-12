import { useState, useEffect, useMemo } from 'react'

const ANIMATION_TYPES = [
    'animate-slide-in-left',
    'animate-slide-in-right',
    'animate-slide-in-top',
    'animate-slide-in-bottom',
    'animate-slide-in-top-left',
    'animate-slide-in-top-right',
    'animate-slide-in-bottom-left',
    'animate-slide-in-bottom-right',
]

function AnimatedSection({ children, delay = 0, animationType }) {
    const [isVisible, setIsVisible] = useState(false)

    // Memoize the random animation type so it doesn't change on re-renders
    const selectedAnimation = useMemo(() => {
        return animationType || ANIMATION_TYPES[Math.floor(Math.random() * ANIMATION_TYPES.length)]
    }, [animationType])

    useEffect(() => {
        // Trigger animation after delay
        const timer = setTimeout(() => {
            setIsVisible(true)
        }, delay)

        return () => clearTimeout(timer)
    }, [delay])

    return (
        <div 
            className={isVisible ? selectedAnimation : 'opacity-0'}
        >
            {children}
        </div>
    )
}

export default AnimatedSection
