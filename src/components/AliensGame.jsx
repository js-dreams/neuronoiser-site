import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'

const CANVAS_WIDTH = 800
const CANVAS_HEIGHT = 600
const PLAYER_SPEED = 5
const BULLET_SPEED = 8
const ENEMY_SPEED = 2
const ENEMY_SPAWN_RATE = 60 // frames
const STAR_COUNT = 100

function AliensGame() {
    const canvasRef = useRef(null)
    const animationFrameRef = useRef(null)
    const navigate = useNavigate()
    
    const [gameState, setGameState] = useState('menu') // 'menu', 'playing', 'gameover'
    const [score, setScore] = useState(0)
    const [highScore, setHighScore] = useState(0)
    const [isMobile, setIsMobile] = useState(false)
    const [level, setLevel] = useState(1)
    
    const gameStateRef = useRef({ gameState, score, level })
    const playerRef = useRef({ x: CANVAS_WIDTH / 2, y: CANVAS_HEIGHT - 80 })
    const bulletsRef = useRef([])
    const enemiesRef = useRef([])
    const keysRef = useRef({})
    const starsRef = useRef([])
    const frameCountRef = useRef(0)
    const touchRef = useRef({ x: null, y: null, isTouching: false, shootPressed: false })
    const levelStartTimeRef = useRef(null)
    const levelAnnouncementStartTimeRef = useRef(null)

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

    const startGame = useCallback(() => {
        setGameState('playing')
        setScore(0)
        setLevel(1)
        playerRef.current = { x: CANVAS_WIDTH / 2, y: CANVAS_HEIGHT - 80 }
        bulletsRef.current = []
        enemiesRef.current = []
        frameCountRef.current = 0
        levelStartTimeRef.current = Date.now()
        levelAnnouncementStartTimeRef.current = Date.now()
    }, [])

    const gameOver = useCallback(() => {
        setGameState('gameover')
        if (gameStateRef.current.score > highScore) {
            setHighScore(gameStateRef.current.score)
            localStorage.setItem('aliensHighScore', gameStateRef.current.score.toString())
        }
    }, [highScore])

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

    // Load high score
    useEffect(() => {
        const saved = localStorage.getItem('aliensHighScore')
        if (saved) {
            setHighScore(parseInt(saved, 10))
        }
    }, [])

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
        gameStateRef.current = { gameState, score, level }
    }, [gameState, score, level])

    // Track game entry with analytics
    useEffect(() => {
        if (window.gtag) {
            window.gtag('event', 'game_entry', {
                game_name: 'Aliens',
                action: 'enter_game'
            })
        }
    }, [])

    // Handle navigation back to home with analytics
    const handleBackToHome = () => {
        if (window.gtag) {
            window.gtag('event', 'game_exit', {
                game_name: 'Aliens',
                action: 'return_to_home'
            })
        }
        navigate('/')
    }

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

            if (gameStateRef.current.gameState === 'playing') {
                frameCountRef.current++

                // Level progression: advance level every 60 seconds
                if (levelStartTimeRef.current && level < 10) {
                    const timeInLevel = (Date.now() - levelStartTimeRef.current) / 1000 // seconds
                    if (timeInLevel >= 60) {
                        const newLevel = level + 1
                        setLevel(newLevel)
                        levelStartTimeRef.current = Date.now()
                        levelAnnouncementStartTimeRef.current = Date.now()
                    }
                }

                // Get current level-based difficulty
                const currentEnemySpeed = getEnemySpeed(level)
                const currentEnemySpawnRate = getEnemySpawnRate(level)

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
                    if (frameCountRef.current % 10 === 0) {
                        bulletsRef.current.push({
                            x: player.x,
                            y: player.y - 30,
                            width: 4,
                            height: 12
                        })
                    }
                }

                // Update bullets
                bulletsRef.current = bulletsRef.current
                    .map(bullet => ({ ...bullet, y: bullet.y - BULLET_SPEED }))
                    .filter(bullet => bullet.y > -bullet.height)

                // Spawn enemies (using level-based spawn rate)
                if (frameCountRef.current % Math.floor(currentEnemySpawnRate) === 0) {
                    enemiesRef.current.push({
                        x: Math.random() * (CANVAS_WIDTH - 40) + 20,
                        y: -30,
                        width: 30,
                        height: 30,
                        health: 1
                    })
                }

                // Update enemies (using level-based speed)
                enemiesRef.current = enemiesRef.current
                    .map(enemy => ({ ...enemy, y: enemy.y + currentEnemySpeed }))
                    .filter(enemy => {
                        if (enemy.y > CANVAS_HEIGHT) return false
                        
                        // Collision with player
                        if (
                            enemy.x < player.x + 20 &&
                            enemy.x + enemy.width > player.x - 20 &&
                            enemy.y < player.y + 20 &&
                            enemy.y + enemy.height > player.y - 20
                        ) {
                            gameOver()
                            return false
                        }
                        return true
                    })

                // Bullet-enemy collisions
                bulletsRef.current = bulletsRef.current.filter(bullet => {
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
                        enemiesRef.current.splice(hitEnemy, 1)
                        setScore(prev => prev + 100)
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

                // Draw bullets
                ctx.fillStyle = '#FFFF00'
                bulletsRef.current.forEach(bullet => {
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

                    // Enemy details
                    ctx.fillStyle = '#FF0088'
                    ctx.beginPath()
                    ctx.arc(enemy.x + enemy.width / 2, enemy.y + enemy.height / 2, enemy.width / 4, 0, Math.PI * 2)
                    ctx.fill()
                })
            }

            // Restore context if we scaled it (mobile) - before drawing UI
            if (isMobile) {
                ctx.restore()
            }

            // Draw level announcement overlay with fade-out
            if (levelAnnouncementStartTimeRef.current && gameStateRef.current.gameState === 'playing') {
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
                ctx.fillText(`Score: ${gameStateRef.current.score}`, x, y1)
                ctx.fillText(`High Score: ${highScore}`, x, y2)
                ctx.fillText(`Level: ${level}`, x, y3)
            } else {
                ctx.font = '20px "Courier New", monospace'
                ctx.fillText(`Score: ${gameStateRef.current.score}`, 20, 30)
                ctx.fillText(`High Score: ${highScore}`, 20, 60)
                ctx.fillText(`Level: ${level}`, 20, 90)
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
                    ctx.fillText('PRESS SPACE TO START', canvas.width / 2, (CANVAS_HEIGHT / 2 + 20) * scaleY)
                    
                    ctx.font = `${16 * fontScale}px "Courier New", monospace`
                    ctx.fillText('Arrow Keys / WASD: Move', canvas.width / 2, (CANVAS_HEIGHT / 2 + 80) * scaleY)
                    ctx.fillText('Space: Shoot', canvas.width / 2, (CANVAS_HEIGHT / 2 + 110) * scaleY)
                    
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
                    ctx.fillText('PRESS SPACE TO RESTART', canvas.width / 2, (CANVAS_HEIGHT / 2 + 100) * scaleY)
                    
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
    }, [gameState, highScore, gameOver, startGame, isMobile, level, getEnemySpeed, getEnemySpawnRate])

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
                <div className="absolute bottom-4 left-0 right-0 z-10 text-center text-gray-500 text-xs font-mono bg-black/70 backdrop-blur-sm py-2">
                    <p>Touch and drag to move • Touch to shoot</p>
                </div>
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
        </div>
    )
}

export default AliensGame
