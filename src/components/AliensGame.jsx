import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMusicPlayerContext } from '../contexts/MusicPlayerContext'

const CANVAS_WIDTH = 800
const CANVAS_HEIGHT = 600
const PLAYER_SPEED = 5
const BULLET_SPEED = 8
const HOMING_MISSILE_SPEED = 6
const ENEMY_BULLET_SPEED = 5
const ENEMY_SPEED = 2
const ENEMY_SPAWN_RATE = 60 // frames
const STAR_COUNT = 100
const LEVEL_DURATION_FRAMES = 3600 // 60 seconds at 60fps
const LIFE_POWERUP_SPEED = 2
const LIFE_POWERUP_SIZE = 25
const POWERUP_DURATION_SECONDS = 20 // Duration for 3X and Magic Defence

// Sound system - 80's computer style sounds
let audioContext = null

const getAudioContext = () => {
    if (!audioContext) {
        try {
            audioContext = new (window.AudioContext || window.webkitAudioContext)()
        } catch (e) {
            return null
        }
    }
    // Resume context if it's suspended (required after user interaction)
    if (audioContext.state === 'suspended') {
        audioContext.resume().catch(() => {})
    }
    return audioContext
}

const createSound = (frequency, duration, type = 'square', volume = 0.1) => {
    const ctx = getAudioContext()
    if (!ctx) return
    
    try {
        const oscillator = ctx.createOscillator()
        const gainNode = ctx.createGain()
        
        oscillator.connect(gainNode)
        gainNode.connect(ctx.destination)
        
        oscillator.type = type
        oscillator.frequency.value = frequency
        gainNode.gain.setValueAtTime(volume, ctx.currentTime)
        gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration)
        
        oscillator.start(ctx.currentTime)
        oscillator.stop(ctx.currentTime + duration)
    } catch (e) {
        // Silently fail if audio context is not available
    }
}

const createShootSound = () => {
    const ctx = getAudioContext()
    if (!ctx) return
    
    try {
        const oscillator = ctx.createOscillator()
        const gainNode = ctx.createGain()
        
        oscillator.connect(gainNode)
        gainNode.connect(ctx.destination)
        
        oscillator.type = 'sawtooth'
        // Quick frequency sweep from high to low (laser/gunshot effect)
        oscillator.frequency.setValueAtTime(1200, ctx.currentTime)
        oscillator.frequency.exponentialRampToValueAtTime(300, ctx.currentTime + 0.08)
        
        gainNode.gain.setValueAtTime(0.040, ctx.currentTime)
        gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.08)
        
        oscillator.start(ctx.currentTime)
        oscillator.stop(ctx.currentTime + 0.08)
    } catch (e) {
        // Silently fail if audio context is not available
    }
}

function AliensGame({ savedGameState, onSaveGameState, onClearGameState }) {
    const canvasRef = useRef(null)
    const animationFrameRef = useRef(null)
    const navigate = useNavigate()
    
    const [gameState, setGameState] = useState('menu') // 'menu', 'playing', 'gameover'
    const [score, setScore] = useState(0)
    const [highScore, setHighScore] = useState(0)
    const [isMobile, setIsMobile] = useState(false)
    const [level, setLevel] = useState(1)
    const [lives, setLives] = useState(1)
    const [soundEnabled, setSoundEnabled] = useState(true)
    const [countdown, setCountdown] = useState(0) // 0 = no countdown, 3-1 = countdown in progress
    const [isCelebrating, setIsCelebrating] = useState(false)
    const [celebrationStartTime, setCelebrationStartTime] = useState(null)
    const [showHelpDialog, setShowHelpDialog] = useState(false)
    const [scoreMultiplier, setScoreMultiplier] = useState(1) // 1 or 3
    const [scoreMultiplierEndTime, setScoreMultiplierEndTime] = useState(null)
    const [magicDefenceActive, setMagicDefenceActive] = useState(false)
    const [magicDefenceEndTime, setMagicDefenceEndTime] = useState(null)
    const [superWeaponActive, setSuperWeaponActive] = useState(false)
    const [superWeaponEndTime, setSuperWeaponEndTime] = useState(null)
    
    const gameStateRef = useRef({ gameState, score, level, lives })
    const soundEnabledRef = useRef(soundEnabled)
    const showHelpDialogRef = useRef(false)
    const playerRef = useRef({ x: CANVAS_WIDTH / 2, y: CANVAS_HEIGHT - 80 })
    const bulletsRef = useRef([])
    const enemiesRef = useRef([])
    const enemyBulletsRef = useRef([])
    const lifePowerupsRef = useRef([])
    const scoreBonusPowerupsRef = useRef([])
    const magicDefencePowerupsRef = useRef([])
    const superWeaponPowerupsRef = useRef([])
    const clockExtenderPowerupsRef = useRef([])
    const homingMissilesRef = useRef([])
    const keysRef = useRef({})
    const starsRef = useRef([])
    const frameCountRef = useRef(0)
    const touchRef = useRef({ x: null, y: null, isTouching: false, shootPressed: false })
    const levelStartTimeRef = useRef(null)
    const levelAnnouncementStartTimeRef = useRef(null)
    const nextPowerupSpawnFrameRef = useRef(null)
    const nextScoreBonusSpawnFrameRef = useRef(null)
    const nextMagicDefenceSpawnFrameRef = useRef(null)
    const nextSuperWeaponSpawnFrameRef = useRef(null)
    const fireworksRef = useRef([])
    const previousHighScoreRef = useRef(0)
    const hasCelebratedThisGameRef = useRef(false)
    const clockExtenderSpawnedForScoreMultiplierRef = useRef(false)
    const clockExtenderSpawnedForMagicDefenceRef = useRef(false)
    const clockExtenderSpawnedForSuperWeaponRef = useRef(false)
    const clockExtenderDisabledForScoreMultiplierRef = useRef(false)
    const clockExtenderDisabledForMagicDefenceRef = useRef(false)
    const clockExtenderDisabledForSuperWeaponRef = useRef(false)

    // Initialize stars
    useEffect(() => {
        starsRef.current = Array.from({ length: STAR_COUNT }, () => ({
            x: Math.random() * CANVAS_WIDTH,
            y: Math.random() * CANVAS_HEIGHT,
            speed: 0.5 + Math.random() * 1.5,
            size: Math.random() * 2 + 1
        }))
    }, [])

    // Calculate difficulty based on level (1-10)
    const getEnemySpeed = useCallback((currentLevel) => {
        // Level 1: 2, Level 10: 5 (easy to very hard)
        return 2 + (currentLevel - 1) * (3 / 9)
    }, [])

    const getEnemySpawnRate = useCallback((currentLevel) => {
        // Level 1: 60 frames, Level 10: 20 frames (slower to faster spawning)
        return Math.max(20, 60 - (currentLevel - 1) * (40 / 9))
    }, [])

    const getEnemyHorizontalSpeed = useCallback((currentLevel) => {
        // Level 1: ~0.1, Level 10: ~3 (almost zero to quite fast)
        return 0.1 + (currentLevel - 1) * (2.9 / 9)
    }, [])

    const getMegaEnemySpawnChance = useCallback((currentLevel) => {
        // Level 1: 1% chance (extremely rare), Level 10: 80% chance (very common)
        return 0.01 + (currentLevel - 1) * (0.79 / 9)
    }, [])

    const getMegaEnemyFireRate = useCallback((currentLevel) => {
        // Level 1-3: Slow fire rate (fires once or twice), Level 4-6: Medium, Level 7-10: Rapid
        if (currentLevel <= 3) {
            // Level 1: 600 frames, Level 2: 500 frames, Level 3: 400 frames (allows at least one shot)
            return 700 - (currentLevel - 1) * 100
        } else if (currentLevel <= 6) {
            // Level 4-6: Medium fire rate (120-90 frames)
            return 150 - (currentLevel - 4) * 10
        } else {
            // Level 7-10: Rapid fire (60-30 frames)
            return 75 - (currentLevel - 7) * 15
        }
    }, [])

    // Save game state to parent App component (clears on page refresh, persists during navigation)
    const saveGameState = useCallback(() => {
        if (gameStateRef.current.gameState === 'playing') {
            const savedState = {
                gameState: gameStateRef.current.gameState,
                score: gameStateRef.current.score,
                level: gameStateRef.current.level,
                lives: gameStateRef.current.lives,
                player: { ...playerRef.current },
                enemies: [...enemiesRef.current],
                bullets: [...bulletsRef.current],
                enemyBullets: [...enemyBulletsRef.current],
                lifePowerups: [...lifePowerupsRef.current],
                frameCount: frameCountRef.current,
                levelStartTime: levelStartTimeRef.current,
                nextPowerupSpawnFrame: nextPowerupSpawnFrameRef.current,
                hasCelebratedThisGame: hasCelebratedThisGameRef.current,
                previousHighScore: previousHighScoreRef.current,
                savedAt: Date.now()
            }
            onSaveGameState(savedState)
        }
    }, [onSaveGameState])

    // Restore game state from parent App component (clears on page refresh, persists during navigation)
    const restoreGameState = useCallback(() => {
        if (savedGameState) {
            try {
                setGameState(savedGameState.gameState)
                setScore(savedGameState.score)
                setLevel(savedGameState.level)
                setLives(savedGameState.lives)
                playerRef.current = savedGameState.player
                enemiesRef.current = savedGameState.enemies
                bulletsRef.current = savedGameState.bullets
                enemyBulletsRef.current = savedGameState.enemyBullets || []
                lifePowerupsRef.current = savedGameState.lifePowerups
                frameCountRef.current = savedGameState.frameCount
                
                // Adjust timing for pause duration
                const pauseDuration = Date.now() - savedGameState.savedAt
                levelStartTimeRef.current = savedGameState.levelStartTime + pauseDuration
                nextPowerupSpawnFrameRef.current = savedGameState.nextPowerupSpawnFrame
                
                // Restore celebration flags to prevent duplicate celebrations
                if (savedGameState.hasCelebratedThisGame !== undefined) {
                    hasCelebratedThisGameRef.current = savedGameState.hasCelebratedThisGame
                }
                if (savedGameState.previousHighScore !== undefined) {
                    previousHighScoreRef.current = savedGameState.previousHighScore
                }
                
                // Clear saved state from parent
                onClearGameState()
                
                // Start countdown
                setCountdown(3)
                return true
            } catch (e) {
                console.error('Failed to restore game state:', e)
                onClearGameState()
            }
        }
        return false
    }, [savedGameState, onClearGameState])

    // Create firework particles
    const createFireworks = useCallback((centerX, centerY) => {
        const colors = ['#FF00FF', '#00FFFF', '#FFFF00', '#FF4444', '#00FF00', '#FF8800']
        const particles = []
        for (let i = 0; i < 50; i++) {
            const angle = (Math.PI * 2 * i) / 50
            const speed = 2 + Math.random() * 4
            const color = colors[Math.floor(Math.random() * colors.length)]
            particles.push({
                x: centerX,
                y: centerY,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                life: 1.0,
                decay: 0.01 + Math.random() * 0.02,
                color: color,
                size: 2 + Math.random() * 3
            })
        }
        return particles
    }, [])

    const startGame = useCallback(() => {
        // Clear any saved game state
        onClearGameState()
        setCountdown(0)
        setIsCelebrating(false)
        setCelebrationStartTime(null)
        fireworksRef.current = []
        hasCelebratedThisGameRef.current = false
        clockExtenderSpawnedForScoreMultiplierRef.current = false
        clockExtenderSpawnedForMagicDefenceRef.current = false
        clockExtenderSpawnedForSuperWeaponRef.current = false
        setScoreMultiplier(1)
        setScoreMultiplierEndTime(null)
        setMagicDefenceActive(false)
        setMagicDefenceEndTime(null)
        setSuperWeaponActive(false)
        setSuperWeaponEndTime(null)
        setGameState('playing')
        setScore(0)
        setLevel(1)
        setLives(1)
        playerRef.current = { x: CANVAS_WIDTH / 2, y: CANVAS_HEIGHT - 80 }
        bulletsRef.current = []
        enemiesRef.current = []
        enemyBulletsRef.current = []
        lifePowerupsRef.current = []
        scoreBonusPowerupsRef.current = []
        magicDefencePowerupsRef.current = []
        superWeaponPowerupsRef.current = []
        clockExtenderPowerupsRef.current = []
        homingMissilesRef.current = []
        frameCountRef.current = 0
        levelStartTimeRef.current = Date.now()
        levelAnnouncementStartTimeRef.current = Date.now()
        // Set first powerup spawn at a random time within the first level (0 to LEVEL_DURATION_FRAMES)
        nextPowerupSpawnFrameRef.current = Math.floor(Math.random() * LEVEL_DURATION_FRAMES)
        nextScoreBonusSpawnFrameRef.current = Math.floor(Math.random() * LEVEL_DURATION_FRAMES)
        nextMagicDefenceSpawnFrameRef.current = Math.floor(Math.random() * LEVEL_DURATION_FRAMES)
        nextSuperWeaponSpawnFrameRef.current = Math.floor(Math.random() * LEVEL_DURATION_FRAMES)
        // Reset previous high score ref to current high score at game start
        previousHighScoreRef.current = highScore
    }, [highScore, onClearGameState])

    const gameOver = useCallback(() => {
        setGameState('gameover')
        if (gameStateRef.current.score > highScore) {
            const newHighScore = gameStateRef.current.score
            setHighScore(newHighScore)
            previousHighScoreRef.current = newHighScore
            localStorage.setItem('aliensHighScore', newHighScore.toString())
        }
        // Game over sound
        if (soundEnabled) {
            createSound(150, 0.2, 'sawtooth', 0.2)
            setTimeout(() => createSound(100, 0.3, 'sawtooth', 0.2), 200)
        }
    }, [highScore, soundEnabled])

    // Keyboard handlers
    useEffect(() => {
        const handleKeyDown = (e) => {
            keysRef.current[e.key] = true
            if (e.key === ' ') {
                e.preventDefault()
                if (gameStateRef.current.gameState === 'menu') {
                    startGame()
                } else if (gameStateRef.current.gameState === 'gameover') {
                    startGame()
                }
            }
        }
        
        const handleKeyUp = (e) => {
            keysRef.current[e.key] = false
        }

        window.addEventListener('keydown', handleKeyDown)
        window.addEventListener('keyup', handleKeyUp)
        
        return () => {
            window.removeEventListener('keydown', handleKeyDown)
            window.removeEventListener('keyup', handleKeyUp)
        }
    }, [startGame])

    // Touch handlers
    useEffect(() => {
        const canvas = canvasRef.current
        if (!canvas || !isMobile) return

        const getCanvasCoordinates = (clientX, clientY) => {
            const rect = canvas.getBoundingClientRect()
            const scaleX = canvas.width / rect.width
            const scaleY = canvas.height / rect.height
            return {
                x: (clientX - rect.left) * scaleX,
                y: (clientY - rect.top) * scaleY
            }
        }

        const handleTouchStart = (e) => {
            e.preventDefault()
            if (gameStateRef.current.gameState === 'menu' || gameStateRef.current.gameState === 'gameover') {
                startGame()
                return
            }

            const touch = e.touches[0]
            const coords = getCanvasCoordinates(touch.clientX, touch.clientY)
            touchRef.current = {
                x: coords.x,
                y: coords.y,
                isTouching: true,
                shootPressed: true
            }
        }

        const handleTouchMove = (e) => {
            e.preventDefault()
            if (touchRef.current.isTouching && gameStateRef.current.gameState === 'playing') {
                const touch = e.touches[0]
                const coords = getCanvasCoordinates(touch.clientX, touch.clientY)
                touchRef.current.x = coords.x
                touchRef.current.y = coords.y
            }
        }

        const handleTouchEnd = (e) => {
            e.preventDefault()
            touchRef.current = {
                x: null,
                y: null,
                isTouching: false,
                shootPressed: false
            }
        }

        canvas.addEventListener('touchstart', handleTouchStart, { passive: false })
        canvas.addEventListener('touchmove', handleTouchMove, { passive: false })
        canvas.addEventListener('touchend', handleTouchEnd, { passive: false })
        canvas.addEventListener('touchcancel', handleTouchEnd, { passive: false })

        return () => {
            canvas.removeEventListener('touchstart', handleTouchStart)
            canvas.removeEventListener('touchmove', handleTouchMove)
            canvas.removeEventListener('touchend', handleTouchEnd)
            canvas.removeEventListener('touchcancel', handleTouchEnd)
        }
    }, [startGame, isMobile])

    // Load high score and restore game state on mount
    useEffect(() => {
        const saved = localStorage.getItem('aliensHighScore')
        if (saved) {
            const savedHighScore = parseInt(saved, 10)
            setHighScore(savedHighScore)
            previousHighScoreRef.current = savedHighScore
        }
        
        // Try to restore game state (will be null if page was refreshed, as React state clears)
        restoreGameState()
    }, [restoreGameState])

    // Countdown timer
    useEffect(() => {
        if (countdown > 0) {
            const timer = setTimeout(() => {
                if (countdown > 1) {
                    setCountdown(countdown - 1)
                } else {
                    setCountdown(0)
                    // Resume game after countdown
                    levelAnnouncementStartTimeRef.current = null
                }
            }, 1000)
            return () => clearTimeout(timer)
        }
    }, [countdown])

    // Celebration timer (5 seconds)
    useEffect(() => {
        if (isCelebrating && celebrationStartTime) {
            const timer = setTimeout(() => {
                // Update high score after celebration
                setHighScore(gameStateRef.current.score)
                previousHighScoreRef.current = gameStateRef.current.score
                localStorage.setItem('aliensHighScore', gameStateRef.current.score.toString())
                setIsCelebrating(false)
                setCelebrationStartTime(null)
                fireworksRef.current = []
            }, 5000)
            return () => clearTimeout(timer)
        }
    }, [isCelebrating, celebrationStartTime])

    // 3X score multiplier timer
    useEffect(() => {
        if (scoreMultiplierEndTime) {
            const checkTimer = setInterval(() => {
                if (Date.now() >= scoreMultiplierEndTime) {
                    setScoreMultiplier(1)
                    setScoreMultiplierEndTime(null)
                }
            }, 100) // Check every 100ms
            return () => clearInterval(checkTimer)
        }
    }, [scoreMultiplierEndTime])

    // Magic defence timer
    useEffect(() => {
        if (magicDefenceEndTime) {
            const checkTimer = setInterval(() => {
                if (Date.now() >= magicDefenceEndTime) {
                    setMagicDefenceActive(false)
                    setMagicDefenceEndTime(null)
                }
            }, 100) // Check every 100ms
            return () => clearInterval(checkTimer)
        }
    }, [magicDefenceEndTime])

    // Super weapon timer
    useEffect(() => {
        if (superWeaponEndTime) {
            const checkTimer = setInterval(() => {
                if (Date.now() >= superWeaponEndTime) {
                    setSuperWeaponActive(false)
                    setSuperWeaponEndTime(null)
                }
            }, 100) // Check every 100ms
            return () => clearInterval(checkTimer)
        }
    }, [superWeaponEndTime])

    // Save game state on unmount
    useEffect(() => {
        return () => {
            saveGameState()
        }
    }, [saveGameState])

    // Detect mobile/desktop and set canvas size on mobile
    useEffect(() => {
        const checkMobile = () => {
            const mobile = window.innerWidth < 768
            setIsMobile(mobile)
            
            // On mobile, set canvas resolution to match viewport
            if (mobile && canvasRef.current) {
                const canvas = canvasRef.current
                canvas.width = window.innerWidth
                canvas.height = window.innerHeight
            } else if (!mobile && canvasRef.current) {
                // Reset to logical size on desktop
                canvasRef.current.width = CANVAS_WIDTH
                canvasRef.current.height = CANVAS_HEIGHT
            }
        }
        checkMobile()
        window.addEventListener('resize', checkMobile)
        return () => window.removeEventListener('resize', checkMobile)
    }, [])

    // Update game state ref
    useEffect(() => {
        gameStateRef.current = { gameState, score, level, lives }
        soundEnabledRef.current = soundEnabled
        showHelpDialogRef.current = showHelpDialog
    }, [gameState, score, level, lives, soundEnabled, showHelpDialog])

    // Update high score during gameplay when current score exceeds it
    useEffect(() => {
        if (gameState === 'playing' && score > highScore) {
            setHighScore(score)
            localStorage.setItem('aliensHighScore', score.toString())
        }
    }, [score, highScore, gameState])

    // Get music player context
    const { audioRef: musicAudioRef, isPlaying: musicIsPlaying, hasPlayedRef: musicHasPlayedRef, handlePlayPause } = useMusicPlayerContext()

    // Ref for volume transition interval
    const volumeTransitionRef = useRef(null)

    // Helper function for gradual volume transition
    const transitionVolume = useCallback((targetVolume, duration = 2000) => {
        if (!musicAudioRef.current) return

        const startVolume = musicAudioRef.current.volume
        const startTime = Date.now()

        // Clear any existing transition
        if (volumeTransitionRef.current) {
            clearInterval(volumeTransitionRef.current)
        }

        // Only transition if there's a change needed
        if (Math.abs(startVolume - targetVolume) < 0.01) {
            musicAudioRef.current.volume = targetVolume
            return
        }

        // Gradual volume transition
        volumeTransitionRef.current = setInterval(() => {
            if (!musicAudioRef.current) {
                if (volumeTransitionRef.current) {
                    clearInterval(volumeTransitionRef.current)
                    volumeTransitionRef.current = null
                }
                return
            }

            const elapsed = Date.now() - startTime
            const progress = Math.min(elapsed / duration, 1)
            
            // Ease in-out cubic for smooth transition
            const easeProgress = progress < 0.5
                ? 4 * progress * progress * progress
                : 1 - Math.pow(-2 * progress + 2, 3) / 2

            const currentVolume = startVolume + (targetVolume - startVolume) * easeProgress
            musicAudioRef.current.volume = currentVolume

            if (progress >= 1) {
                musicAudioRef.current.volume = targetVolume
                if (volumeTransitionRef.current) {
                    clearInterval(volumeTransitionRef.current)
                    volumeTransitionRef.current = null
                }
            }
        }, 16) // ~60fps updates
    }, [musicAudioRef])

    // Track game entry with analytics and set initial music volume
    useEffect(() => {
        if (window.gtag) {
            window.gtag('event', 'game_entry', {
                game_name: 'Aliens',
                action: 'enter_game'
            })
        }

        // Set initial volume when entering game route
        // If music is already playing, transition gradually; otherwise set immediately
        if (musicAudioRef.current) {
            const initialVolume = soundEnabled ? 0.25 : 1.0
            if (musicIsPlaying && !musicAudioRef.current.paused) {
                // Music is playing: transition gradually
                transitionVolume(initialVolume)
            } else {
                // Music is not playing: set immediately (no transition needed)
                musicAudioRef.current.volume = initialVolume
            }
        }
    }, [musicIsPlaying, soundEnabled, transitionVolume])

    // Wrapper for handlePlayPause that tracks in-game music state
    const handleMusicToggle = () => {
        handlePlayPause()
        // After toggling, update localStorage based on new state
        // We need to check the actual audio state after a brief delay
        setTimeout(() => {
            if (musicAudioRef.current) {
                const isNowPaused = musicAudioRef.current.paused
                if (isNowPaused) {
                    localStorage.setItem('aliensGameMusicPaused', 'true')
                } else {
                    localStorage.removeItem('aliensGameMusicPaused')
                }
            }
        }, 100)
    }

    // Play music when game starts, unless explicitly paused in-game
    const gameStartedRef = useRef(false)
    useEffect(() => {
        if (gameState === 'playing' && !gameStartedRef.current) {
            gameStartedRef.current = true
            const musicWasPausedInGame = localStorage.getItem('aliensGameMusicPaused') === 'true'
            if (!musicWasPausedInGame && musicAudioRef.current && musicAudioRef.current.paused) {
                // Set volume before playing (no transition, immediate)
                const targetVolume = soundEnabled ? 0.25 : 1.0
                musicAudioRef.current.volume = targetVolume
                const playPromise = musicAudioRef.current.play()
                if (playPromise !== undefined) {
                    playPromise.catch(error => {
                        // Silently fail if autoplay is blocked (browser policy)
                        console.error('Auto-play music on game start failed:', error)
                    })
                }
            }
        } else if (gameState === 'menu' || gameState === 'gameover') {
            gameStartedRef.current = false
        }
    }, [gameState, musicAudioRef, soundEnabled])

    // Handle navigation back to home with analytics
    const handleBackToHome = () => {
        saveGameState()
        if (window.gtag) {
            window.gtag('event', 'game_exit', {
                game_name: 'Aliens',
                action: 'return_to_home'
            })
        }
        navigate('/')
    }

    // Toggle sound
    const toggleSound = () => {
        setSoundEnabled(prev => !prev)
    }

    // Share game using Web Share API
    const handleShare = async () => {
        if (navigator.share) {
            try {
                await navigator.share({
                    title: 'Aliens Game @ neuronoiser.com',
                    text: 'Check out this retro space shooter game! Play Aliens - an 80s-style space shooter with powerups, 10 levels, and increasing difficulty.',
                    url: window.location.href
                })
            } catch (error) {
                // User cancelled or error occurred - silently fail
                if (error.name !== 'AbortError') {
                    console.error('Error sharing:', error)
                }
            }
        }
    }

    // Track if we've initialized volume (skip transition on initial mount)
    const volumeInitializedRef = useRef(false)

    // Adjust music volume based on sound effects state (gradual transition)
    useEffect(() => {
        if (!volumeInitializedRef.current) {
            // Skip transition on initial mount (volume was already set in game entry effect)
            volumeInitializedRef.current = true
            return () => {
                // Restore volume to 100% when leaving game route
                transitionVolume(1.0)
            }
        }

        // After initial mount, use gradual transitions when sound effects toggle changes
        const targetVolume = soundEnabled ? 0.25 : 1.0 // 25% when sound effects on, 100% when off
        transitionVolume(targetVolume)

        return () => {
            // Restore volume to 100% when leaving game route
            transitionVolume(1.0)
        }
    }, [soundEnabled, transitionVolume])

    // Game loop
    useEffect(() => {
        const canvas = canvasRef.current
        if (!canvas) return

        const ctx = canvas.getContext('2d')
        
        const gameLoop = () => {
            // Clear canvas
            ctx.fillStyle = '#000011'
            if (isMobile) {
                ctx.fillRect(0, 0, canvas.width, canvas.height)
                
                // Canvas resolution matches viewport (fills screen)
                // Scale drawing context to map logical coordinates and compensate aspect ratio
                const viewportAspect = canvas.width / canvas.height
                const logicalAspect = CANVAS_WIDTH / CANVAS_HEIGHT
                
                // Scale to map logical coordinates to viewport
                const baseScaleX = canvas.width / CANVAS_WIDTH
                const baseScaleY = canvas.height / CANVAS_HEIGHT
                
                // Compensate for aspect ratio difference to keep circles circular
                const aspectCompensation = logicalAspect / viewportAspect
                
                ctx.save()
                ctx.scale(baseScaleX * aspectCompensation, baseScaleY)
            } else {
                ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)
            }

            // Draw stars
            ctx.fillStyle = '#ffffff'
            starsRef.current.forEach(star => {
                star.y += star.speed
                if (star.y > CANVAS_HEIGHT) {
                    star.y = 0
                    star.x = Math.random() * CANVAS_WIDTH
                }
                ctx.fillRect(star.x, star.y, star.size, star.size)
            })

            if (gameStateRef.current.gameState === 'playing' && countdown === 0 && !showHelpDialogRef.current) {
                frameCountRef.current++

                // Check for new high score (only once per game, and only if there was a previous high score)
                if (!hasCelebratedThisGameRef.current && 
                    previousHighScoreRef.current > 0 && 
                    gameStateRef.current.score > previousHighScoreRef.current && 
                    !isCelebrating) {
                    hasCelebratedThisGameRef.current = true
                    setIsCelebrating(true)
                    setCelebrationStartTime(Date.now())
                    // Create multiple firework bursts at different positions
                    const positions = [
                        { x: CANVAS_WIDTH * 0.2, y: CANVAS_HEIGHT * 0.3 },
                        { x: CANVAS_WIDTH * 0.5, y: CANVAS_HEIGHT * 0.4 },
                        { x: CANVAS_WIDTH * 0.8, y: CANVAS_HEIGHT * 0.3 },
                        { x: CANVAS_WIDTH * 0.3, y: CANVAS_HEIGHT * 0.6 },
                        { x: CANVAS_WIDTH * 0.7, y: CANVAS_HEIGHT * 0.6 }
                    ]
                    fireworksRef.current = []
                    positions.forEach(pos => {
                        fireworksRef.current.push(...createFireworks(pos.x, pos.y))
                    })
                    // Celebration sound
                    if (soundEnabledRef.current) {
                        createSound(400, 0.2, 'square', 0.3)
                        setTimeout(() => createSound(500, 0.2, 'square', 0.3), 150)
                        setTimeout(() => createSound(600, 0.3, 'square', 0.3), 300)
                    }
                }

                // Level progression: advance level every 60 seconds
                if (levelStartTimeRef.current && level < 10) {
                    const timeInLevel = (Date.now() - levelStartTimeRef.current) / 1000 // seconds
                    if (timeInLevel >= 60) {
                        const newLevel = level + 1
                        setLevel(newLevel)
                        levelStartTimeRef.current = Date.now()
                        levelAnnouncementStartTimeRef.current = Date.now()
                        // Set next powerup spawn at a random time within the new level
                        nextPowerupSpawnFrameRef.current = frameCountRef.current + Math.floor(Math.random() * LEVEL_DURATION_FRAMES)
                        nextScoreBonusSpawnFrameRef.current = frameCountRef.current + Math.floor(Math.random() * LEVEL_DURATION_FRAMES)
                        nextMagicDefenceSpawnFrameRef.current = frameCountRef.current + Math.floor(Math.random() * LEVEL_DURATION_FRAMES)
                        nextSuperWeaponSpawnFrameRef.current = frameCountRef.current + Math.floor(Math.random() * LEVEL_DURATION_FRAMES)
                        // Level up sound
                        if (soundEnabledRef.current) {
                            createSound(300, 0.1, 'square', 0.15)
                            setTimeout(() => createSound(400, 0.1, 'square', 0.15), 100)
                            setTimeout(() => createSound(500, 0.15, 'square', 0.15), 200)
                        }
                    }
                }

                // Get current level-based difficulty
                const currentEnemySpeed = getEnemySpeed(level)
                const currentEnemySpawnRate = getEnemySpawnRate(level)
                const currentEnemyHorizontalSpeed = getEnemyHorizontalSpeed(level)
                const megaEnemySpawnChance = getMegaEnemySpawnChance(level)
                const megaEnemyFireRate = getMegaEnemyFireRate(level)

                // Player movement
                const player = playerRef.current
                
                // Touch controls
                if (touchRef.current.isTouching && touchRef.current.x !== null && touchRef.current.y !== null) {
                    const targetX = Math.max(20, Math.min(CANVAS_WIDTH - 20, touchRef.current.x))
                    const targetY = Math.max(CANVAS_HEIGHT / 2, Math.min(CANVAS_HEIGHT - 20, touchRef.current.y))
                    const dx = targetX - player.x
                    const dy = targetY - player.y
                    const distance = Math.sqrt(dx * dx + dy * dy)
                    
                    if (distance > PLAYER_SPEED) {
                        player.x += (dx / distance) * PLAYER_SPEED
                        player.y += (dy / distance) * PLAYER_SPEED
                    } else {
                        player.x = targetX
                        player.y = targetY
                    }
                } else {
                    // Keyboard controls
                    if (keysRef.current['ArrowLeft'] || keysRef.current['a'] || keysRef.current['A']) {
                        player.x = Math.max(20, player.x - PLAYER_SPEED)
                    }
                    if (keysRef.current['ArrowRight'] || keysRef.current['d'] || keysRef.current['D']) {
                        player.x = Math.min(CANVAS_WIDTH - 20, player.x + PLAYER_SPEED)
                    }
                    if (keysRef.current['ArrowUp'] || keysRef.current['w'] || keysRef.current['W']) {
                        player.y = Math.max(CANVAS_HEIGHT / 2, player.y - PLAYER_SPEED)
                    }
                    if (keysRef.current['ArrowDown'] || keysRef.current['s'] || keysRef.current['S']) {
                        player.y = Math.min(CANVAS_HEIGHT - 20, player.y + PLAYER_SPEED)
                    }
                }

                // Shooting
                const shouldShoot = keysRef.current[' '] || touchRef.current.shootPressed
                if (shouldShoot) {
                    if (superWeaponActive) {
                        // Super weapon: fire homing missiles (never more than number of enemies, max 3, and only for enemies not already targeted)
                        if (frameCountRef.current % 15 === 0) {
                            // Find which enemies are already targeted by existing missiles
                            const targetedEnemyIndices = new Set(
                                homingMissilesRef.current
                                    .filter(m => m.targetEnemyIndex !== null && 
                                                m.targetEnemyIndex < enemiesRef.current.length &&
                                                enemiesRef.current[m.targetEnemyIndex] !== undefined)
                                    .map(m => m.targetEnemyIndex)
                            )
                            
                            // Find enemies that are not yet targeted
                            const availableEnemies = enemiesRef.current
                                .map((enemy, index) => ({ enemy, index }))
                                .filter(({ index }) => !targetedEnemyIndices.has(index))
                            
                            // Fire missiles for available enemies (max 3)
                            const missileCount = Math.min(3, availableEnemies.length)
                            
                            if (missileCount > 0) {
                                const spread = 20 // Horizontal spread for missiles
                                for (let i = 0; i < missileCount; i++) {
                                    const offsetX = (i - (missileCount - 1) / 2) * spread // Center the spread
                                    homingMissilesRef.current.push({
                                        x: player.x + offsetX,
                                        y: player.y - 30,
                                        width: 6,
                                        height: 10,
                                        targetEnemyIndex: null // Will be assigned during update
                                    })
                                }
                                // Super weapon shoot sound (slightly different)
                                if (soundEnabledRef.current) createShootSound()
                            }
                        }
                    } else {
                        // Regular shooting
                        if (frameCountRef.current % 10 === 0) {
                            bulletsRef.current.push({
                                x: player.x,
                                y: player.y - 30,
                                width: 4,
                                height: 12
                            })
                            // Shoot sound
                            if (soundEnabledRef.current) createShootSound()
                        }
                    }
                }

                // Update bullets
                bulletsRef.current = bulletsRef.current
                    .map(bullet => ({ ...bullet, y: bullet.y - BULLET_SPEED }))
                    .filter(bullet => bullet.y > -bullet.height)

                // Update homing missiles
                if (enemiesRef.current.length > 0) {
                    // Assign targets to missiles that don't have one (ensure unique targets)
                    const assignedTargets = new Set(
                        homingMissilesRef.current
                            .filter(m => m.targetEnemyIndex !== null && 
                                        m.targetEnemyIndex < enemiesRef.current.length &&
                                        enemiesRef.current[m.targetEnemyIndex] !== undefined)
                            .map(m => m.targetEnemyIndex)
                    )
                    
                    homingMissilesRef.current.forEach(missile => {
                        if (missile.targetEnemyIndex === null || 
                            missile.targetEnemyIndex >= enemiesRef.current.length ||
                            enemiesRef.current[missile.targetEnemyIndex] === undefined) {
                            // Find nearest enemy that isn't already targeted
                            let bestEnemyIndex = -1
                            let bestDistance = Infinity
                            
                            enemiesRef.current.forEach((enemy, index) => {
                                if (!assignedTargets.has(index)) {
                                    const distance = Math.sqrt(
                                        Math.pow(missile.x - (enemy.x + enemy.width / 2), 2) +
                                        Math.pow(missile.y - (enemy.y + enemy.height / 2), 2)
                                    )
                                    
                                    if (distance < bestDistance) {
                                        bestEnemyIndex = index
                                        bestDistance = distance
                                    }
                                }
                            })
                            
                            // If all enemies are targeted, find nearest anyway (fallback)
                            if (bestEnemyIndex === -1 && enemiesRef.current.length > 0) {
                                enemiesRef.current.forEach((enemy, index) => {
                                    const distance = Math.sqrt(
                                        Math.pow(missile.x - (enemy.x + enemy.width / 2), 2) +
                                        Math.pow(missile.y - (enemy.y + enemy.height / 2), 2)
                                    )
                                    if (distance < bestDistance) {
                                        bestEnemyIndex = index
                                        bestDistance = distance
                                    }
                                })
                            }
                            
                            if (bestEnemyIndex !== -1) {
                                missile.targetEnemyIndex = bestEnemyIndex
                                assignedTargets.add(bestEnemyIndex)
                            }
                        }
                    })
                    
                    // Move missiles toward their targets
                    homingMissilesRef.current = homingMissilesRef.current
                        .map(missile => {
                            if (missile.targetEnemyIndex !== null && 
                                missile.targetEnemyIndex < enemiesRef.current.length &&
                                enemiesRef.current[missile.targetEnemyIndex] !== undefined) {
                                const target = enemiesRef.current[missile.targetEnemyIndex]
                                const targetX = target.x + target.width / 2
                                const targetY = target.y + target.height / 2
                                
                                const dx = targetX - missile.x
                                const dy = targetY - missile.y
                                const distance = Math.sqrt(dx * dx + dy * dy)
                                
                                if (distance > 0) {
                                    // Move toward target with homing behavior
                                    const moveX = (dx / distance) * HOMING_MISSILE_SPEED
                                    const moveY = (dy / distance) * HOMING_MISSILE_SPEED
                                    
                                    return {
                                        ...missile,
                                        x: missile.x + moveX,
                                        y: missile.y + moveY
                                    }
                                }
                            }
                            // If no target, move upward
                            return {
                                ...missile,
                                y: missile.y - HOMING_MISSILE_SPEED
                            }
                        })
                        .filter(missile => {
                            // Remove if off screen
                            if (missile.y < -missile.height || missile.y > CANVAS_HEIGHT ||
                                missile.x < -missile.width || missile.x > CANVAS_WIDTH) {
                                return false
                            }
                            return true
                        })
                } else {
                    // No enemies, just move missiles upward
                    homingMissilesRef.current = homingMissilesRef.current
                        .map(missile => ({
                            ...missile,
                            y: missile.y - HOMING_MISSILE_SPEED
                        }))
                        .filter(missile => missile.y > -missile.height)
                }

                // Update enemy bullets
                enemyBulletsRef.current = enemyBulletsRef.current
                    .map(bullet => ({
                        ...bullet,
                        x: bullet.x + bullet.vx,
                        y: bullet.y + bullet.vy
                    }))
                    .filter(bullet => {
                        // Remove if off screen
                        if (bullet.y > CANVAS_HEIGHT || bullet.x < 0 || bullet.x > CANVAS_WIDTH) {
                            return false
                        }
                        
                        // Collision with player
                        if (
                            bullet.x < player.x + 20 &&
                            bullet.x + bullet.width > player.x - 20 &&
                            bullet.y < player.y + 20 &&
                            bullet.y + bullet.height > player.y - 20
                        ) {
                            if (magicDefenceActive) {
                                // Magic defence active: bullet does nothing (player is invincible)
                                // No sound, just remove the bullet
                            } else {
                                // Normal collision: lose life
                                setLives(prev => {
                                    const newLives = prev - 1
                                    // Lose life sound
                                    if (soundEnabledRef.current) createSound(150, 0.3, 'sawtooth', 0.25)
                                    if (newLives <= 0) {
                                        gameOver()
                                    }
                                    return newLives
                                })
                            }
                            return false
                        }
                        
                        return true
                    })

                // Spawn enemies (using level-based spawn rate)
                if (frameCountRef.current % Math.floor(currentEnemySpawnRate) === 0) {
                    // Random horizontal velocity (left or right)
                    const direction = Math.random() < 0.5 ? -1 : 1
                    const isMega = Math.random() < megaEnemySpawnChance
                    enemiesRef.current.push({
                        x: Math.random() * (CANVAS_WIDTH - 40) + 20,
                        y: -30,
                        width: 30,
                        height: 30,
                        health: 1,
                        vx: direction * (Math.random() * currentEnemyHorizontalSpeed + currentEnemyHorizontalSpeed * 0.5), // Random speed within range
                        isMega: isMega,
                        lastShotFrame: null // Track when mega enemy last shot (null = hasn't shot yet)
                    })
                }

                // Spawn life powerups at random intervals (approximately once per level)
                if (nextPowerupSpawnFrameRef.current !== null && frameCountRef.current >= nextPowerupSpawnFrameRef.current) {
                    // Generate spawn position that avoids player's x position and player bullets/missiles
                    const PLAYER_AVOID_ZONE = 80 // Avoid spawning within 80 pixels of player x position
                    const BULLET_AVOID_ZONE = 50 // Avoid spawning within 50 pixels of bullet/missile x position
                    let spawnX
                    let attempts = 0
                    do {
                        spawnX = Math.random() * (CANVAS_WIDTH - LIFE_POWERUP_SIZE * 2) + LIFE_POWERUP_SIZE
                        attempts++
                        
                        // Check if position is too close to player
                        const tooCloseToPlayer = Math.abs(spawnX - player.x) < PLAYER_AVOID_ZONE
                        
                        // Check if position would be in path of bullets (in upper screen area)
                        const hasBulletInPath = bulletsRef.current.some(bullet => {
                            const bulletCenterX = bullet.x
                            return Math.abs(spawnX - bulletCenterX) < BULLET_AVOID_ZONE && bullet.y < CANVAS_HEIGHT * 0.3
                        })
                        
                        // Check if position would be in path of homing missiles (in upper screen area)
                        const hasMissileInPath = homingMissilesRef.current.some(missile => {
                            const missileCenterX = missile.x + missile.width / 2
                            return Math.abs(spawnX - missileCenterX) < BULLET_AVOID_ZONE && missile.y < CANVAS_HEIGHT * 0.3
                        })
                        
                        if (tooCloseToPlayer || hasBulletInPath || hasMissileInPath) {
                            spawnX = null // Force retry
                        }
                    } while (spawnX === null && attempts < 30)
                    
                    if (spawnX !== null) {
                        lifePowerupsRef.current.push({
                            x: spawnX,
                            y: -LIFE_POWERUP_SIZE,
                            size: LIFE_POWERUP_SIZE
                        })
                        // Clear the spawn frame - next level advance will schedule a new one
                        nextPowerupSpawnFrameRef.current = null
                    }
                }

                // Spawn 3X score bonus powerups at random intervals (approximately once per level)
                if (nextScoreBonusSpawnFrameRef.current !== null && frameCountRef.current >= nextScoreBonusSpawnFrameRef.current) {
                    // Generate spawn position that avoids player's x position and player bullets/missiles
                    const PLAYER_AVOID_ZONE = 80
                    const BULLET_AVOID_ZONE = 50
                    let spawnX
                    let attempts = 0
                    do {
                        spawnX = Math.random() * (CANVAS_WIDTH - LIFE_POWERUP_SIZE * 2) + LIFE_POWERUP_SIZE
                        attempts++
                        const tooCloseToPlayer = Math.abs(spawnX - player.x) < PLAYER_AVOID_ZONE
                        const hasBulletInPath = bulletsRef.current.some(bullet => {
                            const bulletCenterX = bullet.x
                            return Math.abs(spawnX - bulletCenterX) < BULLET_AVOID_ZONE && bullet.y < CANVAS_HEIGHT * 0.3
                        })
                        const hasMissileInPath = homingMissilesRef.current.some(missile => {
                            const missileCenterX = missile.x + missile.width / 2
                            return Math.abs(spawnX - missileCenterX) < BULLET_AVOID_ZONE && missile.y < CANVAS_HEIGHT * 0.3
                        })
                        if (tooCloseToPlayer || hasBulletInPath || hasMissileInPath) spawnX = null
                    } while (spawnX === null && attempts < 30)
                    
                    if (spawnX !== null) {
                        scoreBonusPowerupsRef.current.push({
                            x: spawnX,
                            y: -LIFE_POWERUP_SIZE,
                            size: LIFE_POWERUP_SIZE
                        })
                        // Clear the spawn frame - next level advance will schedule a new one
                        nextScoreBonusSpawnFrameRef.current = null
                    }
                }

                // Spawn magic defence powerups at random intervals (approximately once per level)
                if (nextMagicDefenceSpawnFrameRef.current !== null && frameCountRef.current >= nextMagicDefenceSpawnFrameRef.current) {
                    // Generate spawn position that avoids player's x position and player bullets/missiles
                    const PLAYER_AVOID_ZONE = 80
                    const BULLET_AVOID_ZONE = 50
                    let spawnX
                    let attempts = 0
                    do {
                        spawnX = Math.random() * (CANVAS_WIDTH - LIFE_POWERUP_SIZE * 2) + LIFE_POWERUP_SIZE
                        attempts++
                        const tooCloseToPlayer = Math.abs(spawnX - player.x) < PLAYER_AVOID_ZONE
                        const hasBulletInPath = bulletsRef.current.some(bullet => {
                            const bulletCenterX = bullet.x
                            return Math.abs(spawnX - bulletCenterX) < BULLET_AVOID_ZONE && bullet.y < CANVAS_HEIGHT * 0.3
                        })
                        const hasMissileInPath = homingMissilesRef.current.some(missile => {
                            const missileCenterX = missile.x + missile.width / 2
                            return Math.abs(spawnX - missileCenterX) < BULLET_AVOID_ZONE && missile.y < CANVAS_HEIGHT * 0.3
                        })
                        if (tooCloseToPlayer || hasBulletInPath || hasMissileInPath) spawnX = null
                    } while (spawnX === null && attempts < 30)
                    
                    if (spawnX !== null) {
                        magicDefencePowerupsRef.current.push({
                            x: spawnX,
                            y: -LIFE_POWERUP_SIZE,
                            size: LIFE_POWERUP_SIZE
                        })
                        // Clear the spawn frame - next level advance will schedule a new one
                        nextMagicDefenceSpawnFrameRef.current = null
                    }
                }

                // Spawn super weapon powerups at random intervals (approximately once per level)
                if (nextSuperWeaponSpawnFrameRef.current !== null && frameCountRef.current >= nextSuperWeaponSpawnFrameRef.current) {
                    // Generate spawn position that avoids player's x position and player bullets/missiles
                    const PLAYER_AVOID_ZONE = 80
                    const BULLET_AVOID_ZONE = 50
                    let spawnX
                    let attempts = 0
                    do {
                        spawnX = Math.random() * (CANVAS_WIDTH - LIFE_POWERUP_SIZE * 2) + LIFE_POWERUP_SIZE
                        attempts++
                        const tooCloseToPlayer = Math.abs(spawnX - player.x) < PLAYER_AVOID_ZONE
                        const hasBulletInPath = bulletsRef.current.some(bullet => {
                            const bulletCenterX = bullet.x
                            return Math.abs(spawnX - bulletCenterX) < BULLET_AVOID_ZONE && bullet.y < CANVAS_HEIGHT * 0.3
                        })
                        const hasMissileInPath = homingMissilesRef.current.some(missile => {
                            const missileCenterX = missile.x + missile.width / 2
                            return Math.abs(spawnX - missileCenterX) < BULLET_AVOID_ZONE && missile.y < CANVAS_HEIGHT * 0.3
                        })
                        if (tooCloseToPlayer || hasBulletInPath || hasMissileInPath) spawnX = null
                    } while (spawnX === null && attempts < 30)
                    
                    if (spawnX !== null) {
                        superWeaponPowerupsRef.current.push({
                            x: spawnX,
                            y: -LIFE_POWERUP_SIZE,
                            size: LIFE_POWERUP_SIZE
                        })
                        // Clear the spawn frame - next level advance will schedule a new one
                        nextSuperWeaponSpawnFrameRef.current = null
                    }
                }

                // Spawn clock extender powerups (randomly between 5 and 1.5 seconds before expiration)
                const CLOCK_EXTENDER_SPAWN_WINDOW_START = 5000 // 5 seconds before expiration
                const CLOCK_EXTENDER_SPAWN_WINDOW_END = 1500 // 1.5 seconds before expiration
                const EXTENSION_DURATION = 30000 // 30 seconds in milliseconds
                const clockExtenderSpawned = clockExtenderPowerupsRef.current.length > 0
                
                // Check if any powerup is in the spawn window (between 5 and 1.5 seconds before expiration)
                const now = Date.now()
                const clockExtenderSpawnChance = 0.02 // 2% chance per frame when in window
                
                // Check score multiplier
                if (scoreMultiplierEndTime && !clockExtenderSpawnedForScoreMultiplierRef.current && !clockExtenderDisabledForScoreMultiplierRef.current) {
                    const timeRemaining = scoreMultiplierEndTime - now
                    if (timeRemaining <= CLOCK_EXTENDER_SPAWN_WINDOW_START && timeRemaining >= CLOCK_EXTENDER_SPAWN_WINDOW_END && !clockExtenderSpawned) {
                        if (Math.random() < clockExtenderSpawnChance) {
                            clockExtenderSpawnedForScoreMultiplierRef.current = true
                            const PLAYER_AVOID_ZONE = 80
                            const BULLET_AVOID_ZONE = 50
                            let spawnX
                            let attempts = 0
                            do {
                                spawnX = Math.random() * (CANVAS_WIDTH - LIFE_POWERUP_SIZE * 2) + LIFE_POWERUP_SIZE
                                attempts++
                                const tooCloseToPlayer = Math.abs(spawnX - player.x) < PLAYER_AVOID_ZONE
                                const hasBulletInPath = bulletsRef.current.some(bullet => {
                                    const bulletCenterX = bullet.x
                                    return Math.abs(spawnX - bulletCenterX) < BULLET_AVOID_ZONE && bullet.y < CANVAS_HEIGHT * 0.3
                                })
                                const hasMissileInPath = homingMissilesRef.current.some(missile => {
                                    const missileCenterX = missile.x + missile.width / 2
                                    return Math.abs(spawnX - missileCenterX) < BULLET_AVOID_ZONE && missile.y < CANVAS_HEIGHT * 0.3
                                })
                                if (tooCloseToPlayer || hasBulletInPath || hasMissileInPath) spawnX = null
                            } while (spawnX === null && attempts < 30)
                            
                            if (spawnX !== null) {
                                clockExtenderPowerupsRef.current.push({
                                    x: spawnX,
                                    y: -LIFE_POWERUP_SIZE,
                                    size: LIFE_POWERUP_SIZE
                                })
                            }
                        }
                    }
                }
                
                // Check magic defence
                if (magicDefenceEndTime && !clockExtenderSpawnedForMagicDefenceRef.current && !clockExtenderDisabledForMagicDefenceRef.current) {
                    const timeRemaining = magicDefenceEndTime - now
                    if (timeRemaining <= CLOCK_EXTENDER_SPAWN_WINDOW_START && timeRemaining >= CLOCK_EXTENDER_SPAWN_WINDOW_END && !clockExtenderSpawned) {
                        if (Math.random() < clockExtenderSpawnChance) {
                            clockExtenderSpawnedForMagicDefenceRef.current = true
                            const PLAYER_AVOID_ZONE = 80
                            const BULLET_AVOID_ZONE = 50
                            let spawnX
                            let attempts = 0
                            do {
                                spawnX = Math.random() * (CANVAS_WIDTH - LIFE_POWERUP_SIZE * 2) + LIFE_POWERUP_SIZE
                                attempts++
                                const tooCloseToPlayer = Math.abs(spawnX - player.x) < PLAYER_AVOID_ZONE
                                const hasBulletInPath = bulletsRef.current.some(bullet => {
                                    const bulletCenterX = bullet.x
                                    return Math.abs(spawnX - bulletCenterX) < BULLET_AVOID_ZONE && bullet.y < CANVAS_HEIGHT * 0.3
                                })
                                const hasMissileInPath = homingMissilesRef.current.some(missile => {
                                    const missileCenterX = missile.x + missile.width / 2
                                    return Math.abs(spawnX - missileCenterX) < BULLET_AVOID_ZONE && missile.y < CANVAS_HEIGHT * 0.3
                                })
                                if (tooCloseToPlayer || hasBulletInPath || hasMissileInPath) spawnX = null
                            } while (spawnX === null && attempts < 30)
                            
                            if (spawnX !== null) {
                                clockExtenderPowerupsRef.current.push({
                                    x: spawnX,
                                    y: -LIFE_POWERUP_SIZE,
                                    size: LIFE_POWERUP_SIZE
                                })
                            }
                        }
                    }
                }
                
                // Check super weapon
                if (superWeaponEndTime && !clockExtenderSpawnedForSuperWeaponRef.current && !clockExtenderDisabledForSuperWeaponRef.current) {
                    const timeRemaining = superWeaponEndTime - now
                    if (timeRemaining <= CLOCK_EXTENDER_SPAWN_WINDOW_START && timeRemaining >= CLOCK_EXTENDER_SPAWN_WINDOW_END && !clockExtenderSpawned) {
                        if (Math.random() < clockExtenderSpawnChance) {
                            clockExtenderSpawnedForSuperWeaponRef.current = true
                            const PLAYER_AVOID_ZONE = 80
                            const BULLET_AVOID_ZONE = 50
                            let spawnX
                            let attempts = 0
                            do {
                                spawnX = Math.random() * (CANVAS_WIDTH - LIFE_POWERUP_SIZE * 2) + LIFE_POWERUP_SIZE
                                attempts++
                                const tooCloseToPlayer = Math.abs(spawnX - player.x) < PLAYER_AVOID_ZONE
                                const hasBulletInPath = bulletsRef.current.some(bullet => {
                                    const bulletCenterX = bullet.x
                                    return Math.abs(spawnX - bulletCenterX) < BULLET_AVOID_ZONE && bullet.y < CANVAS_HEIGHT * 0.3
                                })
                                const hasMissileInPath = homingMissilesRef.current.some(missile => {
                                    const missileCenterX = missile.x + missile.width / 2
                                    return Math.abs(spawnX - missileCenterX) < BULLET_AVOID_ZONE && missile.y < CANVAS_HEIGHT * 0.3
                                })
                                if (tooCloseToPlayer || hasBulletInPath || hasMissileInPath) spawnX = null
                            } while (spawnX === null && attempts < 30)
                            
                            if (spawnX !== null) {
                                clockExtenderPowerupsRef.current.push({
                                    x: spawnX,
                                    y: -LIFE_POWERUP_SIZE,
                                    size: LIFE_POWERUP_SIZE
                                })
                            }
                        }
                    }
                }
                
                // Reset spawn flags when powerups expire
                if (!scoreMultiplierEndTime) {
                    clockExtenderSpawnedForScoreMultiplierRef.current = false
                    clockExtenderDisabledForScoreMultiplierRef.current = false
                }
                if (!magicDefenceEndTime) {
                    clockExtenderSpawnedForMagicDefenceRef.current = false
                    clockExtenderDisabledForMagicDefenceRef.current = false
                }
                if (!superWeaponEndTime) {
                    clockExtenderSpawnedForSuperWeaponRef.current = false
                    clockExtenderDisabledForSuperWeaponRef.current = false
                }

                // Update life powerups
                lifePowerupsRef.current = lifePowerupsRef.current
                    .map(powerup => ({ ...powerup, y: powerup.y + LIFE_POWERUP_SPEED }))
                    .filter(powerup => {
                        if (powerup.y > CANVAS_HEIGHT) return false
                        
                        // Collision with player (collect powerup)
                        const distance = Math.sqrt(
                            Math.pow(powerup.x - player.x, 2) + 
                            Math.pow(powerup.y - player.y, 2)
                        )
                        if (distance < powerup.size + 20) {
                            setLives(prev => prev + 1)
                            // Powerup collect sound
                            if (soundEnabledRef.current) {
                                createSound(400, 0.1, 'square', 0.15)
                                setTimeout(() => createSound(600, 0.1, 'square', 0.15), 50)
                            }
                            return false
                        }
                        return true
                    })

                // Update 3X score bonus powerups
                scoreBonusPowerupsRef.current = scoreBonusPowerupsRef.current
                    .map(powerup => ({ ...powerup, y: powerup.y + LIFE_POWERUP_SPEED }))
                    .filter(powerup => {
                        if (powerup.y > CANVAS_HEIGHT) return false
                        
                        // Collision with player (collect powerup)
                        const distance = Math.sqrt(
                            Math.pow(powerup.x - player.x, 2) + 
                            Math.pow(powerup.y - player.y, 2)
                        )
                        if (distance < powerup.size + 20) {
                            // Activate 3X score multiplier for 20 seconds
                            setScoreMultiplier(3)
                            setScoreMultiplierEndTime(Date.now() + POWERUP_DURATION_SECONDS * 1000)
                            // 50% chance this powerup won't get a clock extender
                            clockExtenderDisabledForScoreMultiplierRef.current = Math.random() < 0.5
                            // Powerup collect sound
                            if (soundEnabledRef.current) {
                                createSound(500, 0.1, 'square', 0.15)
                                setTimeout(() => createSound(600, 0.1, 'square', 0.15), 50)
                                setTimeout(() => createSound(700, 0.1, 'square', 0.15), 100)
                            }
                            return false
                        }
                        return true
                    })

                // Update magic defence powerups
                magicDefencePowerupsRef.current = magicDefencePowerupsRef.current
                    .map(powerup => ({ ...powerup, y: powerup.y + LIFE_POWERUP_SPEED }))
                    .filter(powerup => {
                        if (powerup.y > CANVAS_HEIGHT) return false
                        
                        // Collision with player (collect powerup)
                        const distance = Math.sqrt(
                            Math.pow(powerup.x - player.x, 2) + 
                            Math.pow(powerup.y - player.y, 2)
                        )
                        if (distance < powerup.size + 20) {
                            // Activate magic defence for 20 seconds
                            setMagicDefenceActive(true)
                            setMagicDefenceEndTime(Date.now() + POWERUP_DURATION_SECONDS * 1000)
                            // 50% chance this powerup won't get a clock extender
                            clockExtenderDisabledForMagicDefenceRef.current = Math.random() < 0.5
                            // Powerup collect sound
                            if (soundEnabledRef.current) {
                                createSound(600, 0.1, 'square', 0.15)
                                setTimeout(() => createSound(700, 0.1, 'square', 0.15), 50)
                                setTimeout(() => createSound(800, 0.1, 'square', 0.15), 100)
                            }
                            return false
                        }
                        return true
                    })

                // Update super weapon powerups
                superWeaponPowerupsRef.current = superWeaponPowerupsRef.current
                    .map(powerup => ({ ...powerup, y: powerup.y + LIFE_POWERUP_SPEED }))
                    .filter(powerup => {
                        if (powerup.y > CANVAS_HEIGHT) return false
                        
                        // Collision with player (collect powerup)
                        const distance = Math.sqrt(
                            Math.pow(powerup.x - player.x, 2) + 
                            Math.pow(powerup.y - player.y, 2)
                        )
                        if (distance < powerup.size + 20) {
                            // Activate super weapon for 20 seconds
                            setSuperWeaponActive(true)
                            setSuperWeaponEndTime(Date.now() + POWERUP_DURATION_SECONDS * 1000)
                            // 50% chance this powerup won't get a clock extender
                            clockExtenderDisabledForSuperWeaponRef.current = Math.random() < 0.5
                            // Powerup collect sound
                            if (soundEnabledRef.current) {
                                createSound(700, 0.1, 'square', 0.15)
                                setTimeout(() => createSound(800, 0.1, 'square', 0.15), 50)
                                setTimeout(() => createSound(900, 0.1, 'square', 0.15), 100)
                            }
                            return false
                        }
                        return true
                    })

                // Update clock extender powerups
                const CLOCK_EXTENDER_SPEED = LIFE_POWERUP_SPEED * 2.2 * 1.15 // 2.53x faster than other powerups (2.2 * 1.15)
                clockExtenderPowerupsRef.current = clockExtenderPowerupsRef.current
                    .map(powerup => ({ ...powerup, y: powerup.y + CLOCK_EXTENDER_SPEED }))
                    .filter(powerup => {
                        if (powerup.y > CANVAS_HEIGHT) return false
                        
                        // Collision with player (collect powerup)
                        const distance = Math.sqrt(
                            Math.pow(powerup.x - player.x, 2) + 
                            Math.pow(powerup.y - player.y, 2)
                        )
                        if (distance < powerup.size + 20) {
                            // Extend all active powerup timers by 30 seconds
                            const EXTENSION_DURATION = 30000
                            
                            if (scoreMultiplierEndTime) {
                                setScoreMultiplierEndTime(scoreMultiplierEndTime + EXTENSION_DURATION)
                                clockExtenderSpawnedForScoreMultiplierRef.current = false // Reset flag to allow another spawn
                            }
                            if (magicDefenceEndTime) {
                                setMagicDefenceEndTime(magicDefenceEndTime + EXTENSION_DURATION)
                                clockExtenderSpawnedForMagicDefenceRef.current = false // Reset flag to allow another spawn
                            }
                            if (superWeaponEndTime) {
                                setSuperWeaponEndTime(superWeaponEndTime + EXTENSION_DURATION)
                                clockExtenderSpawnedForSuperWeaponRef.current = false // Reset flag to allow another spawn
                            }
                            
                            // Powerup collect sound
                            if (soundEnabledRef.current) {
                                createSound(800, 0.1, 'square', 0.15)
                                setTimeout(() => createSound(900, 0.1, 'square', 0.15), 50)
                                setTimeout(() => createSound(1000, 0.1, 'square', 0.15), 100)
                            }
                            return false
                        }
                        return true
                    })

                // Update enemies (using level-based speed with horizontal movement)
                enemiesRef.current = enemiesRef.current
                    .map(enemy => {
                        // Move vertically
                        let newY = enemy.y + currentEnemySpeed
                        
                        // Move horizontally and handle boundary bouncing
                        let newX = enemy.x + (enemy.vx || 0)
                        let newVx = enemy.vx || 0
                        
                        // Bounce off left and right edges
                        if (newX < 0 || newX + enemy.width > CANVAS_WIDTH) {
                            newVx = -newVx // Reverse direction
                            newX = Math.max(0, Math.min(CANVAS_WIDTH - enemy.width, newX)) // Clamp to bounds
                        }
                        
                        // Mega enemies fire bullets at the player
                        let lastShotFrame = enemy.lastShotFrame
                        // Only shoot if enemy is at or above the player's y position (can't shoot upward)
                        if (enemy.isMega && enemy.y > 0 && enemy.y < CANVAS_HEIGHT - 100 && enemy.y <= player.y) {
                            // Fire rate varies by level (slow at low levels, rapid at high levels)
                            const fireRate = megaEnemyFireRate
                            // If lastShotFrame is null, allow immediate firing (set to a value that will trigger firing)
                            const framesSinceLastShot = lastShotFrame === null 
                                ? fireRate // Allow immediate firing if hasn't shot yet
                                : frameCountRef.current - lastShotFrame
                            if (framesSinceLastShot >= fireRate) {
                                // Shoot at player
                                const dx = player.x - (enemy.x + enemy.width / 2)
                                const dy = player.y - (enemy.y + enemy.height)
                                const distance = Math.sqrt(dx * dx + dy * dy)
                                const angle = Math.atan2(dy, dx)
                                
                                enemyBulletsRef.current.push({
                                    x: enemy.x + enemy.width / 2,
                                    y: enemy.y + enemy.height,
                                    width: 4,
                                    height: 8,
                                    vx: Math.cos(angle) * ENEMY_BULLET_SPEED,
                                    vy: Math.sin(angle) * ENEMY_BULLET_SPEED
                                })
                                
                                lastShotFrame = frameCountRef.current
                                
                                // Enemy shoot sound (quieter, different pitch)
                                if (soundEnabledRef.current) {
                                    const ctx = getAudioContext()
                                    if (ctx) {
                                        try {
                                            const oscillator = ctx.createOscillator()
                                            const gainNode = ctx.createGain()
                                            oscillator.connect(gainNode)
                                            gainNode.connect(ctx.destination)
                                            oscillator.type = 'sawtooth'
                                            oscillator.frequency.setValueAtTime(800, ctx.currentTime)
                                            oscillator.frequency.exponentialRampToValueAtTime(200, ctx.currentTime + 0.1)
                                            gainNode.gain.setValueAtTime(0.025, ctx.currentTime)
                                            gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1)
                                            oscillator.start(ctx.currentTime)
                                            oscillator.stop(ctx.currentTime + 0.1)
                                        } catch (e) {}
                                    }
                                }
                            }
                        }
                        
                        return { ...enemy, x: newX, y: newY, vx: newVx, lastShotFrame }
                    })
                    .filter(enemy => {
                        if (enemy.y > CANVAS_HEIGHT) return false
                        
                        // Collision with player
                        if (
                            enemy.x < player.x + 20 &&
                            enemy.x + enemy.width > player.x - 20 &&
                            enemy.y < player.y + 20 &&
                            enemy.y + enemy.height > player.y - 20
                        ) {
                            if (magicDefenceActive) {
                                // Magic defence active: give points instead of losing life
                                const basePoints = enemy.isMega ? 500 : 100
                                setScore(prev => prev + (basePoints * scoreMultiplier))
                                // Defence hit sound
                                if (soundEnabledRef.current) createSound(200, 0.1, 'sawtooth', 0.2)
                            } else {
                                // Normal collision: lose life
                                setLives(prev => {
                                    const newLives = prev - 1
                                    // Lose life sound
                                    if (soundEnabledRef.current) createSound(150, 0.3, 'sawtooth', 0.25)
                                    if (newLives <= 0) {
                                        gameOver()
                                    }
                                    return newLives
                                })
                            }
                            return false
                        }
                        return true
                    })

                // Bullet-enemy collisions
                bulletsRef.current = bulletsRef.current.filter(bullet => {
                    // Check collision with enemies
                    const hitEnemy = enemiesRef.current.findIndex(enemy => {
                        if (
                            bullet.x < enemy.x + enemy.width &&
                            bullet.x + bullet.width > enemy.x &&
                            bullet.y < enemy.y + enemy.height &&
                            bullet.y + bullet.height > enemy.y
                        ) {
                            return true
                        }
                        return false
                    })

                    if (hitEnemy !== -1) {
                        const destroyedEnemy = enemiesRef.current[hitEnemy]
                        enemiesRef.current.splice(hitEnemy, 1)
                        // Mega enemies give 500 points, regular enemies give 100
                        const basePoints = destroyedEnemy.isMega ? 500 : 100
                        setScore(prev => prev + (basePoints * scoreMultiplier))
                        // Enemy hit sound
                        if (soundEnabledRef.current) createSound(200, 0.1, 'sawtooth', 0.2)
                        return false
                    }

                    return true
                })

                // Homing missile-enemy collisions
                const missilesToRemove = new Set()
                const enemiesToRemove = []
                
                homingMissilesRef.current.forEach((missile, missileIndex) => {
                    // Check collision with enemies
                    const hitEnemy = enemiesRef.current.findIndex(enemy => {
                        const missileCenterX = missile.x + missile.width / 2
                        const missileCenterY = missile.y + missile.height / 2
                        const enemyCenterX = enemy.x + enemy.width / 2
                        const enemyCenterY = enemy.y + enemy.height / 2
                        
                        const distance = Math.sqrt(
                            Math.pow(missileCenterX - enemyCenterX, 2) +
                            Math.pow(missileCenterY - enemyCenterY, 2)
                        )
                        
                        // Collision detection with reasonable hitbox
                        return distance < (missile.width + Math.max(enemy.width, enemy.height)) / 2
                    })

                    if (hitEnemy !== -1 && !enemiesToRemove.includes(hitEnemy)) {
                        const destroyedEnemy = enemiesRef.current[hitEnemy]
                        const enemyCenterX = destroyedEnemy.x + destroyedEnemy.width / 2
                        const enemyCenterY = destroyedEnemy.y + destroyedEnemy.height / 2
                        const BLAST_RADIUS = 60 // Radius for blast effect
                        
                        // Mark this missile for removal
                        missilesToRemove.add(missileIndex)
                        
                        // Mark enemy for removal
                        enemiesToRemove.push(hitEnemy)
                        
                        // Find and mark all nearby missiles for destruction (blast effect)
                        homingMissilesRef.current.forEach((otherMissile, otherIndex) => {
                            if (otherIndex !== missileIndex && !missilesToRemove.has(otherIndex)) {
                                const otherMissileCenterX = otherMissile.x + otherMissile.width / 2
                                const otherMissileCenterY = otherMissile.y + otherMissile.height / 2
                                
                                const distanceToBlast = Math.sqrt(
                                    Math.pow(otherMissileCenterX - enemyCenterX, 2) +
                                    Math.pow(otherMissileCenterY - enemyCenterY, 2)
                                )
                                
                                if (distanceToBlast < BLAST_RADIUS) {
                                    missilesToRemove.add(otherIndex)
                                }
                            }
                        })
                        
                        // Mega enemies give 500 points, regular enemies give 100
                        const basePoints = destroyedEnemy.isMega ? 500 : 100
                        setScore(prev => prev + (basePoints * scoreMultiplier))
                        // Enemy hit sound
                        if (soundEnabledRef.current) createSound(200, 0.1, 'sawtooth', 0.2)
                    }
                })
                
                // Remove destroyed enemies (in reverse order to maintain indices)
                enemiesToRemove.sort((a, b) => b - a).forEach(index => {
                    enemiesRef.current.splice(index, 1)
                })
                
                // Remove destroyed missiles (in reverse order to maintain indices)
                const missilesIndicesToRemove = Array.from(missilesToRemove).sort((a, b) => b - a)
                missilesIndicesToRemove.forEach(index => {
                    homingMissilesRef.current.splice(index, 1)
                })

                // Check collision with life powerups (destroy powerup if shot)
                bulletsRef.current = bulletsRef.current.filter(bullet => {
                    // Check collision with life powerups (destroy powerup if shot)
                    const hitLifePowerup = lifePowerupsRef.current.findIndex(powerup => {
                        const distance = Math.sqrt(
                            Math.pow(bullet.x - powerup.x, 2) + 
                            Math.pow(bullet.y - powerup.y, 2)
                        )
                        return distance < powerup.size
                    })

                    if (hitLifePowerup !== -1) {
                        lifePowerupsRef.current.splice(hitLifePowerup, 1)
                        return false
                    }

                    // Check collision with 3X score bonus powerups (destroy powerup if shot)
                    const hitScoreBonusPowerup = scoreBonusPowerupsRef.current.findIndex(powerup => {
                        const distance = Math.sqrt(
                            Math.pow(bullet.x - powerup.x, 2) + 
                            Math.pow(bullet.y - powerup.y, 2)
                        )
                        return distance < powerup.size
                    })

                    if (hitScoreBonusPowerup !== -1) {
                        scoreBonusPowerupsRef.current.splice(hitScoreBonusPowerup, 1)
                        return false
                    }

                    // Check collision with magic defence powerups (destroy powerup if shot)
                    const hitMagicDefencePowerup = magicDefencePowerupsRef.current.findIndex(powerup => {
                        const distance = Math.sqrt(
                            Math.pow(bullet.x - powerup.x, 2) + 
                            Math.pow(bullet.y - powerup.y, 2)
                        )
                        return distance < powerup.size
                    })

                    if (hitMagicDefencePowerup !== -1) {
                        magicDefencePowerupsRef.current.splice(hitMagicDefencePowerup, 1)
                        return false
                    }

                    // Check collision with super weapon powerups (destroy powerup if shot)
                    const hitSuperWeaponPowerup = superWeaponPowerupsRef.current.findIndex(powerup => {
                        const distance = Math.sqrt(
                            Math.pow(bullet.x - powerup.x, 2) + 
                            Math.pow(bullet.y - powerup.y, 2)
                        )
                        return distance < powerup.size
                    })

                    if (hitSuperWeaponPowerup !== -1) {
                        superWeaponPowerupsRef.current.splice(hitSuperWeaponPowerup, 1)
                        return false
                    }

                    // Check collision with clock extender powerups (destroy powerup if shot)
                    const hitClockExtenderPowerup = clockExtenderPowerupsRef.current.findIndex(powerup => {
                        const distance = Math.sqrt(
                            Math.pow(bullet.x - powerup.x, 2) + 
                            Math.pow(bullet.y - powerup.y, 2)
                        )
                        return distance < powerup.size
                    })

                    if (hitClockExtenderPowerup !== -1) {
                        clockExtenderPowerupsRef.current.splice(hitClockExtenderPowerup, 1)
                        return false
                    }

                    return true
                })

                // Draw player
                ctx.fillStyle = '#00FFFF'
                ctx.beginPath()
                ctx.moveTo(player.x, player.y - 25)
                ctx.lineTo(player.x - 15, player.y + 15)
                ctx.lineTo(player.x, player.y + 5)
                ctx.lineTo(player.x + 15, player.y + 15)
                ctx.closePath()
                ctx.fill()
                
                // Player glow
                ctx.shadowBlur = 15
                ctx.shadowColor = '#00FFFF'
                ctx.fill()
                ctx.shadowBlur = 0

                // Draw magic defence shield (circular, fading as time runs out)
                if (magicDefenceActive && magicDefenceEndTime) {
                    const timeRemaining = (magicDefenceEndTime - Date.now()) / 1000
                    const maxTime = POWERUP_DURATION_SECONDS
                    const opacity = Math.max(0.3, timeRemaining / maxTime) // Fade from 1.0 to 0.3
                    
                    ctx.save()
                    ctx.globalAlpha = opacity
                    ctx.strokeStyle = '#800080'
                    ctx.lineWidth = 3
                    ctx.beginPath()
                    ctx.arc(player.x, player.y, 30, 0, Math.PI * 2)
                    ctx.stroke()
                    
                    // Shield glow
                    ctx.shadowBlur = 20
                    ctx.shadowColor = '#800080'
                    ctx.stroke()
                    ctx.shadowBlur = 0
                    ctx.restore()
                }

                // Draw bullets
                ctx.fillStyle = '#FFFF00'
                bulletsRef.current.forEach(bullet => {
                    ctx.fillRect(bullet.x - bullet.width / 2, bullet.y, bullet.width, bullet.height)
                })

                // Draw homing missiles
                ctx.fillStyle = '#FF6600'
                ctx.strokeStyle = '#FFA500'
                ctx.lineWidth = 1.5
                homingMissilesRef.current.forEach(missile => {
                    ctx.save()
                    const centerX = missile.x + missile.width / 2
                    const centerY = missile.y + missile.height / 2
                    
                    // Missile body (pointed shape)
                    ctx.beginPath()
                    ctx.moveTo(centerX, centerY - missile.height / 2) // Top point
                    ctx.lineTo(centerX - missile.width / 2, centerY + missile.height / 2) // Bottom left
                    ctx.lineTo(centerX, centerY + missile.height / 2 - 2) // Bottom center
                    ctx.lineTo(centerX + missile.width / 2, centerY + missile.height / 2) // Bottom right
                    ctx.closePath()
                    ctx.fill()
                    ctx.stroke()
                    
                    // Glow effect
                    ctx.shadowBlur = 8
                    ctx.shadowColor = '#FF6600'
                    ctx.fill()
                    ctx.shadowBlur = 0
                    
                    ctx.restore()
                })

                // Draw enemy bullets
                ctx.fillStyle = '#FF4444'
                enemyBulletsRef.current.forEach(bullet => {
                    ctx.fillRect(bullet.x - bullet.width / 2, bullet.y, bullet.width, bullet.height)
                })

                // Draw enemies
                enemiesRef.current.forEach(enemy => {
                    ctx.fillStyle = '#FF00FF'
                    ctx.beginPath()
                    ctx.arc(enemy.x + enemy.width / 2, enemy.y + enemy.height / 2, enemy.width / 2, 0, Math.PI * 2)
                    ctx.fill()
                    
                    // Enemy glow
                    ctx.shadowBlur = 10
                    ctx.shadowColor = '#FF00FF'
                    ctx.fill()
                    ctx.shadowBlur = 0

                    // Enemy details or skull for mega enemies
                    if (enemy.isMega) {
                        // Draw skull symbol
                        ctx.fillStyle = '#FFFFFF'
                        ctx.strokeStyle = '#000000'
                        ctx.lineWidth = 2
                        
                        const centerX = enemy.x + enemy.width / 2
                        const centerY = enemy.y + enemy.height / 2
                        const size = enemy.width / 3
                        
                        // Skull shape (simplified 80's style)
                        ctx.beginPath()
                        // Head (circle)
                        ctx.arc(centerX, centerY - size * 0.2, size * 0.7, 0, Math.PI * 2)
                        ctx.fill()
                        ctx.stroke()
                        
                        // Eye sockets
                        ctx.fillStyle = '#000000'
                        ctx.beginPath()
                        ctx.arc(centerX - size * 0.25, centerY - size * 0.3, size * 0.15, 0, Math.PI * 2)
                        ctx.arc(centerX + size * 0.25, centerY - size * 0.3, size * 0.15, 0, Math.PI * 2)
                        ctx.fill()
                        
                        // Jaw/teeth (simple triangle)
                        ctx.fillStyle = '#FFFFFF'
                        ctx.strokeStyle = '#000000'
                        ctx.beginPath()
                        ctx.moveTo(centerX - size * 0.4, centerY + size * 0.1)
                        ctx.lineTo(centerX, centerY + size * 0.6)
                        ctx.lineTo(centerX + size * 0.4, centerY + size * 0.1)
                        ctx.closePath()
                        ctx.fill()
                        ctx.stroke()
                        
                        ctx.lineWidth = 1
                    } else {
                        // Regular enemy details
                        ctx.fillStyle = '#FF0088'
                        ctx.beginPath()
                        ctx.arc(enemy.x + enemy.width / 2, enemy.y + enemy.height / 2, enemy.width / 4, 0, Math.PI * 2)
                        ctx.fill()
                    }
                })

                // Draw life powerups
                lifePowerupsRef.current.forEach(powerup => {
                    // Blue circle
                    ctx.fillStyle = '#0088FF'
                    ctx.beginPath()
                    ctx.arc(powerup.x, powerup.y, powerup.size, 0, Math.PI * 2)
                    ctx.fill()
                    
                    // Powerup glow
                    ctx.shadowBlur = 15
                    ctx.shadowColor = '#0088FF'
                    ctx.fill()
                    ctx.shadowBlur = 0

                    // "+1" text
                    ctx.fillStyle = '#FFFFFF'
                    ctx.textAlign = 'center'
                    ctx.textBaseline = 'middle'
                    ctx.font = 'bold 14px "Courier New", monospace'
                    ctx.fillText('+1', powerup.x, powerup.y)
                    ctx.textAlign = 'left'
                    ctx.textBaseline = 'alphabetic'
                })

                // Draw 3X score bonus powerups
                scoreBonusPowerupsRef.current.forEach(powerup => {
                    ctx.save()
                    
                    // Outer glow for shiny effect
                    ctx.shadowBlur = 20
                    ctx.shadowColor = '#00FF00'
                    ctx.fillStyle = '#32CD32'
                    ctx.beginPath()
                    ctx.arc(powerup.x, powerup.y, powerup.size, 0, Math.PI * 2)
                    ctx.fill()
                    
                    // Bright shiny green gradient circle
                    const gradient = ctx.createRadialGradient(
                        powerup.x - powerup.size * 0.3, 
                        powerup.y - powerup.size * 0.3, 
                        0,
                        powerup.x, 
                        powerup.y, 
                        powerup.size
                    )
                    gradient.addColorStop(0, '#ADFF2F') // Bright yellow-green
                    gradient.addColorStop(0.5, '#32CD32') // Lime green
                    gradient.addColorStop(1, '#228B22') // Forest green
                    ctx.fillStyle = gradient
                    ctx.shadowBlur = 0
                    ctx.beginPath()
                    ctx.arc(powerup.x, powerup.y, powerup.size, 0, Math.PI * 2)
                    ctx.fill()
                    
                    // Additional inner glow for shine
                    ctx.shadowBlur = 8
                    ctx.shadowColor = '#ADFF2F'
                    ctx.fill()
                    ctx.shadowBlur = 0

                    // "3X" text
                    ctx.fillStyle = '#FFFFFF'
                    ctx.textAlign = 'center'
                    ctx.textBaseline = 'middle'
                    ctx.font = 'bold 14px "Courier New", monospace'
                    ctx.fillText('3X', powerup.x, powerup.y)
                    ctx.textAlign = 'left'
                    ctx.textBaseline = 'alphabetic'
                    
                    ctx.restore()
                })

                // Draw magic defence powerups
                magicDefencePowerupsRef.current.forEach(powerup => {
                    ctx.save()
                    
                    // Aura effect - multiple glowing layers
                    const auraColors = [
                        { color: '#9370DB', opacity: 0.4, blur: 25, radius: powerup.size * 1.4 },
                        { color: '#8A2BE2', opacity: 0.3, blur: 20, radius: powerup.size * 1.2 },
                        { color: '#6A0DAD', opacity: 0.2, blur: 15, radius: powerup.size * 1.0 }
                    ]
                    
                    auraColors.forEach(aura => {
                        ctx.globalAlpha = aura.opacity
                        ctx.shadowBlur = aura.blur
                        ctx.shadowColor = aura.color
                        ctx.fillStyle = aura.color
                        ctx.beginPath()
                        ctx.arc(powerup.x, powerup.y, aura.radius, 0, Math.PI * 2)
                        ctx.fill()
                    })
                    
                    ctx.shadowBlur = 0
                    ctx.globalAlpha = 1.0
                    
                    // Base circle with purple-blue gradient effect
                    const gradient = ctx.createRadialGradient(
                        powerup.x - powerup.size * 0.3, 
                        powerup.y - powerup.size * 0.3, 
                        0,
                        powerup.x, 
                        powerup.y, 
                        powerup.size
                    )
                    gradient.addColorStop(0, '#9370DB')
                    gradient.addColorStop(0.5, '#8A2BE2')
                    gradient.addColorStop(1, '#4B0082')
                    ctx.fillStyle = gradient
                    ctx.beginPath()
                    ctx.arc(powerup.x, powerup.y, powerup.size, 0, Math.PI * 2)
                    ctx.fill()
                    
                    // Inner glow
                    ctx.shadowBlur = 10
                    ctx.shadowColor = '#9370DB'
                    ctx.fill()
                    ctx.shadowBlur = 0
                    
                    ctx.restore()
                })

                // Draw super weapon powerups
                superWeaponPowerupsRef.current.forEach(powerup => {
                    ctx.save()
                    
                    // Bright orange circle with glow
                    const gradient = ctx.createRadialGradient(
                        powerup.x - powerup.size * 0.3, 
                        powerup.y - powerup.size * 0.3, 
                        0,
                        powerup.x, 
                        powerup.y, 
                        powerup.size
                    )
                    gradient.addColorStop(0, '#FFA500') // Bright orange
                    gradient.addColorStop(0.5, '#FF8C00') // Darker orange
                    gradient.addColorStop(1, '#FF6600') // Deep orange
                    ctx.fillStyle = gradient
                    ctx.beginPath()
                    ctx.arc(powerup.x, powerup.y, powerup.size, 0, Math.PI * 2)
                    ctx.fill()
                    
                    // Outer glow
                    ctx.shadowBlur = 20
                    ctx.shadowColor = '#FFA500'
                    ctx.fill()
                    ctx.shadowBlur = 0

                    // Weapon symbol (crosshair/target style)
                    ctx.fillStyle = '#FFFFFF'
                    ctx.strokeStyle = '#000000'
                    ctx.lineWidth = 2
                    
                    const centerX = powerup.x
                    const centerY = powerup.y
                    const symbolSize = powerup.size * 0.5
                    
                    // Crosshair lines
                    ctx.beginPath()
                    // Horizontal line
                    ctx.moveTo(centerX - symbolSize, centerY)
                    ctx.lineTo(centerX + symbolSize, centerY)
                    // Vertical line
                    ctx.moveTo(centerX, centerY - symbolSize)
                    ctx.lineTo(centerX, centerY + symbolSize)
                    ctx.stroke()
                    
                    // Center circle
                    ctx.beginPath()
                    ctx.arc(centerX, centerY, symbolSize * 0.3, 0, Math.PI * 2)
                    ctx.fill()
                    ctx.stroke()
                    
                    // Outer circle
                    ctx.beginPath()
                    ctx.arc(centerX, centerY, symbolSize * 0.7, 0, Math.PI * 2)
                    ctx.stroke()
                    
                    ctx.restore()
                })

                // Draw clock extender powerups
                clockExtenderPowerupsRef.current.forEach(powerup => {
                    ctx.save()
                    
                    // Clock face circle (light gray/white)
                    const gradient = ctx.createRadialGradient(
                        powerup.x - powerup.size * 0.3, 
                        powerup.y - powerup.size * 0.3, 
                        0,
                        powerup.x, 
                        powerup.y, 
                        powerup.size
                    )
                    gradient.addColorStop(0, '#F0F0F0')
                    gradient.addColorStop(0.5, '#E0E0E0')
                    gradient.addColorStop(1, '#C0C0C0')
                    ctx.fillStyle = gradient
                    ctx.beginPath()
                    ctx.arc(powerup.x, powerup.y, powerup.size, 0, Math.PI * 2)
                    ctx.fill()
                    
                    // Outer border
                    ctx.strokeStyle = '#000000'
                    ctx.lineWidth = 2
                    ctx.stroke()
                    
                    // Clock hands (hour and minute)
                    ctx.strokeStyle = '#000000'
                    ctx.lineWidth = 2
                    ctx.lineCap = 'round'
                    
                    const centerX = powerup.x
                    const centerY = powerup.y
                    const clockRadius = powerup.size * 0.8
                    
                    // Hour hand (pointing to 3 o'clock)
                    ctx.beginPath()
                    ctx.moveTo(centerX, centerY)
                    ctx.lineTo(centerX + clockRadius * 0.4, centerY)
                    ctx.stroke()
                    
                    // Minute hand (pointing to 12 o'clock)
                    ctx.beginPath()
                    ctx.moveTo(centerX, centerY)
                    ctx.lineTo(centerX, centerY - clockRadius * 0.6)
                    ctx.stroke()
                    
                    // Center dot
                    ctx.fillStyle = '#000000'
                    ctx.beginPath()
                    ctx.arc(centerX, centerY, 2, 0, Math.PI * 2)
                    ctx.fill()
                    
                    // Clock numbers (12, 3, 6, 9 positions as dots)
                    ctx.fillStyle = '#000000'
                    const dotSize = 2
                    // 12 o'clock
                    ctx.beginPath()
                    ctx.arc(centerX, centerY - clockRadius * 0.75, dotSize, 0, Math.PI * 2)
                    ctx.fill()
                    // 3 o'clock
                    ctx.beginPath()
                    ctx.arc(centerX + clockRadius * 0.75, centerY, dotSize, 0, Math.PI * 2)
                    ctx.fill()
                    // 6 o'clock
                    ctx.beginPath()
                    ctx.arc(centerX, centerY + clockRadius * 0.75, dotSize, 0, Math.PI * 2)
                    ctx.fill()
                    // 9 o'clock
                    ctx.beginPath()
                    ctx.arc(centerX - clockRadius * 0.75, centerY, dotSize, 0, Math.PI * 2)
                    ctx.fill()
                    
                    ctx.restore()
                })
            }

            // Update and draw fireworks (even during celebration) - before context restore
            if (isCelebrating) {
                fireworksRef.current = fireworksRef.current
                    .map(particle => ({
                        ...particle,
                        x: particle.x + particle.vx,
                        y: particle.y + particle.vy,
                        vy: particle.vy + 0.1, // gravity
                        life: particle.life - particle.decay
                    }))
                    .filter(particle => particle.life > 0)
                
                // Draw fireworks (in logical coordinates, before context restore)
                if (fireworksRef.current.length > 0) {
                    fireworksRef.current.forEach(particle => {
                        ctx.save()
                        ctx.globalAlpha = particle.life
                        ctx.fillStyle = particle.color
                        ctx.shadowBlur = 10
                        ctx.shadowColor = particle.color
                        ctx.beginPath()
                        ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2)
                        ctx.fill()
                        ctx.shadowBlur = 0
                        ctx.restore()
                    })
                }
            }

            // Restore context if we scaled it (mobile) - before drawing UI
            if (isMobile) {
                ctx.restore()
            }

            // Draw celebration overlay (HIGH SCORE!) - dimmed background so game remains visible
            if (isCelebrating) {
                ctx.fillStyle = 'rgba(0, 0, 0, 0.4)'
                ctx.fillRect(0, 0, isMobile ? canvas.width : CANVAS_WIDTH, isMobile ? canvas.height : CANVAS_HEIGHT)
                
                ctx.fillStyle = '#FFFF00'
                ctx.textAlign = 'center'
                ctx.textBaseline = 'middle'
                if (isMobile) {
                    const scaleX = canvas.width / CANVAS_WIDTH
                    const scaleY = canvas.height / CANVAS_HEIGHT
                    const fontScale = scaleX
                    ctx.font = `bold ${48 * fontScale}px "Courier New", monospace`
                    ctx.fillText('HIGH SCORE!', canvas.width / 2, (CANVAS_HEIGHT / 2 - 60) * scaleY)
                    ctx.font = `bold ${32 * fontScale}px "Courier New", monospace`
                    ctx.fillText(`${gameStateRef.current.score}`, canvas.width / 2, (CANVAS_HEIGHT / 2 + 20) * scaleY)
                } else {
                    ctx.font = 'bold 48px "Courier New", monospace'
                    ctx.fillText('HIGH SCORE!', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 60)
                    ctx.font = 'bold 32px "Courier New", monospace'
                    ctx.fillText(`${gameStateRef.current.score}`, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 20)
                }
                ctx.textAlign = 'left'
                ctx.textBaseline = 'alphabetic'
            }

            // Draw countdown overlay
            if (countdown > 0 && gameStateRef.current.gameState === 'playing') {
                ctx.fillStyle = 'rgba(0, 0, 0, 0.8)'
                ctx.fillRect(0, 0, isMobile ? canvas.width : CANVAS_WIDTH, isMobile ? canvas.height : CANVAS_HEIGHT)
                
                ctx.fillStyle = '#00FFFF'
                ctx.textAlign = 'center'
                if (isMobile) {
                    const scaleX = canvas.width / CANVAS_WIDTH
                    const scaleY = canvas.height / CANVAS_HEIGHT
                    const fontScale = scaleX
                    ctx.font = `bold ${72 * fontScale}px "Courier New", monospace`
                    ctx.fillText(countdown.toString(), canvas.width / 2, (CANVAS_HEIGHT / 2) * scaleY)
                } else {
                    ctx.font = 'bold 72px "Courier New", monospace'
                    ctx.fillText(countdown.toString(), CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2)
                }
                ctx.textAlign = 'left'
            }

            // Draw level announcement overlay with fade-out
            if (levelAnnouncementStartTimeRef.current && gameStateRef.current.gameState === 'playing' && countdown === 0) {
                const announcementAge = (Date.now() - levelAnnouncementStartTimeRef.current) / 1000 // seconds
                const fadeDuration = 0.5 // fade out over 0.5 seconds
                const showDuration = 1.5 // show fully for 1.5 seconds
                const totalDuration = showDuration + fadeDuration // 2 seconds total
                
                if (announcementAge < totalDuration) {
                    // Calculate opacity: 1.0 for first 1.5s, then fade to 0 over 0.5s
                    let opacity = 1.0
                    if (announcementAge > showDuration) {
                        opacity = 1.0 - ((announcementAge - showDuration) / fadeDuration)
                    }
                    
                    ctx.fillStyle = `rgba(0, 0, 0, ${0.8 * opacity})`
                    ctx.fillRect(0, 0, isMobile ? canvas.width : CANVAS_WIDTH, isMobile ? canvas.height : CANVAS_HEIGHT)
                    
                    ctx.fillStyle = `rgba(0, 255, 255, ${opacity})`
                    ctx.textAlign = 'center'
                    if (isMobile) {
                        const scaleX = canvas.width / CANVAS_WIDTH
                        const scaleY = canvas.height / CANVAS_HEIGHT
                        const fontScale = scaleX
                        ctx.font = `bold ${48 * fontScale}px "Courier New", monospace`
                        ctx.fillText(`LEVEL ${level}`, canvas.width / 2, (CANVAS_HEIGHT / 2 - 40) * scaleY)
                        ctx.font = `${24 * fontScale}px "Courier New", monospace`
                        ctx.fillText('BEGIN!', canvas.width / 2, (CANVAS_HEIGHT / 2 + 40) * scaleY)
                    } else {
                        ctx.font = 'bold 48px "Courier New", monospace'
                        ctx.fillText(`LEVEL ${level}`, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 40)
                        ctx.font = '24px "Courier New", monospace'
                        ctx.fillText('BEGIN!', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 40)
                    }
                    ctx.textAlign = 'left'
                } else {
                    // Clear the ref after fade completes
                    levelAnnouncementStartTimeRef.current = null
                }
            }

            // Draw UI in actual canvas coordinates
            ctx.fillStyle = '#00FFFF'
            if (isMobile) {
                // On mobile, use viewport-relative positioning
                // Canvas resolution matches viewport, so use reasonable fixed values
                const fontSize = Math.max(14, canvas.width / 25) // Scale font with viewport width
                ctx.font = `${fontSize}px "Courier New", monospace`
                const x = 10
                const y1 = fontSize + 5
                const y2 = fontSize * 2 + 10
                const y3 = fontSize * 3 + 15
                const y4 = fontSize * 4 + 20
                ctx.fillText(`Score: ${gameStateRef.current.score}`, x, y1)
                ctx.fillText(`High Score: ${highScore}`, x, y2)
                ctx.fillText(`Level: ${level}`, x, y3)
                ctx.fillText(`Lives: ${gameStateRef.current.lives}`, x, y4)
                
                // Draw 3X multiplier indicator with countdown
                if (scoreMultiplierEndTime) {
                    const timeRemaining = Math.max(0, Math.ceil((scoreMultiplierEndTime - Date.now()) / 1000))
                    if (timeRemaining > 0) {
                        ctx.fillStyle = '#FFFF00'
                        ctx.fillText(`3X Score: ${timeRemaining}s`, x, y4 + fontSize + 5)
                    }
                }
            } else {
                ctx.font = '20px "Courier New", monospace'
                ctx.fillText(`Score: ${gameStateRef.current.score}`, 20, 30)
                ctx.fillText(`High Score: ${highScore}`, 20, 60)
                ctx.fillText(`Level: ${level}`, 20, 90)
                ctx.fillText(`Lives: ${gameStateRef.current.lives}`, 20, 120)
                
                // Draw 3X multiplier indicator with countdown
                if (scoreMultiplierEndTime) {
                    const timeRemaining = Math.max(0, Math.ceil((scoreMultiplierEndTime - Date.now()) / 1000))
                    if (timeRemaining > 0) {
                        ctx.fillStyle = '#FFFF00'
                        ctx.fillText(`3X Score: ${timeRemaining}s`, 20, 150)
                    }
                }
            }

            if (gameStateRef.current.gameState === 'menu') {
                ctx.fillStyle = '#00FFFF'
                if (isMobile) {
                    const scaleX = canvas.width / CANVAS_WIDTH
                    const scaleY = canvas.height / CANVAS_HEIGHT
                    const fontScale = scaleX
                    ctx.font = `bold ${48 * fontScale}px "Courier New", monospace`
                    ctx.textAlign = 'center'
                    ctx.fillText('ALIEN INVADERS', canvas.width / 2, (CANVAS_HEIGHT / 2 - 80) * scaleY)
                    
                    ctx.font = `${24 * fontScale}px "Courier New", monospace`
                    ctx.fillText('TOUCH TO START', canvas.width / 2, (CANVAS_HEIGHT / 2 + 20) * scaleY)
                    
                    ctx.textAlign = 'left'
                } else {
                    ctx.font = 'bold 48px "Courier New", monospace'
                    ctx.textAlign = 'center'
                    ctx.fillText('ALIEN INVADERS', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 80)
                    
                    ctx.font = '24px "Courier New", monospace'
                    ctx.fillText('PRESS SPACE TO START', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 20)
                    
                    ctx.font = '16px "Courier New", monospace'
                    ctx.fillText('Arrow Keys / WASD: Move', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 80)
                    ctx.fillText('Space: Shoot', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 110)
                    
                    ctx.textAlign = 'left'
                }
            }

            if (gameStateRef.current.gameState === 'gameover') {
                ctx.fillStyle = '#FF0088'
                if (isMobile) {
                    const scaleX = canvas.width / CANVAS_WIDTH
                    const scaleY = canvas.height / CANVAS_HEIGHT
                    const fontScale = scaleX
                    ctx.font = `bold ${48 * fontScale}px "Courier New", monospace`
                    ctx.textAlign = 'center'
                    ctx.fillText('GAME OVER', canvas.width / 2, (CANVAS_HEIGHT / 2 - 40) * scaleY)
                    
                    ctx.fillStyle = '#00FFFF'
                    ctx.font = `${24 * fontScale}px "Courier New", monospace`
                    ctx.fillText(`Final Score: ${gameStateRef.current.score}`, canvas.width / 2, (CANVAS_HEIGHT / 2 + 40) * scaleY)
                    ctx.fillText('TOUCH TO RESTART', canvas.width / 2, (CANVAS_HEIGHT / 2 + 100) * scaleY)
                    
                    ctx.textAlign = 'left'
                } else {
                    ctx.font = 'bold 48px "Courier New", monospace'
                    ctx.textAlign = 'center'
                    ctx.fillText('GAME OVER', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 40)
                    
                    ctx.fillStyle = '#00FFFF'
                    ctx.font = '24px "Courier New", monospace'
                    ctx.fillText(`Final Score: ${gameStateRef.current.score}`, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 40)
                    ctx.fillText('PRESS SPACE TO RESTART', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 100)
                    
                    ctx.textAlign = 'left'
                }
            }

            animationFrameRef.current = requestAnimationFrame(gameLoop)
        }

        animationFrameRef.current = requestAnimationFrame(gameLoop)

        return () => {
            if (animationFrameRef.current) {
                cancelAnimationFrame(animationFrameRef.current)
            }
        }
    }, [gameState, highScore, gameOver, startGame, isMobile, level, getEnemySpeed, getEnemySpawnRate, getEnemyHorizontalSpeed, getMegaEnemySpawnChance, getMegaEnemyFireRate, countdown, isCelebrating, createFireworks, scoreMultiplier, scoreMultiplierEndTime, magicDefenceActive, magicDefenceEndTime, superWeaponActive, superWeaponEndTime])

    if (isMobile) {
        // Mobile: Full screen canvas
        return (
            <div className="fixed inset-0 w-screen h-screen bg-black" style={{ touchAction: 'none', overflow: 'hidden' }}>
                {/* Back button for mobile */}
                <button
                    onClick={handleBackToHome}
                    className="absolute top-4 right-4 z-20 text-neon-cyan font-mono hover:text-white transition-colors text-lg bg-black/70 px-3 py-1 rounded backdrop-blur-sm"
                >
                    ← Back
                </button>

                {/* Help button for mobile */}
                <button
                    onClick={() => setShowHelpDialog(true)}
                    className="absolute top-14 right-4 z-20 text-neon-cyan hover:text-white transition-colors bg-black/70 p-2 rounded backdrop-blur-sm"
                    aria-label="Show help"
                >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10"></circle>
                        <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path>
                        <line x1="12" y1="17" x2="12.01" y2="17"></line>
                    </svg>
                </button>
                
                {/* Sound toggle button for mobile */}
                <button
                    onClick={toggleSound}
                    className="absolute top-24 right-4 z-20 text-neon-cyan hover:text-white transition-colors bg-black/70 p-2 rounded backdrop-blur-sm"
                    aria-label={soundEnabled ? 'Mute sound' : 'Enable sound'}
                >
                    {soundEnabled ? (
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M11 5L6 9H2v6h4l5 4V5z"></path>
                            <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path>
                        </svg>
                    ) : (
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M11 5L6 9H2v6h4l5 4V5z"></path>
                            <line x1="23" y1="9" x2="17" y2="15"></line>
                            <line x1="17" y1="9" x2="23" y2="15"></line>
                        </svg>
                    )}
                </button>

                {/* Music toggle button for mobile */}
                <button
                    onClick={handleMusicToggle}
                    className="absolute top-[136px] right-4 z-20 text-neon-cyan hover:text-white transition-colors bg-black/70 p-2 rounded backdrop-blur-sm"
                    aria-label={musicIsPlaying ? 'Pause music' : 'Play music'}
                >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M9 18V5l12-2v13"></path>
                        <circle cx="6" cy="18" r="3"></circle>
                        <circle cx="18" cy="16" r="3"></circle>
                    </svg>
                </button>

                {/* Share button for mobile (only show if Web Share API is supported) */}
                {navigator.share && (
                    <button
                        onClick={handleShare}
                        className="absolute top-[188px] right-4 z-20 text-neon-cyan hover:text-white transition-colors bg-black/70 p-2 rounded backdrop-blur-sm"
                        aria-label="Share game"
                    >
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="18" cy="5" r="3"></circle>
                            <circle cx="6" cy="12" r="3"></circle>
                            <circle cx="18" cy="19" r="3"></circle>
                            <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line>
                            <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line>
                        </svg>
                    </button>
                )}
                
                <canvas
                    ref={canvasRef}
                    width={CANVAS_WIDTH}
                    height={CANVAS_HEIGHT}
                    style={{ 
                        touchAction: 'none',
                        position: 'fixed',
                        top: 0,
                        left: 0,
                        width: '100vw',
                        height: '100vh',
                        background: '#000011',
                        display: 'block'
                    }}
                />
                
                {/* Mobile instructions */}
                <div 
                    className={`absolute bottom-4 left-0 right-0 z-10 text-center text-gray-500 text-xs font-mono bg-black/70 backdrop-blur-sm py-2 transition-opacity duration-500 ${
                        gameState === 'playing' || gameState === 'gameover' ? 'opacity-0' : 'opacity-100'
                    }`}
                >
                    <p>Touch and drag to move • Touch to shoot</p>
                </div>

                {/* Help Dialog */}
                {showHelpDialog && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
                        <div className="relative bg-dark-gray border-2 border-neon-cyan rounded-lg shadow-lg shadow-neon-cyan/50 max-w-2xl w-full mx-4 max-h-[80vh] flex flex-col">
                            <div className="flex items-center justify-between p-4 border-b border-neon-cyan/50">
                                <h2 className="text-2xl font-mono font-semibold text-neon-cyan">Game Instructions</h2>
                                <button
                                    onClick={() => setShowHelpDialog(false)}
                                    className="text-neon-cyan hover:text-white transition-colors p-1"
                                    aria-label="Close help"
                                >
                                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <line x1="18" y1="6" x2="6" y2="18"></line>
                                        <line x1="6" y1="6" x2="18" y2="18"></line>
                                    </svg>
                                </button>
                            </div>
                            <div className="overflow-y-auto p-6 flex-1 text-neon-cyan font-mono">
                                <div className="space-y-4 text-sm leading-relaxed">
                                    <div>
                                        <h3 className="text-lg font-semibold text-white mb-2">Controls</h3>
                                        <p className="mb-2"><strong>Desktop:</strong></p>
                                        <ul className="list-disc list-inside ml-2 space-y-1">
                                            <li>Arrow Keys or WASD: Move your ship</li>
                                            <li>Space: Shoot</li>
                                        </ul>
                                        <p className="mt-3 mb-2"><strong>Mobile:</strong></p>
                                        <ul className="list-disc list-inside ml-2 space-y-1">
                                            <li>Touch and drag: Move your ship</li>
                                            <li>Touch: Shoot</li>
                                        </ul>
                                    </div>

                                    <div>
                                        <h3 className="text-lg font-semibold text-white mb-2">Objective</h3>
                                        <p>Survive through 10 levels of increasing difficulty. Destroy enemy ships to score points and collect powerups to gain special abilities.</p>
                                    </div>

                                    <div>
                                        <h3 className="text-lg font-semibold text-white mb-2">Enemies</h3>
                                        <ul className="list-disc list-inside ml-2 space-y-1">
                                            <li>Regular enemies: 100 points each</li>
                                            <li>Skull ships (red): 500 points each, can shoot back at you</li>
                                            <li>Enemy difficulty increases with each level</li>
                                        </ul>
                                    </div>

                                    <div>
                                        <h3 className="text-lg font-semibold text-white mb-2">Powerups</h3>
                                        <ul className="list-disc list-inside ml-2 space-y-1">
                                            <li><strong>+1 Life</strong> (green cross): Gain an extra life</li>
                                            <li><strong>3X Score</strong> (yellow star): Triple your score for 20 seconds</li>
                                            <li><strong>Magic Defence</strong> (purple shield): Become invincible for 20 seconds</li>
                                            <li><strong>Super Weapon</strong> (orange missile): Fire 3 homing missiles for 20 seconds</li>
                                            <li><strong>Clock Extender</strong> (white clock): Extends active powerup duration by 30 seconds</li>
                                        </ul>
                                    </div>

                                    <div>
                                        <h3 className="text-lg font-semibold text-white mb-2">Gameplay</h3>
                                        <ul className="list-disc list-inside ml-2 space-y-1">
                                            <li>You start with 1 life</li>
                                            <li>Lose a life when hit by enemy bullets or collisions</li>
                                            <li>Game ends when all lives are lost</li>
                                            <li>Each level lasts 60 seconds</li>
                                            <li>Enemy spawn rate and speed increase each level</li>
                                            <li>Beat your high score to unlock special celebrations!</li>
                                        </ul>
                                    </div>

                                    <div>
                                        <h3 className="text-lg font-semibold text-white mb-2">Tips</h3>
                                        <ul className="list-disc list-inside ml-2 space-y-1">
                                            <li>Stay mobile to avoid enemy fire</li>
                                            <li>Collect powerups strategically</li>
                                            <li>Use Magic Defence when overwhelmed</li>
                                            <li>Combine 3X Score with Super Weapon for maximum points</li>
                                            <li>Watch for Clock Extenders to extend your powerups</li>
                                        </ul>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        )
    }

    // Desktop: Bordered frame design
    return (
        <div className="min-h-screen bg-black flex flex-col items-center justify-center p-4">
            <div className="mb-4 flex items-center justify-between w-full max-w-4xl">
                <button
                    onClick={handleBackToHome}
                    className="text-neon-cyan font-mono hover:text-white transition-colors text-lg"
                >
                    ← Back to Home
                </button>
                
                <div className="flex items-center gap-2">
                    {/* Sound toggle button for desktop */}
                    <button
                        onClick={toggleSound}
                        className="text-neon-cyan hover:text-white transition-colors p-2"
                        aria-label={soundEnabled ? 'Mute sound' : 'Enable sound'}
                    >
                        {soundEnabled ? (
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M11 5L6 9H2v6h4l5 4V5z"></path>
                                <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path>
                            </svg>
                        ) : (
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M11 5L6 9H2v6h4l5 4V5z"></path>
                                <line x1="23" y1="9" x2="17" y2="15"></line>
                                <line x1="17" y1="9" x2="23" y2="15"></line>
                            </svg>
                        )}
                    </button>

                    {/* Music toggle button for desktop */}
                    <button
                        onClick={handleMusicToggle}
                        className="text-neon-cyan hover:text-white transition-colors p-2"
                        aria-label={musicIsPlaying ? 'Pause music' : 'Play music'}
                    >
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M9 18V5l12-2v13"></path>
                            <circle cx="6" cy="18" r="3"></circle>
                            <circle cx="18" cy="16" r="3"></circle>
                        </svg>
                    </button>

                    {/* Help button for desktop */}
                    <button
                        onClick={() => setShowHelpDialog(true)}
                        className="text-neon-cyan hover:text-white transition-colors p-2"
                        aria-label="Show help"
                    >
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="12" cy="12" r="10"></circle>
                            <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path>
                            <line x1="12" y1="17" x2="12.01" y2="17"></line>
                        </svg>
                    </button>
                </div>
            </div>
            
            <div className="border-2 border-neon-cyan rounded-lg p-4 shadow-lg shadow-neon-cyan/50">
                <canvas
                    ref={canvasRef}
                    width={CANVAS_WIDTH}
                    height={CANVAS_HEIGHT}
                    className="block bg-black w-full max-w-full"
                    style={{ 
                        maxWidth: '100%', 
                        height: 'auto'
                    }}
                />
            </div>

            {/* Help Dialog */}
            {showHelpDialog && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
                    <div className="relative bg-dark-gray border-2 border-neon-cyan rounded-lg shadow-lg shadow-neon-cyan/50 max-w-2xl w-full mx-4 max-h-[80vh] flex flex-col">
                        <div className="flex items-center justify-between p-4 border-b border-neon-cyan/50">
                            <h2 className="text-2xl font-mono font-semibold text-neon-cyan">Game Instructions</h2>
                            <button
                                onClick={() => setShowHelpDialog(false)}
                                className="text-neon-cyan hover:text-white transition-colors p-1"
                                aria-label="Close help"
                            >
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <line x1="18" y1="6" x2="6" y2="18"></line>
                                    <line x1="6" y1="6" x2="18" y2="18"></line>
                                </svg>
                            </button>
                        </div>
                        <div className="overflow-y-auto p-6 flex-1 text-neon-cyan font-mono">
                            <div className="space-y-4 text-sm leading-relaxed">
                                <div>
                                    <h3 className="text-lg font-semibold text-white mb-2">Controls</h3>
                                    <p className="mb-2"><strong>Desktop:</strong></p>
                                    <ul className="list-disc list-inside ml-2 space-y-1">
                                        <li>Arrow Keys or WASD: Move your ship</li>
                                        <li>Space: Shoot</li>
                                    </ul>
                                    <p className="mt-3 mb-2"><strong>Mobile:</strong></p>
                                    <ul className="list-disc list-inside ml-2 space-y-1">
                                        <li>Touch and drag: Move your ship</li>
                                        <li>Touch: Shoot</li>
                                    </ul>
                                </div>

                                <div>
                                    <h3 className="text-lg font-semibold text-white mb-2">Objective</h3>
                                    <p>Survive through 10 levels of increasing difficulty. Destroy enemy ships to score points and collect powerups to gain special abilities.</p>
                                </div>

                                <div>
                                    <h3 className="text-lg font-semibold text-white mb-2">Enemies</h3>
                                    <ul className="list-disc list-inside ml-2 space-y-1">
                                        <li>Regular enemies: 100 points each</li>
                                        <li>Skull ships (red): 500 points each, can shoot back at you</li>
                                        <li>Enemy difficulty increases with each level</li>
                                    </ul>
                                </div>

                                <div>
                                    <h3 className="text-lg font-semibold text-white mb-2">Powerups</h3>
                                    <ul className="list-disc list-inside ml-2 space-y-1">
                                        <li><strong>+1 Life</strong> (green cross): Gain an extra life</li>
                                        <li><strong>3X Score</strong> (yellow star): Triple your score for 20 seconds</li>
                                        <li><strong>Magic Defence</strong> (purple shield): Become invincible for 20 seconds</li>
                                        <li><strong>Super Weapon</strong> (orange missile): Fire 3 homing missiles for 20 seconds</li>
                                        <li><strong>Clock Extender</strong> (white clock): Extends active powerup duration by 30 seconds</li>
                                    </ul>
                                </div>

                                <div>
                                    <h3 className="text-lg font-semibold text-white mb-2">Gameplay</h3>
                                    <ul className="list-disc list-inside ml-2 space-y-1">
                                        <li>You start with 1 life</li>
                                        <li>Lose a life when hit by enemy bullets or collisions</li>
                                        <li>Game ends when all lives are lost</li>
                                        <li>Each level lasts 60 seconds</li>
                                        <li>Enemy spawn rate and speed increase each level</li>
                                        <li>Beat your high score to unlock special celebrations!</li>
                                    </ul>
                                </div>

                                <div>
                                    <h3 className="text-lg font-semibold text-white mb-2">Tips</h3>
                                    <ul className="list-disc list-inside ml-2 space-y-1">
                                        <li>Stay mobile to avoid enemy fire</li>
                                        <li>Collect powerups strategically</li>
                                        <li>Use Magic Defence when overwhelmed</li>
                                        <li>Combine 3X Score with Super Weapon for maximum points</li>
                                        <li>Watch for Clock Extenders to extend your powerups</li>
                                    </ul>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

export default AliensGame
