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
      camera.position.set(8, 3, 8)

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
      // Clean ambient for general visibility
      const ambientLight = new THREE.AmbientLight(0xffffff, 0.8)
      scene.add(ambientLight)

      // Soft directional sunlight through apartment windows
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

      // Soft fill from opposite side
      const fillLight = new THREE.DirectionalLight(0xddeeff, 0.4)
      fillLight.position.set(-4, 3, -2)
      scene.add(fillLight)

      // Hemisphere light for natural sky/ground bounce
      const hemiLight = new THREE.HemisphereLight(0xcce0ff, 0x222222, 0.3)
      scene.add(hemiLight)

      // Subtle accent rim light
      const rimLight = new THREE.PointLight(0x00f5ff, 0.3, 30)
      rimLight.position.set(0, 5, 0)
      scene.add(rimLight)

      // ─── Camera Data ───
      // Defaults for before model loads; will be recalculated after GLB loads
      const cameraData: Record<string, { pos: { x: number; y: number; z: number }; target: { x: number; y: number; z: number } }> = {
        section1: { pos: { x: 8, y: 3, z: 8 }, target: { x: 0, y: 2, z: 0 } },
        section2: { pos: { x: 3, y: 2.2, z: 2 }, target: { x: -1, y: 1.8, z: -2 } },
        section3: { pos: { x: -2, y: 2.5, z: 1 }, target: { x: -4, y: 2.2, z: -1 } },
        section4: { pos: { x: 6, y: 6, z: 6 }, target: { x: 0, y: 2, z: 0 } },
      }

      const currentTarget = new THREE.Vector3(0, 2, 0)

      // ─── Dynamic camera calculation based on loaded model ───
      const updateCameraForModel = (model: THREE.Group) => {
        const box = new THREE.Box3().setFromObject(model)
        const center = box.getCenter(new THREE.Vector3())
        const size = box.getSize(new THREE.Vector3())

        // Scale model to fit ~15 unit scene (good for interior walkthrough)
        const maxDim = Math.max(size.x, size.y, size.z)
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
        const cy = finalCenter.y
        const cz = finalCenter.z
        const sx = scaledSize.x
        const sy = scaledSize.y
        const sz = scaledSize.z

        // Section 1 (Hero): Wide-angle interior perspective - main living area
        cameraData.section1.pos = {
          x: cx + sx * 0.4,
          y: cy + sy * 0.15,
          z: cz + sz * 0.45
        }
        cameraData.section1.target = {
          x: cx - sx * 0.1,
          y: cy - sy * 0.05,
          z: cz - sz * 0.1
        }

        // Section 2 (Workflow): Moving forward into lounge/sitting area
        cameraData.section2.pos = {
          x: cx + sx * 0.05,
          y: cy - sy * 0.05,
          z: cz + sz * 0.15
        }
        cameraData.section2.target = {
          x: cx - sx * 0.2,
          y: cy - sy * 0.1,
          z: cz - sz * 0.2
        }

        // Section 3 (Solution): Tight macro pan along wall/window surface
        cameraData.section3.pos = {
          x: cx - sx * 0.25,
          y: cy + sy * 0.05,
          z: cz - sz * 0.05
        }
        cameraData.section3.target = {
          x: cx - sx * 0.35,
          y: cy - sy * 0.05,
          z: cz - sz * 0.15
        }

        // Section 4 (Pricing): Elevated wide shot from corner
        cameraData.section4.pos = {
          x: cx + sx * 0.35,
          y: cy + sy * 0.6,
          z: cz + sz * 0.35
        }
        cameraData.section4.target = {
          x: cx,
          y: cy - sy * 0.1,
          z: cz
        }

        // Set initial camera
        camera.position.set(
          cameraData.section1.pos.x,
          cameraData.section1.pos.y,
          cameraData.section1.pos.z
        )
        currentTarget.set(
          cameraData.section1.target.x,
          cameraData.section1.target.y,
          cameraData.section1.target.z
        )

        // Update sun position relative to model
        sunLight.position.set(cx + sx * 0.3, cy + sy * 1.2, cz + sz * 0.2)
        sunLight.target.position.set(cx, cy, cz)
        sunLight.target.updateMatrixWorld()

        // Update rim light
        rimLight.position.set(cx, cy + sy * 0.5, cz)
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

          // Rebuild scroll animations after model loads
          setTimeout(() => {
            camera.position.set(
              cameraData.section1.pos.x,
              cameraData.section1.pos.y,
              cameraData.section1.pos.z
            )
            currentTarget.set(
              cameraData.section1.target.x,
              cameraData.section1.target.y,
              cameraData.section1.target.z
            )
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

      // Fallback timeout for slow connections
      setTimeout(() => {
        if (!glbLoaded && !sceneReady && !cleanup) {
          sceneReady = true
          setLoadProgress(100)
          setTimeout(() => setLoading(false), 800)
        }
      }, 10000)

      // ─── GSAP ScrollTrigger Setup ───
      const setupScrollAnimations = () => {
        // Kill existing ScrollTrigger instances
        ScrollTrigger.getAll().forEach(st => st.kill())
        gsap.killTweensOf(camera.position)
        gsap.killTweensOf(currentTarget)

        const sections = scrollContainerRef.current?.querySelectorAll('.arqai-section')
        if (sections && sections.length >= 4) {
          // Section 1 → 2: Move deeper into apartment
          gsap.to(camera.position, {
            x: cameraData.section2.pos.x,
            y: cameraData.section2.pos.y,
            z: cameraData.section2.pos.z,
            scrollTrigger: {
              trigger: sections[1],
              start: 'top bottom',
              end: 'top top',
              scrub: 2,
            },
          })
          gsap.to(currentTarget, {
            x: cameraData.section2.target.x,
            y: cameraData.section2.target.y,
            z: cameraData.section2.target.z,
            scrollTrigger: {
              trigger: sections[1],
              start: 'top bottom',
              end: 'top top',
              scrub: 2,
            },
          })

          // Section 2 → 3: Tight pan along wall/window detail
          gsap.to(camera.position, {
            x: cameraData.section3.pos.x,
            y: cameraData.section3.pos.y,
            z: cameraData.section3.pos.z,
            scrollTrigger: {
              trigger: sections[2],
              start: 'top bottom',
              end: 'top top',
              scrub: 2,
            },
          })
          gsap.to(currentTarget, {
            x: cameraData.section3.target.x,
            y: cameraData.section3.target.y,
            z: cameraData.section3.target.z,
            scrollTrigger: {
              trigger: sections[2],
              start: 'top bottom',
              end: 'top top',
              scrub: 2,
            },
          })

          // Section 3 → 4: Elevated wide shot pull-back
          gsap.to(camera.position, {
            x: cameraData.section4.pos.x,
            y: cameraData.section4.pos.y,
            z: cameraData.section4.pos.z,
            scrollTrigger: {
              trigger: sections[3],
              start: 'top bottom',
              end: 'top top',
              scrub: 2,
            },
          })
          gsap.to(currentTarget, {
            x: cameraData.section4.target.x,
            y: cameraData.section4.target.y,
            z: cameraData.section4.target.z,
            scrollTrigger: {
              trigger: sections[3],
              start: 'top bottom',
              end: 'top top',
              scrub: 2,
            },
          })
        }

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

        // Subtle camera breathing
        camera.position.x += Math.sin(elapsed * 0.12) * 0.003
        camera.position.y += Math.cos(elapsed * 0.15) * 0.002

        camera.lookAt(currentTarget)

        // Subtle rim light pulse
        rimLight.intensity = 0.3 + Math.sin(elapsed * 0.8) * 0.05

        renderer.render(scene, camera)
      }
      animate()

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
