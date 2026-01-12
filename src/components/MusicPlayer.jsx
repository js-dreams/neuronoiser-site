import { useState, useRef, useEffect } from 'react'
import AnimatedSection from './AnimatedSection'

const TRACK_NAME = 'Interstellar Communication'
const VISUALIZER_DELAYS = ['0s', '0.15s', '0.3s', '0.45s']

function MusicPlayer() {
    const audioRef = useRef(null)
    const [isPlaying, setIsPlaying] = useState(false)
    const [trackStatus, setTrackStatus] = useState('Track Loading...')
    const [hasError, setHasError] = useState(false)
    const hasPlayedRef = useRef(false)

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
            setTrackStatus(`Featured Track: ${TRACK_NAME}`)
        }

        const handleError = (e) => {
            console.error('Audio Error:', e)
            setTrackStatus("ERROR: Missing 'audio/track.mp3' file.")
            setHasError(true)
        }

        audio.addEventListener('play', handlePlay)
        audio.addEventListener('pause', handlePause)
        audio.addEventListener('canplaythrough', handleCanPlayThrough)
        audio.addEventListener('error', handleError)

        return () => {
            audio.removeEventListener('play', handlePlay)
            audio.removeEventListener('pause', handlePause)
            audio.removeEventListener('canplaythrough', handleCanPlayThrough)
            audio.removeEventListener('error', handleError)
        }
    }, [])

    const handlePlayPause = () => {
        const audio = audioRef.current
        if (!audio || hasError) return

        // Google Analytics tracking
        if (window.gtag) {
            window.gtag('event', 'button_click', {
                button_id: 'playPauseButton',
                action: audio.paused || audio.ended ? 'play' : 'pause'
            })
        }

        if (audio.paused || audio.ended) {
            audio.play()
                .catch(error => {
                    console.error('Audio playback failed, possibly due to browser autoplay policy:', error)
                })
        } else {
            audio.pause()
        }
    }

    // Derive button text and status text from state
    const buttonText = hasError ? 'FILE MISSING' : (isPlaying ? 'PAUSE TRACK' : 'PLAY TRACK')
    
    // Derive display status from state
    const displayStatus = hasError 
        ? trackStatus 
        : isPlaying 
        ? `NOW PLAYING: ${TRACK_NAME}` 
        : hasPlayedRef.current 
        ? 'PAUSED' 
        : trackStatus

    return (
        <section id="music-player" className="bg-dark-gray p-2 rounded-xl shadow-lg border border-neon-cyan/30 flex flex-col md:flex-row items-center justify-between space-y-4 md:space-y-0 md:space-x-8">
            <audio ref={audioRef} src="/audio/track.mp3" preload="auto" loop></audio>
            
            <div className="flex items-center space-x-4">
                <div 
                    id="statusIcon" 
                    className={`status-indicator ${hasError ? 'bg-red-600' : (isPlaying ? 'animate-pulse-neon playing' : '')}`}
                ></div>
                <div className="text-xs md:text-lg font-mono tracking-wider">
                    <span id="trackStatus">{displayStatus}</span>
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

            <AnimatedSection delay={400} animationType="animate-slide-in-right">
                <button 
                    id="playPauseButton"
                    onClick={handlePlayPause}
                    disabled={hasError}
                    className="h-6 text-sm w-full md:w-auto px-6 py-0 rounded-full font-bold transition duration-300 shadow-md shadow-neon-cyan/30 bg-neon-cyan text-deep-indigo hover:bg-white hover:shadow-neon-cyan/70 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {buttonText}
                </button>
            </AnimatedSection>
        </section>
    )
}

export default MusicPlayer
