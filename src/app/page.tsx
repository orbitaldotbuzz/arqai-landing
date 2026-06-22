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

      // ─── Camera Constants ───
      const EYE_HEIGHT = 1.6
      const TARGET_Y = 1.4

      // ─── Waypoints — STRICTLY INSIDE the apartment ───
      // Apartment bounds: cx≈0, cz≈0, sx≈13.6, sz≈15.0
      // Interior safe zone: X ∈ [-5, 5], Z ∈ [-6, 6], Y ∈ [1.6, 3.0]
      // All waypoints keep the camera well inside walls and below ceiling.
      const waypoints: Record<string, { pos: { x: number; y: number; z: number }; target: { x: number; y: number; z: number } }> = {
        // Section 1: Main entrance, wide view of living room
        // Conservative positions well inside the apartment interior
        s1: { pos: { x: 0, y: EYE_HEIGHT, z: 4.0 }, target: { x: 0, y: TARGET_Y, z: -1 } },
        // Waypoint A: Walk straight forward along Z axis
        midA: { pos: { x: 0, y: EYE_HEIGHT, z: 2.0 }, target: { x: 0, y: TARGET_Y, z: -1.5 } },
        // Section 2: Center of living room, facing lounge
        s2: { pos: { x: 0, y: EYE_HEIGHT, z: 0 }, target: { x: -1, y: TARGET_Y, z: -3 } },
        // Waypoint B: Side-step along X (not diagonal)
        midB: { pos: { x: -2, y: EYE_HEIGHT, z: 0 }, target: { x: -3, y: TARGET_Y, z: -1.5 } },
        // Section 3: Close to kitchen/bar counter detail
        s3: { pos: { x: -3, y: EYE_HEIGHT, z: 0 }, target: { x: -4.5, y: TARGET_Y, z: -1.5 } },
        // Waypoint C: Turn and step back toward room center
        midC: { pos: { x: -1.5, y: EYE_HEIGHT, z: 1 }, target: { x: 0.5, y: TARGET_Y, z: -0.5 } },
        // Section 4: Interior corner — slight elevation, still INSIDE
        s4: { pos: { x: 3, y: 2.6, z: 3.5 }, target: { x: 0, y: TARGET_Y, z: -2 } },
      }

      const currentTarget = new THREE.Vector3(0, TARGET_Y, 0)

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

          // Scale and center
          const box = new THREE.Box3().setFromObject(model)
          const size = box.getSize(new THREE.Vector3())
          const maxDim = Math.max(size.x, size.y, size.z)
          const scale = 15 / maxDim
          model.scale.setScalar(scale)

          const scaledBox = new THREE.Box3().setFromObject(model)
          const scaledCenter = scaledBox.getCenter(new THREE.Vector3())
          model.position.x -= scaledCenter.x
          model.position.z -= scaledCenter.z
          model.position.y -= scaledBox.min.y

          scene.add(model)

          // Update lights
          const finalBox = new THREE.Box3().setFromObject(model)
          const fc = finalBox.getCenter(new THREE.Vector3())
          const fs = finalBox.getSize(new THREE.Vector3())
          sunLight.position.set(fc.x + fs.x * 0.3, EYE_HEIGHT + fs.y * 0.8, fc.z + fs.z * 0.2)
          sunLight.target.position.set(fc.x, EYE_HEIGHT, fc.z)
          sunLight.target.updateMatrixWorld()
          rimLight.position.set(fc.x, EYE_HEIGHT + 3, fc.z)

          console.log('[ARQAI] Apartment bounds:', { cx: fc.x.toFixed(2), cz: fc.z.toFixed(2), sx: fs.x.toFixed(2), sz: fs.z.toFixed(2) })
          console.log('[ARQAI] Waypoints:', JSON.stringify(waypoints, null, 2))

          sceneReady = true
          setLoadProgress(100)
          setTimeout(() => setLoading(false), 800)

          // Set initial camera and build scroll animations
          setTimeout(() => {
            camera.position.set(waypoints.s1.pos.x, waypoints.s1.pos.y, waypoints.s1.pos.z)
            currentTarget.set(waypoints.s1.target.x, waypoints.s1.target.y, waypoints.s1.target.z)
            setupScrollAnimations()
          }, 600)
        },
        (progress) => {
          if (progress.total > 0) {
            setLoadProgress(Math.round((progress.loaded / progress.total) * 100))
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

      // ─── GSAP ScrollTrigger — Waypoint Timelines ───
      const setupScrollAnimations = () => {
        // Only kill camera-related ScrollTriggers (tagged with 'camera' vars)
        // Preserve reveal-card ScrollTriggers so text stays visible
        ScrollTrigger.getAll().forEach(st => {
          if ((st.vars as Record<string, unknown>)._cameraAnim) st.kill()
        })
        gsap.killTweensOf(camera.position)
        gsap.killTweensOf(currentTarget)

        const sections = scrollContainerRef.current?.querySelectorAll('.arqai-section')
        if (!sections || sections.length < 4) return

        // ── S1 → S2: Entrance → Living room center (via midA) ──
        const tl1p = gsap.timeline({ scrollTrigger: { trigger: sections[1], start: 'top bottom', end: 'top top', scrub: 2, _cameraAnim: true } })
        tl1p.to(camera.position, { x: waypoints.midA.pos.x, y: EYE_HEIGHT, z: waypoints.midA.pos.z, duration: 1, ease: 'none' })
        tl1p.to(camera.position, { x: waypoints.s2.pos.x, y: EYE_HEIGHT, z: waypoints.s2.pos.z, duration: 1, ease: 'none' })

        const tl1t = gsap.timeline({ scrollTrigger: { trigger: sections[1], start: 'top bottom', end: 'top top', scrub: 2, _cameraAnim: true } })
        tl1t.to(currentTarget, { x: waypoints.midA.target.x, y: TARGET_Y, z: waypoints.midA.target.z, duration: 1, ease: 'none' })
        tl1t.to(currentTarget, { x: waypoints.s2.target.x, y: TARGET_Y, z: waypoints.s2.target.z, duration: 1, ease: 'none' })

        // ── S2 → S3: Lounge → Kitchen detail (via midB side-step) ──
        const tl2p = gsap.timeline({ scrollTrigger: { trigger: sections[2], start: 'top bottom', end: 'top top', scrub: 2, _cameraAnim: true } })
        tl2p.to(camera.position, { x: waypoints.midB.pos.x, y: EYE_HEIGHT, z: waypoints.midB.pos.z, duration: 1, ease: 'none' })
        tl2p.to(camera.position, { x: waypoints.s3.pos.x, y: EYE_HEIGHT, z: waypoints.s3.pos.z, duration: 1, ease: 'none' })

        const tl2t = gsap.timeline({ scrollTrigger: { trigger: sections[2], start: 'top bottom', end: 'top top', scrub: 2, _cameraAnim: true } })
        tl2t.to(currentTarget, { x: waypoints.midB.target.x, y: TARGET_Y, z: waypoints.midB.target.z, duration: 1, ease: 'none' })
        tl2t.to(currentTarget, { x: waypoints.s3.target.x, y: TARGET_Y, z: waypoints.s3.target.z, duration: 1, ease: 'none' })

        // ── S3 → S4: Kitchen → Interior corner overview (via midC, stays INSIDE) ──
        const tl3p = gsap.timeline({ scrollTrigger: { trigger: sections[3], start: 'top bottom', end: 'top top', scrub: 2, _cameraAnim: true } })
        tl3p.to(camera.position, { x: waypoints.midC.pos.x, y: EYE_HEIGHT, z: waypoints.midC.pos.z, duration: 1, ease: 'none' })
        tl3p.to(camera.position, { x: waypoints.s4.pos.x, y: waypoints.s4.pos.y, z: waypoints.s4.pos.z, duration: 1, ease: 'power1.inOut' })

        const tl3t = gsap.timeline({ scrollTrigger: { trigger: sections[3], start: 'top bottom', end: 'top top', scrub: 2, _cameraAnim: true } })
        tl3t.to(currentTarget, { x: waypoints.midC.target.x, y: TARGET_Y, z: waypoints.midC.target.z, duration: 1, ease: 'none' })
        tl3t.to(currentTarget, { x: waypoints.s4.target.x, y: waypoints.s4.target.y, z: waypoints.s4.target.z, duration: 1, ease: 'none' })

        ScrollTrigger.refresh()
      }

      // ─── GSAP Scroll-Reveal for content cards ───
      const contentCards = scrollContainerRef.current?.querySelectorAll('.reveal-card')
      contentCards?.forEach((card) => {
        gsap.fromTo(card,
          { opacity: 0, y: 50 },
          {
            opacity: 1,
            y: 0,
            duration: 0.8,
            ease: 'power3.out',
            scrollTrigger: {
              trigger: card,
              start: 'top 88%',
              end: 'top 65%',
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

        // Very subtle X breathing only — no Y drift
        camera.position.x += Math.sin(elapsed * 0.1) * 0.001

        // Enforce interior bounds: Y must stay between EYE_HEIGHT and 3.0
        if (camera.position.y < EYE_HEIGHT) camera.position.y = EYE_HEIGHT
        if (camera.position.y > 3.2) camera.position.y = 3.2

        camera.lookAt(currentTarget)
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
          console.log(`[ARQAI] 📷 pos: { x: ${p.x.toFixed(4)}, y: ${p.y.toFixed(4)}, z: ${p.z.toFixed(4)} }`)
          console.log(`[ARQAI] 🎯 target: { x: ${t.x.toFixed(4)}, y: ${t.y.toFixed(4)}, z: ${t.z.toFixed(4)} }`)
          console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
        }
      }
      window.addEventListener('keydown', onKeydown)

      // ─── Resize ───
      const handleResize = () => {
        camera.aspect = window.innerWidth / window.innerHeight
        camera.updateProjectionMatrix()
        renderer.setSize(window.innerWidth, window.innerHeight)
      }
      window.addEventListener('resize', handleResize)

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
      const fn = (window as unknown as Record<string, (() => void) | undefined>).__arqaiCleanup
      if (fn) fn()
    }
  }, [])

  // ─── Shared card styles ───
  const cardBase = 'backdrop-blur-xl border border-white/[0.10] rounded-2xl shadow-2xl shadow-black/30'
  const cardBg = { backgroundColor: 'rgba(3, 5, 7, 0.75)' }
  const cardBgLight = { backgroundColor: 'rgba(0, 0, 0, 0.25)' }
  const cardBgMedium = { backgroundColor: 'rgba(3, 5, 7, 0.65)' }

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
            <div className="h-full bg-gradient-to-r from-transparent via-[#00f5ff] to-transparent transition-all duration-500 rounded-full" style={{ width: `${loadProgress}%` }} />
          </div>
          <p className="text-white/30 text-[10px] tracking-[0.3em] mt-5 uppercase">
            {loadProgress < 100 ? 'Carregando experiência imersiva...' : 'Preparando...'}
          </p>
        </div>
      </div>

      {/* ─── Three.js Canvas ─── */}
      <canvas ref={canvasRef} className="fixed inset-0 w-full h-full" style={{ zIndex: 0, pointerEvents: 'none' }} />

      {/* ─── Scroll Container ─── */}
      <div ref={scrollContainerRef} className="relative" style={{ zIndex: 10, pointerEvents: 'none' }}>

        {/* ─── Navbar ─── */}
        <nav className="fixed top-0 left-0 right-0 flex items-center justify-between px-6 md:px-12 py-5 backdrop-blur-sm" style={{ zIndex: 50, pointerEvents: 'none', backgroundColor: 'rgba(3,5,7,0.4)' }}>
          <div className="pointer-events-auto">
            <h1 className="text-xl md:text-2xl font-extralight tracking-[0.35em] text-white">ARQ<span className="text-[#00f5ff]">AI</span></h1>
          </div>
          <a href="#pricing" className="pointer-events-auto text-white/80 text-sm tracking-wider border border-white/25 px-6 py-2.5 hover:border-[#00f5ff]/60 hover:text-[#00f5ff] transition-all duration-300 backdrop-blur-sm bg-white/[0.03]">
            Ver Preços
          </a>
        </nav>

        {/* ─────────────── SECTION 1: HERO ─────────────── */}
        <section className="arqai-section min-h-screen flex items-center justify-center px-6 md:px-12 lg:px-20 pt-24 pb-12" style={{ pointerEvents: 'none' }}>
          <div className="max-w-2xl w-full pointer-events-auto mx-auto">
            <div className={`reveal-card ${cardBase} p-8 md:p-12`} style={cardBgLight}>
              <span className="text-[#00f5ff] text-[11px] tracking-[0.3em] font-medium uppercase">Método Inovador</span>
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
                    <svg className="w-[18px] h-[18px] text-[#00f5ff] mt-[3px] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                    {item}
                  </li>
                ))}
              </ul>
              <div className="flex flex-col sm:flex-row gap-4 mt-10">
                <button className="bg-[#00f5ff] text-[#030507] font-semibold px-8 py-4 text-sm tracking-wider hover:bg-[#00d4dd] hover:shadow-lg hover:shadow-[#00f5ff]/20 transition-all duration-300 rounded-sm">
                  Quero Acessar o Curso (R$ 39,90)
                </button>
                <button className="border border-white/25 text-white/80 px-8 py-4 text-sm tracking-wider hover:border-[#00f5ff]/50 hover:text-[#00f5ff] transition-all duration-300 backdrop-blur-sm bg-white/[0.03] rounded-sm">
                  Mentoria Especialista
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* ─────────────── SECTION 2: WORKFLOW ─────────────── */}
        <section className="arqai-section min-h-screen flex items-center justify-center px-6 md:px-12 py-24" style={{ pointerEvents: 'none' }}>
          <div className="max-w-5xl w-full text-center pointer-events-auto">
            {/* Blur box behind title so it never vanishes against bright or dark 3D areas */}
            <div className="reveal-card inline-block backdrop-blur-xl border border-white/[0.10] rounded-2xl px-10 py-7 shadow-2xl shadow-black/20" style={{ backgroundColor: 'rgba(3, 5, 7, 0.55)' }}>
              <span className="text-[#00f5ff] text-[11px] tracking-[0.3em] font-medium uppercase">Processo</span>
              <h2 className="text-3xl md:text-4xl lg:text-5xl font-extralight text-white mt-4">O Fluxo de Trabalho Real</h2>
              <p className="text-white/60 text-base md:text-lg font-light mt-4 max-w-2xl mx-auto">Domine as 3 etapas essenciais para revolucionar sua produção.</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-14">
              {[
                { num: '01', title: 'CAPTAÇÃO', desc: 'Técnicas fáceis para fotografar e preparar ambientes crus ou vazios para a Inteligência Artificial trabalhar com precisão geométrica absoluta.' },
                { num: '02', title: 'PROCESSAMENTO', desc: 'Domínio prático das melhores ferramentas de IA do mercado para renderizar, mobiliar, alterar materiais e texturas em minutos.' },
                { num: '03', title: 'FINALIZAÇÃO', desc: 'Técnicas de edição de alto nível e geração de vídeos cinemáticos magnéticos para encantar e converter sua audiência nas redes sociais.' },
              ].map((card) => (
                <div key={card.num} className={`reveal-card ${cardBase} p-8 text-left hover:border-[#00f5ff]/15 transition-all duration-700`} style={cardBgMedium}>
                  <span className="text-[#00f5ff]/25 text-6xl font-extralight leading-none">{card.num}</span>
                  <h3 className="text-white text-lg font-light tracking-[0.15em] mt-5">{card.title}</h3>
                  <p className="text-white/50 text-sm font-light leading-relaxed mt-3">{card.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ─────────────── SECTION 3: SOLUTION ─────────────── */}
        <section className="arqai-section min-h-screen flex items-center justify-center px-6 md:px-12 lg:px-20 py-24" style={{ pointerEvents: 'none' }}>
          <div className="max-w-3xl w-full pointer-events-auto mx-auto">
            <div className={`reveal-card ${cardBase} p-8 md:p-12`} style={cardBg}>
              <span className="text-[#00f5ff] text-[11px] tracking-[0.3em] font-medium uppercase">Solução</span>
              <h2 className="text-3xl md:text-4xl lg:text-5xl font-extralight text-white mt-5 leading-[1.15]">Fim do Gargalo 3D</h2>
              <p className="text-white/55 text-base md:text-lg font-light leading-[1.8] mt-6">
                Esqueça as horas preciosas perdidas em softwares de modelagem 3D convencionais apenas para apresentar uma ideia. Com a Inteligência Artificial, eliminamos a complexidade técnica mantendo o rigor estético exigido pelo mercado de luxo. O que antes levava dias, agora leva minutos com fidelidade fotográfica.
              </p>
              <div className="border-l-2 border-[#00f5ff] pl-6 mt-10 py-2">
                <p className="text-white text-lg md:text-xl font-light italic">&ldquo;A ferramenta definitiva para visualização rápida.&rdquo;</p>
              </div>
            </div>
          </div>
        </section>

        {/* ─────────────── SECTION 4: PRICING ─────────────── */}
        <section id="pricing" className="arqai-section min-h-screen flex items-center justify-center px-6 md:px-12 py-24" style={{ pointerEvents: 'none' }}>
          <div className="max-w-4xl w-full text-center pointer-events-auto">
            {/* Blur box behind title so it never vanishes against bright or dark 3D areas */}
            <div className="reveal-card inline-block backdrop-blur-xl border border-white/[0.10] rounded-2xl px-10 py-7 shadow-2xl shadow-black/20" style={{ backgroundColor: 'rgba(3, 5, 7, 0.55)' }}>
              <span className="text-[#00f5ff] text-[11px] tracking-[0.3em] font-medium uppercase">Jornada</span>
              <h2 className="text-3xl md:text-4xl lg:text-5xl font-extralight text-white mt-4">Escolha Sua Jornada</h2>
              <p className="text-white/60 text-base md:text-lg font-light mt-4 max-w-2xl mx-auto">Do aprendizado autônomo à consultoria especializada.</p>
            </div>
            {/* Grid with equal-height cards via items-stretch (default) + flex-col inside */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-14 items-stretch">
              {/* Card 1 */}
              <div className={`reveal-card ${cardBase} p-8 md:p-10 text-left hover:border-white/[0.12] transition-all duration-700 flex flex-col`} style={cardBgMedium}>
                <h3 className="text-white text-xl font-light tracking-[0.12em]">Curso Gravado</h3>
                <p className="text-white/35 text-sm font-light mt-2">Acesso imediato e vitalício.</p>
                <div className="mt-6"><span className="text-4xl font-extralight text-white">R$ 39,90</span></div>
                <ul className="mt-8 space-y-3">
                  {['Acesso vitalício ao conteúdo completo', 'Método completo de IA para renders', 'Técnicas de captação e processamento', 'Edição profissional e finalização', 'Comunidade exclusiva de alunos'].map((item, i) => (
                    <li key={i} className="flex items-start gap-3 text-white/55 text-sm font-light leading-relaxed">
                      <svg className="w-4 h-4 text-[#00f5ff] mt-[3px] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                      {item}
                    </li>
                  ))}
                </ul>
                {/* mt-auto pushes button to bottom of card */}
                <button className="mt-auto w-full border border-white/25 text-white/80 py-4 text-sm tracking-wider hover:border-[#00f5ff]/50 hover:text-[#00f5ff] transition-all duration-300 backdrop-blur-sm bg-white/[0.03] rounded-sm">Comprar Agora</button>
              </div>
              {/* Card 2 */}
              <div className={`reveal-card relative ${cardBase} p-8 md:p-10 text-left hover:border-[#00f5ff]/35 transition-all duration-700 shadow-[0_0_30px_rgba(0,245,255,0.03)] flex flex-col`} style={{ ...cardBgMedium, borderColor: 'rgba(0,245,255,0.2)' }}>
                <span className="absolute -top-3 right-6 bg-[#00f5ff] text-[#030507] text-[10px] tracking-[0.25em] font-bold px-5 py-1.5 uppercase">Recomendado</span>
                <h3 className="text-white text-xl font-light tracking-[0.12em]">Mentoria Especialista</h3>
                <p className="text-white/35 text-sm font-light mt-2">Foco B2B e Implementação Real.</p>
                <div className="mt-6">
                  <span className="text-4xl font-extralight text-white">R$ 499,90</span>
                  <span className="text-white/35 text-sm font-light ml-2">/online</span>
                </div>
                <p className="text-white/25 text-xs mt-1.5">Presencial sob consulta</p>
                <ul className="mt-8 space-y-3">
                  {['Tudo do Curso Gravado incluso', 'Sessões ao vivo com especialista', 'Implementação no seu escritório', 'Suporte personalizado e direto', 'Estratégia de posicionamento B2B', 'Acompanhamento de resultados reais'].map((item, i) => (
                    <li key={i} className="flex items-start gap-3 text-white/55 text-sm font-light leading-relaxed">
                      <svg className="w-4 h-4 text-[#00f5ff] mt-[3px] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                      {item}
                    </li>
                  ))}
                </ul>
                {/* mt-auto pushes button to bottom of card */}
                <button className="mt-auto w-full bg-[#00f5ff] text-[#030507] font-semibold py-4 text-sm tracking-wider hover:bg-[#00d4dd] hover:shadow-lg hover:shadow-[#00f5ff]/20 transition-all duration-300 rounded-sm">Falar com Consultor</button>
              </div>
            </div>
          </div>
        </section>

        {/* ─────────────── FOOTER ─────────────── */}
        <footer className="py-16 px-6 text-center pointer-events-auto">
          <div className={`backdrop-blur-md border border-white/[0.05] rounded-2xl p-10 max-w-2xl mx-auto`} style={{ backgroundColor: 'rgba(3,5,7,0.85)' }}>
            <h3 className="text-2xl font-extralight tracking-[0.35em] text-white">ARQ<span className="text-[#00f5ff]">AI</span></h3>
            <p className="text-white/35 text-sm font-light mt-4 leading-relaxed max-w-md mx-auto">A arquitetura e o design do futuro combinados com a inteligência artificial.</p>
            <div className="flex items-center justify-center gap-8 mt-8">
              <a href="#" className="text-white/35 text-sm tracking-wider hover:text-[#00f5ff] transition-colors duration-300">WhatsApp</a>
              <span className="text-white/10">|</span>
              <a href="#" className="text-white/35 text-sm tracking-wider hover:text-[#00f5ff] transition-colors duration-300">Instagram</a>
              <span className="text-white/10">|</span>
              <a href="#" className="text-white/35 text-sm tracking-wider hover:text-[#00f5ff] transition-colors duration-300">Email</a>
            </div>
          </div>
        </footer>
      </div>
    </>
  )
}
