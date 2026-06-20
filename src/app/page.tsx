'use client'

import { useEffect, useRef, useState } from 'react'

export default function Home() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const [loading, setLoading] = useState(true)
  const [loadProgress, setLoadProgress] = useState(0)

  useEffect(() => {
    let animationId: number
    let cleanup = false

    const initScene = async () => {
      const THREE = await import('three')
      const { GLTFLoader } = await import('three/examples/jsm/loaders/GLTFLoader.js')
      const gsapModule = await import('gsap')
      const scrollTriggerModule = await import('gsap/ScrollTrigger')

      const gsap = gsapModule.gsap
      const ScrollTrigger = scrollTriggerModule.ScrollTrigger
      gsap.registerPlugin(ScrollTrigger)

      // ─── Scene ───
      const scene = new THREE.Scene()
      scene.background = new THREE.Color(0x030507)

      const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 500)
      camera.position.set(0, 1.6, 0)

      const renderer = new THREE.WebGLRenderer({
        canvas: canvasRef.current!,
        antialias: true,
        alpha: false,
      })
      renderer.setSize(window.innerWidth, window.innerHeight)
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
      renderer.shadowMap.enabled = true
      renderer.shadowMap.type = THREE.PCFShadowMap
      renderer.toneMapping = THREE.ACESFilmicToneMapping
      renderer.toneMappingExposure = 1.4
      renderer.outputColorSpace = THREE.SRGBColorSpace

      // ─── Indoor Lighting ───
      const ambientLight = new THREE.AmbientLight(0xffffff, 0.8)
      scene.add(ambientLight)

      const sunLight = new THREE.DirectionalLight(0xfff5e6, 2.0)
      sunLight.position.set(5, 8, 3)
      sunLight.castShadow = true
      sunLight.shadow.mapSize.width = 2048
      sunLight.shadow.mapSize.height = 2048
      sunLight.shadow.camera.near = 0.1
      sunLight.shadow.camera.far = 50
      sunLight.shadow.camera.left = -15
      sunLight.shadow.camera.right = 15
      sunLight.shadow.camera.top = 15
      sunLight.shadow.camera.bottom = -15
      sunLight.shadow.bias = -0.0002
      scene.add(sunLight)
      scene.add(sunLight.target)

      const fillLight = new THREE.DirectionalLight(0xddeeff, 0.4)
      fillLight.position.set(-4, 3, -2)
      scene.add(fillLight)

      const hemiLight = new THREE.HemisphereLight(0xcce0ff, 0x222222, 0.3)
      scene.add(hemiLight)

      const rimLight = new THREE.PointLight(0x00f5ff, 0.3, 30)
      rimLight.position.set(0, 5, 0)
      scene.add(rimLight)

      // ─── Eye-level height ───
      // Human eye level is ~1.6m. This is CONSTANT for sections 1–3.
      // Only section 4 is allowed to go above this (exterior pull-back).
      const EYE_HEIGHT = 1.6
      const EYE_TARGET_Y = 1.4 // Slightly below eye for natural look-ahead

      // ─── Waypoint Camera System ───
      // Instead of diagonal lines, each transition goes through intermediate
      // waypoints so the camera follows corridors instead of clipping walls.
      //
      // Each waypoint: { pos: {x,y,z}, target: {x,y,z} }
      // The camera will step through these in sequence via GSAP timeline.

      // These will be populated by updateCameraForModel() after GLB loads.
      // Default values are placeholder only.
      const waypoints = {
        // Section 1 (Hero): Entrance looking into living room
        s1: {
          pos: { x: 0, y: EYE_HEIGHT, z: 0 },
          target: { x: 0, y: EYE_TARGET_Y, z: 0 },
        },
        // Section 1→2 waypoint A: Step forward into living room center
        s1_midA: {
          pos: { x: 0, y: EYE_HEIGHT, z: 0 },
          target: { x: 0, y: EYE_TARGET_Y, z: 0 },
        },
        // Section 2 (Workflow): In front of lounge/sitting setup
        s2: {
          pos: { x: 0, y: EYE_HEIGHT, z: 0 },
          target: { x: 0, y: EYE_TARGET_Y, z: 0 },
        },
        // Section 2→3 waypoint B: Side-step along corridor (not diagonal)
        s2_midB: {
          pos: { x: 0, y: EYE_HEIGHT, z: 0 },
          target: { x: 0, y: EYE_TARGET_Y, z: 0 },
        },
        // Section 3 (Solution): Close to kitchen counter / side desk detail
        s3: {
          pos: { x: 0, y: EYE_HEIGHT, z: 0 },
          target: { x: 0, y: EYE_TARGET_Y, z: 0 },
        },
        // Section 3→4 waypoint C: Approach window/balcony before exiting
        s3_midC: {
          pos: { x: 0, y: EYE_HEIGHT, z: 0 },
          target: { x: 0, y: EYE_TARGET_Y, z: 0 },
        },
        // Section 4 (Pricing): Outside through window, elevated overview
        s4: {
          pos: { x: 0, y: 5, z: 0 },
          target: { x: 0, y: 1.5, z: 0 },
        },
      }

      const currentTarget = new THREE.Vector3(0, EYE_TARGET_Y, 0)

      // ─── Dynamic camera calculation based on loaded model ───
      const updateCameraForModel = (model: THREE.Group) => {
        const box = new THREE.Box3().setFromObject(model)
        const size = box.getSize(new THREE.Vector3())
        const maxDim = Math.max(size.x, size.y, size.z)

        // Scale to ~15 units for interior walkthrough
        const scale = 15 / maxDim
        model.scale.setScalar(scale)

        // Recalculate after scaling
        const scaledBox = new THREE.Box3().setFromObject(model)
        const scaledCenter = scaledBox.getCenter(new THREE.Vector3())
        const scaledSize = scaledBox.getSize(new THREE.Vector3())

        // Center horizontally, bottom at ground
        model.position.x -= scaledCenter.x
        model.position.z -= scaledCenter.z
        model.position.y -= scaledBox.min.y

        // Final bounds
        const finalBox = new THREE.Box3().setFromObject(model)
        const finalCenter = finalBox.getCenter(new THREE.Vector3())

        const cx = finalCenter.x
        const cz = finalCenter.z
        const sx = scaledSize.x
        const sz = scaledSize.z

        // Floor Y is at 0 after positioning, so eye level is EYE_HEIGHT
        // Model center Z is the "depth center" of the apartment

        // ── Section 1 (Hero): Main entrance, looking into living room ──
        // Camera at back edge (entrance side), looking toward center
        waypoints.s1.pos = { x: cx, y: EYE_HEIGHT, z: cz + sz * 0.4 }
        waypoints.s1.target = { x: cx, y: EYE_TARGET_Y, z: cz - sz * 0.05 }

        // ── Waypoint A: Walk straight forward into living room center ──
        // Keep same X (no side movement), move along Z axis
        waypoints.s1_midA.pos = { x: cx, y: EYE_HEIGHT, z: cz + sz * 0.15 }
        waypoints.s1_midA.target = { x: cx - sx * 0.05, y: EYE_TARGET_Y, z: cz - sz * 0.1 }

        // ── Section 2 (Workflow): In front of lounge/sitting area ──
        // Deeper into the room, still on center line
        waypoints.s2.pos = { x: cx - sx * 0.05, y: EYE_HEIGHT, z: cz - sz * 0.05 }
        waypoints.s2.target = { x: cx - sx * 0.15, y: EYE_TARGET_Y, z: cz - sz * 0.2 }

        // ── Waypoint B: Side-step toward kitchen/desk area (X axis first, then Z) ──
        // Move laterally along X, NOT diagonally
        waypoints.s2_midB.pos = { x: cx - sx * 0.2, y: EYE_HEIGHT, z: cz - sz * 0.05 }
        waypoints.s2_midB.target = { x: cx - sx * 0.3, y: EYE_TARGET_Y, z: cz - sz * 0.1 }

        // ── Section 3 (Solution): Close to kitchen counter / side desk ──
        // Slight rotation (~40°) toward detail, moved slightly closer
        waypoints.s3.pos = { x: cx - sx * 0.25, y: EYE_HEIGHT, z: cz + sz * 0.02 }
        waypoints.s3.target = { x: cx - sx * 0.38, y: EYE_TARGET_Y, z: cz - sz * 0.08 }

        // ── Waypoint C: Approach window/balcony before exiting ──
        // Walk toward the window side, still at eye level
        waypoints.s3_midC.pos = { x: cx + sx * 0.1, y: EYE_HEIGHT, z: cz - sz * 0.1 }
        waypoints.s3_midC.target = { x: cx + sx * 0.3, y: EYE_TARGET_Y, z: cz - sz * 0.15 }

        // ── Section 4 (Pricing): Through window, elevated architectural overview ──
        // Camera exits through main window and rises above for overview
        waypoints.s4.pos = { x: cx + sx * 0.5, y: EYE_HEIGHT + sx * 0.5, z: cz + sz * 0.5 }
        waypoints.s4.target = { x: cx, y: EYE_TARGET_Y, z: cz }

        // Set initial camera
        camera.position.set(waypoints.s1.pos.x, waypoints.s1.pos.y, waypoints.s1.pos.z)
        currentTarget.set(waypoints.s1.target.x, waypoints.s1.target.y, waypoints.s1.target.z)

        // Update lights relative to model
        sunLight.position.set(cx + sx * 0.3, EYE_HEIGHT + sx * 0.8, cz + sz * 0.2)
        sunLight.target.position.set(cx, EYE_HEIGHT, cz)
        sunLight.target.updateMatrixWorld()
        rimLight.position.set(cx, EYE_HEIGHT + 3, cz)

        console.log('[ARQAI] Model loaded. Waypoints configured:')
        console.log('[ARQAI] S1:', JSON.stringify(waypoints.s1))
        console.log('[ARQAI] S2:', JSON.stringify(waypoints.s2))
        console.log('[ARQAI] S3:', JSON.stringify(waypoints.s3))
        console.log('[ARQAI] S4:', JSON.stringify(waypoints.s4))
        console.log('[ARQAI] Apartment bounds:', { cx, cz, sx, sz })
      }

      // ─── Load GLB Model ───
      let glbLoaded = false
      let sceneReady = false

      const loader = new GLTFLoader()
      loader.load(
        '/assets/ap.glb',
        (gltf) => {
          if (cleanup) return
          glbLoaded = true

          const model = gltf.scene
          model.traverse((child) => {
            if ((child as THREE.Mesh).isMesh) {
              child.castShadow = true
              child.receiveShadow = true
            }
          })

          updateCameraForModel(model)
          scene.add(model)

          sceneReady = true
          setLoadProgress(100)
          setTimeout(() => setLoading(false), 800)

          // Rebuild scroll animations after model loads with proper waypoints
          setTimeout(() => {
            camera.position.set(waypoints.s1.pos.x, waypoints.s1.pos.y, waypoints.s1.pos.z)
            currentTarget.set(waypoints.s1.target.x, waypoints.s1.target.y, waypoints.s1.target.z)
            setupScrollAnimations()
          }, 600)
        },
        (progress) => {
          if (progress.total > 0) {
            const pct = Math.round((progress.loaded / progress.total) * 100)
            setLoadProgress(pct)
          }
        },
        () => {
          if (!glbLoaded && !cleanup) {
            sceneReady = true
            setLoadProgress(100)
            setTimeout(() => setLoading(false), 800)
          }
        }
      )

      // Fallback timeout
      setTimeout(() => {
        if (!glbLoaded && !sceneReady && !cleanup) {
          sceneReady = true
          setLoadProgress(100)
          setTimeout(() => setLoading(false), 800)
        }
      }, 10000)

      // ─── GSAP ScrollTrigger with Waypoint Navigation ───
      // Instead of single gsap.to per section (which creates straight diagonal
      // paths that clip through walls), we use GSAP timelines with sequential
      // tweens through intermediate waypoints.
      const setupScrollAnimations = () => {
        ScrollTrigger.getAll().forEach(st => st.kill())
        gsap.killTweensOf(camera.position)
        gsap.killTweensOf(currentTarget)

        const sections = scrollContainerRef.current?.querySelectorAll('.arqai-section')
        if (!sections || sections.length < 4) return

        // ── Section 1 → 2: Entrance → Lounge (via waypoint A) ──
        // Step 1: Walk forward to midpoint A
        const tl1_cam = gsap.timeline({
          scrollTrigger: {
            trigger: sections[1],
            start: 'top bottom',
            end: 'top top',
            scrub: 2,
          },
        })
        tl1_cam.to(camera.position, {
          x: waypoints.s1_midA.pos.x,
          y: EYE_HEIGHT, // Force constant Y
          z: waypoints.s1_midA.pos.z,
          duration: 1,
          ease: 'none',
        })
        tl1_cam.to(camera.position, {
          x: waypoints.s2.pos.x,
          y: EYE_HEIGHT, // Force constant Y
          z: waypoints.s2.pos.z,
          duration: 1,
          ease: 'none',
        })

        const tl1_tgt = gsap.timeline({
          scrollTrigger: {
            trigger: sections[1],
            start: 'top bottom',
            end: 'top top',
            scrub: 2,
          },
        })
        tl1_tgt.to(currentTarget, {
          x: waypoints.s1_midA.target.x,
          y: EYE_TARGET_Y,
          z: waypoints.s1_midA.target.z,
          duration: 1,
          ease: 'none',
        })
        tl1_tgt.to(currentTarget, {
          x: waypoints.s2.target.x,
          y: EYE_TARGET_Y,
          z: waypoints.s2.target.z,
          duration: 1,
          ease: 'none',
        })

        // ── Section 2 → 3: Lounge → Kitchen detail (via waypoint B, side-step) ──
        // Step 1: Side-step laterally (X axis), Step 2: Approach detail
        const tl2_cam = gsap.timeline({
          scrollTrigger: {
            trigger: sections[2],
            start: 'top bottom',
            end: 'top top',
            scrub: 2,
          },
        })
        tl2_cam.to(camera.position, {
          x: waypoints.s2_midB.pos.x,
          y: EYE_HEIGHT, // Force constant Y
          z: waypoints.s2_midB.pos.z,
          duration: 1,
          ease: 'none',
        })
        tl2_cam.to(camera.position, {
          x: waypoints.s3.pos.x,
          y: EYE_HEIGHT, // Force constant Y
          z: waypoints.s3.pos.z,
          duration: 1,
          ease: 'none',
        })

        const tl2_tgt = gsap.timeline({
          scrollTrigger: {
            trigger: sections[2],
            start: 'top bottom',
            end: 'top top',
            scrub: 2,
          },
        })
        tl2_tgt.to(currentTarget, {
          x: waypoints.s2_midB.target.x,
          y: EYE_TARGET_Y,
          z: waypoints.s2_midB.target.z,
          duration: 1,
          ease: 'none',
        })
        tl2_tgt.to(currentTarget, {
          x: waypoints.s3.target.x,
          y: EYE_TARGET_Y,
          z: waypoints.s3.target.z,
          duration: 1,
          ease: 'none',
        })

        // ── Section 3 → 4: Interior → Exterior overview (via window waypoint C) ──
        // Step 1: Walk to window/balcony (still eye level)
        // Step 2: Smoothly rise and pull back outside for overview
        const tl3_cam = gsap.timeline({
          scrollTrigger: {
            trigger: sections[3],
            start: 'top bottom',
            end: 'top top',
            scrub: 2,
          },
        })
        tl3_cam.to(camera.position, {
          x: waypoints.s3_midC.pos.x,
          y: EYE_HEIGHT, // Still at eye level approaching window
          z: waypoints.s3_midC.pos.z,
          duration: 1,
          ease: 'none',
        })
        tl3_cam.to(camera.position, {
          x: waypoints.s4.pos.x,
          y: waypoints.s4.pos.y, // Only now Y rises (outside)
          z: waypoints.s4.pos.z,
          duration: 1,
          ease: 'power1.in',
        })

        const tl3_tgt = gsap.timeline({
          scrollTrigger: {
            trigger: sections[3],
            start: 'top bottom',
            end: 'top top',
            scrub: 2,
          },
        })
        tl3_tgt.to(currentTarget, {
          x: waypoints.s3_midC.target.x,
          y: EYE_TARGET_Y,
          z: waypoints.s3_midC.target.z,
          duration: 1,
          ease: 'none',
        })
        tl3_tgt.to(currentTarget, {
          x: waypoints.s4.target.x,
          y: waypoints.s4.target.y,
          z: waypoints.s4.target.z,
          duration: 1,
          ease: 'none',
        })

        ScrollTrigger.refresh()
      }

      // ─── GSAP Scroll-Reveal for content cards ───
      const contentCards = scrollContainerRef.current?.querySelectorAll('.reveal-card')
      contentCards?.forEach((card) => {
        gsap.fromTo(card,
          { opacity: 0, y: 60 },
          {
            opacity: 1,
            y: 0,
            duration: 1,
            ease: 'power3.out',
            scrollTrigger: {
              trigger: card,
              start: 'top 85%',
              end: 'top 60%',
              toggleActions: 'play none none reverse',
            },
          }
        )
      })

      // ─── Animation Loop ───
      const clock = new THREE.Clock()
      const animate = () => {
        if (cleanup) return
        animationId = requestAnimationFrame(animate)
        const elapsed = clock.getElapsedTime()

        // Very subtle camera breathing — NO Y movement to maintain eye level
        camera.position.x += Math.sin(elapsed * 0.12) * 0.002

        // Enforce eye-height constraint for sections 1-3 (don't let breathing push Y)
        // Only allow Y to float freely if camera is already above EYE_HEIGHT + 1 (section 4)
        if (camera.position.y < EYE_HEIGHT + 1) {
          camera.position.y = EYE_HEIGHT
        }

        camera.lookAt(currentTarget)

        // Subtle rim light pulse
        rimLight.intensity = 0.3 + Math.sin(elapsed * 0.8) * 0.05

        renderer.render(scene, camera)
      }
      animate()

      // ─── Spacebar Coordinate Logger ───
      const onKeydown = (e: KeyboardEvent) => {
        if (e.code === 'Space') {
          e.preventDefault()
          const p = camera.position
          const t = currentTarget
          console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
          console.log('[ARQAI] 📷 Camera Position:')
          console.log(`  pos: { x: ${p.x.toFixed(4)}, y: ${p.y.toFixed(4)}, z: ${p.z.toFixed(4)} }`)
          console.log(`  target: { x: ${t.x.toFixed(4)}, y: ${t.y.toFixed(4)}, z: ${t.z.toFixed(4)} }`)
          console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
        }
      }
      window.addEventListener('keydown', onKeydown)

      // ─── Resize Handler ───
      const handleResize = () => {
        camera.aspect = window.innerWidth / window.innerHeight
        camera.updateProjectionMatrix()
        renderer.setSize(window.innerWidth, window.innerHeight)
      }
      window.addEventListener('resize', handleResize)

      // Periodic ScrollTrigger refresh
      const refreshInterval = setInterval(() => ScrollTrigger.refresh(), 2000)
      setTimeout(() => clearInterval(refreshInterval), 8000)

      // ─── Cleanup ───
      const destroy = () => {
        cleanup = true
        window.removeEventListener('resize', handleResize)
        window.removeEventListener('keydown', onKeydown)
        cancelAnimationFrame(animationId)
        clearInterval(refreshInterval)
        ScrollTrigger.getAll().forEach(t => t.kill())
        renderer.dispose()
        scene.clear()
      }

      ;(window as unknown as Record<string, (() => void) | undefined>).__arqaiCleanup = destroy
    }

    initScene()

    return () => {
      const cleanupFn = (window as unknown as Record<string, (() => void) | undefined>).__arqaiCleanup
      if (cleanupFn) cleanupFn()
    }
  }, [])

  return (
    <>
      {/* ─── Loading Screen ─── */}
      <div
        className={`fixed inset-0 z-[9999] flex flex-col items-center justify-center transition-opacity duration-1000 ${loading ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        style={{ backgroundColor: '#030507' }}
      >
        <div className="text-center">
          <h1 className="text-3xl md:text-5xl font-extralight tracking-[0.35em] text-white mb-2">
            ARQ<span className="text-[#00f5ff]">AI</span>
          </h1>
          <p className="text-white/20 text-xs tracking-[0.4em] uppercase mb-10">Architecture & AI</p>
          <div className="w-72 h-[1px] bg-white/10 rounded-full overflow-hidden mx-auto">
            <div
              className="h-full bg-gradient-to-r from-transparent via-[#00f5ff] to-transparent transition-all duration-500 rounded-full"
              style={{ width: `${loadProgress}%` }}
            />
          </div>
          <p className="text-white/30 text-[10px] tracking-[0.3em] mt-5 uppercase">
            {loadProgress < 100 ? 'Carregando experiência imersiva...' : 'Preparando...'}
          </p>
        </div>
      </div>

      {/* ─── Three.js Canvas (fixed background) ─── */}
      <canvas
        ref={canvasRef}
        className="fixed inset-0 w-full h-full"
        style={{ zIndex: 0, pointerEvents: 'none' }}
      />

      {/* ─── Scrollable HTML Content Overlay ─── */}
      <div
        ref={scrollContainerRef}
        className="relative"
        style={{ zIndex: 1, pointerEvents: 'none' }}
      >
        {/* ─── Navbar ─── */}
        <nav
          className="fixed top-0 left-0 right-0 flex items-center justify-between px-6 md:px-12 py-5 backdrop-blur-sm bg-[#030507]/30"
          style={{ zIndex: 50, pointerEvents: 'none' }}
        >
          <div className="pointer-events-auto">
            <h1 className="text-xl md:text-2xl font-extralight tracking-[0.35em] text-white">
              ARQ<span className="text-[#00f5ff]">AI</span>
            </h1>
          </div>
          <a
            href="#pricing"
            className="pointer-events-auto text-white/80 text-sm tracking-wider border border-white/25 px-6 py-2.5 hover:border-[#00f5ff]/60 hover:text-[#00f5ff] transition-all duration-400 backdrop-blur-sm bg-white/[0.03]"
          >
            Ver Preços
          </a>
        </nav>

        {/* ─── Section 1: Hero ─── */}
        <section
          className="arqai-section min-h-screen flex items-center px-6 md:px-12 lg:px-20 pt-24 pb-12"
          style={{ pointerEvents: 'none' }}
        >
          <div className="max-w-2xl w-full" style={{ pointerEvents: 'auto' }}>
            <div className="reveal-card backdrop-blur-xl bg-[#030507]/50 border border-white/[0.07] rounded-2xl p-8 md:p-12 shadow-2xl shadow-black/40">
              <span className="text-[#00f5ff] text-[11px] tracking-[0.3em] font-medium uppercase">
                Método Inovador
              </span>
              <h2 className="text-3xl md:text-4xl lg:text-[2.75rem] font-extralight text-white leading-[1.15] mt-5">
                Produção de Conteúdo para Arquitetos com Inteligência Artificial
              </h2>
              <p className="text-white/55 text-base md:text-lg font-light leading-relaxed mt-6">
                Eleve o nível das suas apresentações, conquiste clientes de alto padrão e acelere seu fluxo de trabalho em até 10x. O futuro da arquitetura e do design começa aqui.
              </p>
              <ul className="mt-8 space-y-4">
                {[
                  'Transforme ambientes vazios em decorados de forma ultra-realista.',
                  'Simule reformas complexas diretamente em fotos reais de forma instantânea.',
                  'Crie renders profissionais em uma fração do tempo do método convencional.',
                  'Produza vídeos cinematográficos magnéticos para seu portfólio digital.',
                ].map((item, i) => (
                  <li key={i} className="flex items-start gap-3 text-white/65 text-sm md:text-[15px] font-light leading-relaxed">
                    <svg className="w-[18px] h-[18px] text-[#00f5ff] mt-[3px] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                    {item}
                  </li>
                ))}
              </ul>
              <div className="flex flex-col sm:flex-row gap-4 mt-10">
                <button className="bg-[#00f5ff] text-[#030507] font-semibold px-8 py-4 text-sm tracking-wider hover:bg-[#00d4dd] hover:shadow-lg hover:shadow-[#00f5ff]/20 transition-all duration-400 rounded-sm">
                  Quero Acessar o Curso (R$ 39,90)
                </button>
                <button className="border border-white/25 text-white/80 px-8 py-4 text-sm tracking-wider hover:border-[#00f5ff]/50 hover:text-[#00f5ff] transition-all duration-400 backdrop-blur-sm bg-white/[0.03] rounded-sm">
                  Mentoria Especialista
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* ─── Section 2: Workflow ─── */}
        <section
          className="arqai-section min-h-screen flex items-center justify-center px-6 md:px-12 py-24"
          style={{ pointerEvents: 'none' }}
        >
          <div className="max-w-5xl w-full text-center" style={{ pointerEvents: 'auto' }}>
            <div className="reveal-card">
              <span className="text-[#00f5ff] text-[11px] tracking-[0.3em] font-medium uppercase">
                Processo
              </span>
              <h2 className="text-3xl md:text-4xl lg:text-5xl font-extralight text-white mt-4">
                O Fluxo de Trabalho Real
              </h2>
              <p className="text-white/45 text-base md:text-lg font-light mt-4 max-w-2xl mx-auto">
                Domine as 3 etapas essenciais para revolucionar sua produção.
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-14">
              {[
                {
                  num: '01',
                  title: 'CAPTAÇÃO',
                  desc: 'Técnicas fáceis para fotografar e preparar ambientes crus ou vazios para a Inteligência Artificial trabalhar com precisão geométrica absoluta.',
                },
                {
                  num: '02',
                  title: 'PROCESSAMENTO',
                  desc: 'Domínio prático das melhores ferramentas de IA do mercado para renderizar, mobiliar, alterar materiais e texturas em minutos.',
                },
                {
                  num: '03',
                  title: 'FINALIZAÇÃO',
                  desc: 'Técnicas de edição de alto nível e geração de vídeos cinemáticos magnéticos para encantar e converter sua audiência nas redes sociais.',
                },
              ].map((card) => (
                <div
                  key={card.num}
                  className="reveal-card backdrop-blur-xl bg-[#030507]/50 border border-white/[0.07] rounded-2xl p-8 text-left hover:border-[#00f5ff]/15 hover:bg-[#030507]/60 transition-all duration-700 group"
                >
                  <span className="text-[#00f5ff]/20 text-6xl font-extralight leading-none">{card.num}</span>
                  <h3 className="text-white text-lg font-light tracking-[0.15em] mt-5">{card.title}</h3>
                  <p className="text-white/45 text-sm font-light leading-relaxed mt-3">{card.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ─── Section 3: Solution ─── */}
        <section
          className="arqai-section min-h-screen flex items-center px-6 md:px-12 lg:px-20 py-24"
          style={{ pointerEvents: 'none' }}
        >
          <div className="max-w-3xl w-full ml-auto" style={{ pointerEvents: 'auto' }}>
            <div className="reveal-card backdrop-blur-xl bg-[#030507]/50 border border-white/[0.07] rounded-2xl p-8 md:p-12 shadow-2xl shadow-black/40">
              <span className="text-[#00f5ff] text-[11px] tracking-[0.3em] font-medium uppercase">
                Solução
              </span>
              <h2 className="text-3xl md:text-4xl lg:text-5xl font-extralight text-white mt-5 leading-[1.15]">
                Fim do Gargalo 3D
              </h2>
              <p className="text-white/55 text-base md:text-lg font-light leading-[1.8] mt-6">
                Esqueça as horas preciosas perdidas em softwares de modelagem 3D convencionais apenas para apresentar uma ideia. Com a Inteligência Artificial, eliminamos a complexidade técnica mantendo o rigor estético exigido pelo mercado de luxo. O que antes levava dias, agora leva minutos com fidelidade fotográfica.
              </p>
              <div className="border-l-2 border-[#00f5ff] pl-6 mt-10 py-2">
                <p className="text-white text-lg md:text-xl font-light italic">
                  &ldquo;A ferramenta definitiva para visualização rápida.&rdquo;
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ─── Section 4: Pricing ─── */}
        <section
          id="pricing"
          className="arqai-section min-h-screen flex items-center justify-center px-6 md:px-12 py-24"
          style={{ pointerEvents: 'none' }}
        >
          <div className="max-w-4xl w-full text-center" style={{ pointerEvents: 'auto' }}>
            <div className="reveal-card">
              <span className="text-[#00f5ff] text-[11px] tracking-[0.3em] font-medium uppercase">
                Jornada
              </span>
              <h2 className="text-3xl md:text-4xl lg:text-5xl font-extralight text-white mt-4">
                Escolha Sua Jornada
              </h2>
              <p className="text-white/45 text-base md:text-lg font-light mt-4 max-w-2xl mx-auto">
                Do aprendizado autônomo à consultoria especializada.
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-14">
              {/* Card 1: Curso Gravado */}
              <div className="reveal-card backdrop-blur-xl bg-[#030507]/50 border border-white/[0.07] rounded-2xl p-8 md:p-10 text-left hover:border-white/[0.12] transition-all duration-700">
                <h3 className="text-white text-xl font-light tracking-[0.12em]">Curso Gravado</h3>
                <p className="text-white/35 text-sm font-light mt-2">Acesso imediato e vitalício.</p>
                <div className="mt-6">
                  <span className="text-4xl font-extralight text-white">R$ 39,90</span>
                </div>
                <ul className="mt-8 space-y-3">
                  {[
                    'Acesso vitalício ao conteúdo completo',
                    'Método completo de IA para renders',
                    'Técnicas de captação e processamento',
                    'Edição profissional e finalização',
                    'Comunidade exclusiva de alunos',
                  ].map((item, i) => (
                    <li key={i} className="flex items-start gap-3 text-white/55 text-sm font-light leading-relaxed">
                      <svg className="w-4 h-4 text-[#00f5ff] mt-[3px] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                      {item}
                    </li>
                  ))}
                </ul>
                <button className="w-full mt-8 border border-white/25 text-white/80 py-4 text-sm tracking-wider hover:border-[#00f5ff]/50 hover:text-[#00f5ff] transition-all duration-400 backdrop-blur-sm bg-white/[0.03] rounded-sm">
                  Comprar Agora
                </button>
              </div>

              {/* Card 2: Mentoria Especialista */}
              <div className="reveal-card relative backdrop-blur-xl bg-[#030507]/60 border border-[#00f5ff]/20 rounded-2xl p-8 md:p-10 text-left hover:border-[#00f5ff]/35 transition-all duration-700 shadow-2xl shadow-[#00f5ff]/[0.03]">
                <span className="absolute -top-3 right-6 bg-[#00f5ff] text-[#030507] text-[10px] tracking-[0.25em] font-bold px-5 py-1.5 uppercase">
                  Recomendado
                </span>
                <h3 className="text-white text-xl font-light tracking-[0.12em]">Mentoria Especialista</h3>
                <p className="text-white/35 text-sm font-light mt-2">Foco B2B e Implementação Real.</p>
                <div className="mt-6">
                  <span className="text-4xl font-extralight text-white">R$ 499,90</span>
                  <span className="text-white/35 text-sm font-light ml-2">/online</span>
                </div>
                <p className="text-white/25 text-xs mt-1.5">Presencial sob consulta</p>
                <ul className="mt-8 space-y-3">
                  {[
                    'Tudo do Curso Gravado incluso',
                    'Sessões ao vivo com especialista',
                    'Implementação no seu escritório',
                    'Suporte personalizado e direto',
                    'Estratégia de posicionamento B2B',
                    'Acompanhamento de resultados reais',
                  ].map((item, i) => (
                    <li key={i} className="flex items-start gap-3 text-white/55 text-sm font-light leading-relaxed">
                      <svg className="w-4 h-4 text-[#00f5ff] mt-[3px] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                      {item}
                    </li>
                  ))}
                </ul>
                <button className="w-full mt-8 bg-[#00f5ff] text-[#030507] font-semibold py-4 text-sm tracking-wider hover:bg-[#00d4dd] hover:shadow-lg hover:shadow-[#00f5ff]/20 transition-all duration-400 rounded-sm">
                  Falar com Consultor
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* ─── Footer ─── */}
        <footer
          className="py-16 px-6 text-center"
          style={{ pointerEvents: 'auto' }}
        >
          <div className="backdrop-blur-xl bg-[#030507]/40 border border-white/[0.05] rounded-2xl p-10 max-w-2xl mx-auto">
            <h3 className="text-2xl font-extralight tracking-[0.35em] text-white">
              ARQ<span className="text-[#00f5ff]">AI</span>
            </h3>
            <p className="text-white/35 text-sm font-light mt-4 leading-relaxed max-w-md mx-auto">
              A arquitetura e o design do futuro combinados com a inteligência artificial.
            </p>
            <div className="flex items-center justify-center gap-8 mt-8">
              <a href="#" className="text-white/35 text-sm tracking-wider hover:text-[#00f5ff] transition-colors duration-400">
                WhatsApp
              </a>
              <span className="text-white/10">|</span>
              <a href="#" className="text-white/35 text-sm tracking-wider hover:text-[#00f5ff] transition-colors duration-400">
                Instagram
              </a>
              <span className="text-white/10">|</span>
              <a href="#" className="text-white/35 text-sm tracking-wider hover:text-[#00f5ff] transition-colors duration-400">
                Email
              </a>
            </div>
          </div>
        </footer>
      </div>
    </>
  )
}
