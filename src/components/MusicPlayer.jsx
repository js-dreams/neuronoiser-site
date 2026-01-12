import { useState, useRef, useEffect } from 'react'
import AnimatedSection from './AnimatedSection'

const VISUALIZER_DELAYS = ['0s', '0.15s', '0.3s', '0.45s']

function MusicPlayer() {
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


    return (
        <section id="music-player" className="bg-dark-gray p-2 rounded-xl shadow-lg border border-neon-cyan/30 flex flex-col md:flex-row items-center justify-between space-y-4 md:space-y-0 md:space-x-8 overflow-hidden">
            <audio ref={audioRef} preload="auto"></audio>
            
            <div className="flex items-center space-x-4 flex-1 min-w-0 overflow-hidden">
                <div 
                    id="statusIcon" 
                    className={`status-indicator flex-shrink-0 ${hasError ? 'bg-red-600' : (isPlaying ? 'animate-pulse-neon playing' : '')}`}
                ></div>
                <div className="text-xs md:text-lg font-mono tracking-wider flex-1 min-w-0">
                    <span id="trackStatus" className="break-words">
                        {displayStatus}
                    </span>
                </div>
                {isPlaying && (
                    <div id="visualizer" className="flex h-6 space-x-0.5 items-end ml-4">
                        {VISUALIZER_DELAYS.map((delay, index) => (
                            <div 
                                key={index}
                                className="visualizer-bar w-1 h-full bg-neon-cyan/80 rounded-full" 
                                style={{animationDelay: delay}}
                            />
                        ))}
                    </div>
                )}
            </div>

            <div className="flex items-center space-x-2">
                {tracks.length > 1 && (
                    <>
                        <AnimatedSection delay={300} animationType="animate-slide-in-left">
                            <button
                                onClick={handlePreviousTrack}
                                disabled={hasError || isLoading}
                                className="h-7 w-7 rounded-full font-bold transition duration-300 shadow-md shadow-neon-cyan/30 bg-neon-cyan text-deep-indigo hover:bg-white hover:shadow-neon-cyan/70 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center text-sm leading-none"
                                aria-label="Previous track"
                                title="Previous track"
                            >
                                ◀
                            </button>
                        </AnimatedSection>
                        <AnimatedSection delay={350} animationType="animate-slide-in-right">
                            <button
                                onClick={handleNextTrack}
                                disabled={hasError || isLoading}
                                className="h-7 w-7 rounded-full font-bold transition duration-300 shadow-md shadow-neon-cyan/30 bg-neon-cyan text-deep-indigo hover:bg-white hover:shadow-neon-cyan/70 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center text-sm leading-none"
                                aria-label="Next track"
                                title="Next track"
                            >
                                ▶
                            </button>
                        </AnimatedSection>
                    </>
                )}
                <AnimatedSection delay={400} animationType="animate-slide-in-top">
                    <button 
                        id="playPauseButton"
                        onClick={handlePlayPause}
                        disabled={hasError || isLoading}
                        className="h-6 text-sm w-full md:w-auto px-6 py-0 rounded-full font-bold transition duration-300 shadow-md shadow-neon-cyan/30 bg-neon-cyan text-deep-indigo hover:bg-white hover:shadow-neon-cyan/70 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {buttonText}
                    </button>
                </AnimatedSection>
            </div>
        </section>
    )
}

export default MusicPlayer
