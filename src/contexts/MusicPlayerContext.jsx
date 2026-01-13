import { createContext, useContext, useState, useRef, useEffect } from 'react'

const MusicPlayerContext = createContext(null)

export function MusicPlayerProvider({ children }) {
    const audioRef = useRef(null)
    const [isPlaying, setIsPlaying] = useState(false)
    const [trackStatus, setTrackStatus] = useState('Loading tracks...')
    const [hasError, setHasError] = useState(false)
    const [tracks, setTracks] = useState([])
    const [currentTrackIndex, setCurrentTrackIndex] = useState(0)
    const [isLoading, setIsLoading] = useState(true)
    const hasPlayedRef = useRef(false)

    // Load tracks from music.json
    useEffect(() => {
        const loadTracks = async () => {
            try {
                const response = await fetch('/music.json')
                if (!response.ok) {
                    throw new Error('Failed to load music.json')
                }
                const data = await response.json()
                if (Array.isArray(data) && data.length > 0) {
                    setTracks(data)
                    // Select a random initial track
                    const randomIndex = Math.floor(Math.random() * data.length)
                    setCurrentTrackIndex(randomIndex)
                    setIsLoading(false)
                    setTrackStatus(`Featured Track: ${data[randomIndex].name}`)
                } else {
                    throw new Error('No tracks found in music.json')
                }
            } catch (error) {
                console.error('Error loading tracks:', error)
                setHasError(true)
                setTrackStatus("ERROR: Failed to load tracks.")
                setIsLoading(false)
            }
        }

        loadTracks()
    }, [])

    // Update audio source when track changes
    useEffect(() => {
        const audio = audioRef.current
        if (!audio || tracks.length === 0) return

        const currentTrack = tracks[currentTrackIndex]
        if (currentTrack && currentTrack.url) {
            const wasPlaying = !audio.paused && !audio.ended
            audio.src = currentTrack.url
            setTrackStatus(`Featured Track: ${currentTrack.name}`)
            setHasError(false)
            
            // If audio was playing, continue playing the new track
            if (wasPlaying) {
                audio.play().catch(error => {
                    console.error('Auto-play failed when changing tracks:', error)
                    setIsPlaying(false)
                })
            }
        }
    }, [currentTrackIndex, tracks])

    useEffect(() => {
        const audio = audioRef.current
        if (!audio) return

        const handlePlay = () => {
            setIsPlaying(true)
            hasPlayedRef.current = true
        }

        const handlePause = () => {
            setIsPlaying(false)
        }

        const handleCanPlayThrough = () => {
            const currentTrack = tracks[currentTrackIndex]
            if (currentTrack) {
                setTrackStatus(`Featured Track: ${currentTrack.name}`)
            }
        }

        const handleEnded = () => {
            // Auto-play next track
            if (tracks.length > 0) {
                const nextIndex = (currentTrackIndex + 1) % tracks.length
                setCurrentTrackIndex(nextIndex)
                // Audio will update via useEffect, but we need to play it
                setTimeout(() => {
                    if (audioRef.current) {
                        audioRef.current.play().catch(error => {
                            console.error('Auto-play failed:', error)
                        })
                    }
                }, 100)
            }
        }

        const handleError = (e) => {
            console.error('Audio Error:', e)
            setTrackStatus("ERROR: Failed to load track.")
            setHasError(true)
        }

        audio.addEventListener('play', handlePlay)
        audio.addEventListener('pause', handlePause)
        audio.addEventListener('canplaythrough', handleCanPlayThrough)
        audio.addEventListener('ended', handleEnded)
        audio.addEventListener('error', handleError)

        return () => {
            audio.removeEventListener('play', handlePlay)
            audio.removeEventListener('pause', handlePause)
            audio.removeEventListener('canplaythrough', handleCanPlayThrough)
            audio.removeEventListener('ended', handleEnded)
            audio.removeEventListener('error', handleError)
        }
    }, [currentTrackIndex, tracks])

    // Google Analytics tracking helper
    const trackButtonClick = (buttonId, action, trackName) => {
        if (window.gtag) {
            window.gtag('event', 'button_click', {
                button_id: buttonId,
                action: action,
                track_name: trackName
            })
        }
    }

    const handlePlayPause = () => {
        const audio = audioRef.current
        if (!audio || hasError || tracks.length === 0) return

        const action = audio.paused || audio.ended ? 'play' : 'pause'
        trackButtonClick('playPauseButton', action, tracks[currentTrackIndex]?.name)

        if (audio.paused || audio.ended) {
            audio.play()
                .catch(error => {
                    console.error('Audio playback failed, possibly due to browser autoplay policy:', error)
                })
        } else {
            audio.pause()
        }
    }

    const handleNextTrack = () => {
        if (tracks.length > 0) {
            const nextIndex = (currentTrackIndex + 1) % tracks.length
            setCurrentTrackIndex(nextIndex)
            setHasError(false)
            hasPlayedRef.current = false
            trackButtonClick('nextTrackButton', 'next_track', tracks[nextIndex]?.name)
        }
    }

    const handlePreviousTrack = () => {
        if (tracks.length > 0) {
            const prevIndex = (currentTrackIndex - 1 + tracks.length) % tracks.length
            setCurrentTrackIndex(prevIndex)
            setHasError(false)
            hasPlayedRef.current = false
            trackButtonClick('previousTrackButton', 'previous_track', tracks[prevIndex]?.name)
        }
    }

    // Derive button text and status text from state
    const buttonText = hasError ? 'ERROR' : (isLoading ? 'LOADING...' : (isPlaying ? 'PAUSE TRACK' : 'PLAY TRACK'))
    
    // Derive display status from state
    const currentTrack = tracks[currentTrackIndex]
    const displayStatus = hasError 
        ? trackStatus 
        : isLoading
        ? 'Loading tracks...'
        : isPlaying 
        ? `NOW PLAYING: ${currentTrack?.name || 'Unknown'}`
        : hasPlayedRef.current 
        ? 'PAUSED'
        : trackStatus

    const value = {
        audioRef,
        isPlaying,
        trackStatus: displayStatus,
        hasError,
        tracks,
        currentTrackIndex,
        isLoading,
        hasPlayedRef,
        buttonText,
        handlePlayPause,
        handleNextTrack,
        handlePreviousTrack
    }

    return (
        <MusicPlayerContext.Provider value={value}>
            <audio ref={audioRef} preload="auto"></audio>
            {children}
        </MusicPlayerContext.Provider>
    )
}

export function useMusicPlayerContext() {
    const context = useContext(MusicPlayerContext)
    if (!context) {
        throw new Error('useMusicPlayerContext must be used within MusicPlayerProvider')
    }
    return context
}