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

      // Scene setup
      const scene = new THREE.Scene()
      scene.background = new THREE.Color(0x030507)
      scene.fog = new THREE.FogExp2(0x030507, 0.01)

      const camera = new THREE.PerspectiveCamera(40, window.innerWidth / window.innerHeight, 0.1, 1000)
      camera.position.set(22, 10, 28)

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
      renderer.toneMappingExposure = 1.3
      renderer.outputColorSpace = THREE.SRGBColorSpace

      // Lighting
      const ambientLight = new THREE.AmbientLight(0x404060, 0.8)
      scene.add(ambientLight)

      const sunLight = new THREE.DirectionalLight(0xffeedd, 3)
      sunLight.position.set(30, 40, 20)
      sunLight.castShadow = true
      sunLight.shadow.mapSize.width = 2048
      sunLight.shadow.mapSize.height = 2048
      sunLight.shadow.camera.near = 0.5
      sunLight.shadow.camera.far = 150
      sunLight.shadow.camera.left = -50
      sunLight.shadow.camera.right = 50
      sunLight.shadow.camera.top = 50
      sunLight.shadow.camera.bottom = -50
      sunLight.shadow.bias = -0.0005
      scene.add(sunLight)

      const fillLight = new THREE.DirectionalLight(0x8899cc, 0.5)
      fillLight.position.set(-20, 10, -10)
      scene.add(fillLight)

      const rimLight = new THREE.DirectionalLight(0x00f5ff, 0.12)
      rimLight.position.set(-10, 5, 30)
      scene.add(rimLight)

      // Hemisphere light for natural sky contribution
      const hemiLight = new THREE.HemisphereLight(0x446688, 0x223322, 0.3)
      scene.add(hemiLight)

      // Materials
      const whiteConcrete = new THREE.MeshStandardMaterial({
        color: 0xe8e8e8,
        roughness: 0.65,
        metalness: 0.0,
      })
      const darkConcrete = new THREE.MeshStandardMaterial({
        color: 0x3a3a3a,
        roughness: 0.8,
        metalness: 0.0,
      })
      const glassMat = new THREE.MeshPhysicalMaterial({
        color: 0x88ccff,
        transparent: true,
        opacity: 0.2,
        metalness: 0.1,
        roughness: 0.05,
        transmission: 0.9,
        thickness: 0.5,
        envMapIntensity: 1.0,
      })
      const woodMat = new THREE.MeshStandardMaterial({
        color: 0x8B6914,
        roughness: 0.55,
        metalness: 0.0,
      })
      const waterMat = new THREE.MeshPhysicalMaterial({
        color: 0x006688,
        roughness: 0.1,
        metalness: 0.3,
        transparent: true,
        opacity: 0.85,
      })
      const poolWaterMat = new THREE.MeshPhysicalMaterial({
        color: 0x00bbdd,
        roughness: 0.05,
        metalness: 0.2,
        transparent: true,
        opacity: 0.65,
      })
      const terrainMat = new THREE.MeshStandardMaterial({
        color: 0x2d5a1e,
        roughness: 0.9,
        metalness: 0.0,
      })
      const stoneMat = new THREE.MeshStandardMaterial({
        color: 0x888888,
        roughness: 0.9,
        metalness: 0.0,
      })

      // Create villa group
      const villa = new THREE.Group()

      // Main building - ground floor
      const mainFloor = new THREE.Mesh(
        new THREE.BoxGeometry(22, 4, 16),
        whiteConcrete
      )
      mainFloor.position.set(0, 2, 0)
      mainFloor.castShadow = true
      mainFloor.receiveShadow = true
      villa.add(mainFloor)

      // Second floor volume (offset)
      const secondFloor = new THREE.Mesh(
        new THREE.BoxGeometry(18, 3.5, 14),
        whiteConcrete
      )
      secondFloor.position.set(2, 5.75, -1)
      secondFloor.castShadow = true
      secondFloor.receiveShadow = true
      villa.add(secondFloor)

      // Third floor element (cantilevered)
      const thirdFloor = new THREE.Mesh(
        new THREE.BoxGeometry(12, 3, 10),
        whiteConcrete
      )
      thirdFloor.position.set(-4, 9, -2)
      thirdFloor.castShadow = true
      thirdFloor.receiveShadow = true
      villa.add(thirdFloor)

      // Dark accent band (ground floor base)
      const baseBand = new THREE.Mesh(
        new THREE.BoxGeometry(22.2, 0.8, 16.2),
        darkConcrete
      )
      baseBand.position.set(0, 0.4, 0)
      baseBand.castShadow = true
      baseBand.receiveShadow = true
      villa.add(baseBand)

      // Front glass wall - ground floor
      const frontGlass1 = new THREE.Mesh(
        new THREE.BoxGeometry(12, 3.2, 0.08),
        glassMat
      )
      frontGlass1.position.set(0, 2, 8.04)
      villa.add(frontGlass1)

      // Front glass wall - second floor
      const frontGlass2 = new THREE.Mesh(
        new THREE.BoxGeometry(10, 2.8, 0.08),
        glassMat
      )
      frontGlass2.position.set(2, 5.9, 6.04)
      villa.add(frontGlass2)

      // Side glass panels
      const sideGlass1 = new THREE.Mesh(
        new THREE.BoxGeometry(0.08, 3.2, 8),
        glassMat
      )
      sideGlass1.position.set(11.04, 2, 0)
      villa.add(sideGlass1)

      const sideGlass2 = new THREE.Mesh(
        new THREE.BoxGeometry(0.08, 2.8, 6),
        glassMat
      )
      sideGlass2.position.set(-10.04, 5.9, -1)
      villa.add(sideGlass2)

      // Back glass (looking at ocean)
      const backGlass = new THREE.Mesh(
        new THREE.BoxGeometry(16, 3.2, 0.08),
        glassMat
      )
      backGlass.position.set(0, 2, -8.04)
      villa.add(backGlass)

      // Third floor glass
      const thirdGlass = new THREE.Mesh(
        new THREE.BoxGeometry(8, 2.5, 0.08),
        glassMat
      )
      thirdGlass.position.set(-4, 9, 3.04)
      villa.add(thirdGlass)

      // Wooden deck / terrace
      const terrace = new THREE.Mesh(
        new THREE.BoxGeometry(10, 0.2, 6),
        woodMat
      )
      terrace.position.set(0, 4.0, 11)
      terrace.castShadow = true
      terrace.receiveShadow = true
      villa.add(terrace)

      // Second floor balcony
      const balcony = new THREE.Mesh(
        new THREE.BoxGeometry(8, 0.2, 4),
        woodMat
      )
      balcony.position.set(2, 7.5, 8)
      balcony.castShadow = true
      balcony.receiveShadow = true
      villa.add(balcony)

      // Balcony railing
      const railingMat = new THREE.MeshStandardMaterial({ color: 0xcccccc, roughness: 0.3, metalness: 0.8 })
      for (let i = 0; i < 8; i++) {
        const rail = new THREE.Mesh(
          new THREE.BoxGeometry(0.05, 1, 0.05),
          railingMat
        )
        rail.position.set(-1.5 + i * 0.9, 8.1, 9.5)
        villa.add(rail)
      }
      const railTop = new THREE.Mesh(
        new THREE.BoxGeometry(8, 0.05, 0.08),
        railingMat
      )
      railTop.position.set(2, 8.6, 9.5)
      villa.add(railTop)

      // Terrace railing
      for (let i = 0; i < 10; i++) {
        const rail = new THREE.Mesh(
          new THREE.BoxGeometry(0.05, 1, 0.05),
          railingMat
        )
        rail.position.set(-4 + i * 1.0, 4.6, 13.5)
        villa.add(rail)
      }
      const terrRailTop = new THREE.Mesh(
        new THREE.BoxGeometry(10, 0.05, 0.08),
        railingMat
      )
      terrRailTop.position.set(0, 5.1, 13.5)
      villa.add(terrRailTop)

      // Infinity pool
      const poolShell = new THREE.Mesh(
        new THREE.BoxGeometry(8, 1.2, 4),
        darkConcrete
      )
      poolShell.position.set(0, 0.2, 16)
      poolShell.castShadow = true
      villa.add(poolShell)

      const poolWater = new THREE.Mesh(
        new THREE.BoxGeometry(7.6, 0.05, 3.6),
        poolWaterMat
      )
      poolWater.position.set(0, 0.78, 16)
      villa.add(poolWater)

      // Garage volume
      const garage = new THREE.Mesh(
        new THREE.BoxGeometry(6, 3, 8),
        darkConcrete
      )
      garage.position.set(-14, 1.5, 2)
      garage.castShadow = true
      garage.receiveShadow = true
      villa.add(garage)

      const garageDoor = new THREE.Mesh(
        new THREE.BoxGeometry(4, 2.5, 0.08),
        new THREE.MeshStandardMaterial({ color: 0x555555, roughness: 0.5, metalness: 0.3 })
      )
      garageDoor.position.set(-14, 1.5, 6.04)
      villa.add(garageDoor)

      // Entry canopy
      const canopy = new THREE.Mesh(
        new THREE.BoxGeometry(6, 0.15, 3),
        whiteConcrete
      )
      canopy.position.set(0, 4.1, 9.5)
      canopy.castShadow = true
      villa.add(canopy)

      // Canopy supports
      const supportMat = new THREE.MeshStandardMaterial({ color: 0x999999, roughness: 0.3, metalness: 0.7 })
      const support1 = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 3.9, 8), supportMat)
      support1.position.set(-2.8, 2.05, 10.8)
      villa.add(support1)
      const support2 = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 3.9, 8), supportMat)
      support2.position.set(2.8, 2.05, 10.8)
      villa.add(support2)

      // Roof slab (flat roof)
      const roofSlab = new THREE.Mesh(
        new THREE.BoxGeometry(20, 0.3, 16),
        darkConcrete
      )
      roofSlab.position.set(0, 11.15, -2)
      roofSlab.castShadow = true
      villa.add(roofSlab)

      // Third floor roof
      const roof3 = new THREE.Mesh(
        new THREE.BoxGeometry(14, 0.3, 12),
        darkConcrete
      )
      roof3.position.set(-4, 10.65, -2)
      roof3.castShadow = true
      villa.add(roof3)

      // Driveway
      const driveway = new THREE.Mesh(
        new THREE.BoxGeometry(4, 0.05, 15),
        stoneMat
      )
      driveway.position.set(-14, 0.02, 12)
      driveway.receiveShadow = true
      villa.add(driveway)

      // Entry path
      const entryPath = new THREE.Mesh(
        new THREE.BoxGeometry(2, 0.05, 5),
        stoneMat
      )
      entryPath.position.set(0, 0.02, 10.5)
      entryPath.receiveShadow = true
      villa.add(entryPath)

      // Interior warm lights (emissive to simulate interior lighting)
      const interiorLightMat = new THREE.MeshStandardMaterial({
        color: 0xffeedd,
        emissive: 0xffeedd,
        emissiveIntensity: 0.8,
      })
      const intLightPositions = [
        [3, 3.9, 2], [-3, 3.9, -2], [6, 3.9, 4], [-6, 3.9, -4],
        [0, 3.9, 5], [0, 3.9, -5], [4, 7.6, 0], [-2, 7.6, -3],
      ]
      intLightPositions.forEach(([lx, ly, lz]) => {
        const intLight = new THREE.Mesh(
          new THREE.BoxGeometry(0.8, 0.04, 0.8),
          interiorLightMat
        )
        intLight.position.set(lx, ly, lz)
        villa.add(intLight)
      })

      // Point lights for interior warm glow
      const interiorPL1 = new THREE.PointLight(0xffeedd, 1.5, 15)
      interiorPL1.position.set(0, 3, 0)
      villa.add(interiorPL1)

      const interiorPL2 = new THREE.PointLight(0xffeedd, 1.0, 15)
      interiorPL2.position.set(2, 7, -1)
      villa.add(interiorPL2)

      // Outdoor furniture (simple)
      const loungeMat = new THREE.MeshStandardMaterial({ color: 0xdddddd, roughness: 0.5 })
      const lounge1 = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.3, 2), loungeMat)
      lounge1.position.set(3, 4.2, 12)
      lounge1.castShadow = true
      villa.add(lounge1)

      const lounge2 = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.3, 2), loungeMat)
      lounge2.position.set(-2, 4.2, 12)
      lounge2.castShadow = true
      villa.add(lounge2)

      // Small table
      const tableMat = new THREE.MeshStandardMaterial({ color: 0x666666, roughness: 0.3, metalness: 0.5 })
      const table = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.05, 16), tableMat)
      table.position.set(0.5, 4.15, 12)
      villa.add(table)
      const tableLeg = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.3, 8), tableMat)
      tableLeg.position.set(0.5, 4.0, 12)
      villa.add(tableLeg)

      scene.add(villa)

      // Terrain / Hill
      const terrainGeom = new THREE.PlaneGeometry(200, 200, 80, 80)
      const vertices = terrainGeom.attributes.position.array
      for (let i = 0; i < vertices.length; i += 3) {
        const x = vertices[i]
        const y = vertices[i + 1]
        let height = -1.5
        const distFromCenter = Math.sqrt(x * x + y * y)
        if (distFromCenter < 35) {
          height += Math.max(0, (35 - distFromCenter) * 0.08)
        }
        if (y < -20) {
          height += Math.abs(y + 20) * 0.15
        }
        if (Math.abs(x) < 20 && Math.abs(y) < 20) {
          height = Math.max(height, -0.5)
        }
        if (y > 20) {
          height = Math.min(height, -2)
        }
        vertices[i + 2] = height
      }
      terrainGeom.computeVertexNormals()
      const terrain = new THREE.Mesh(terrainGeom, terrainMat)
      terrain.rotation.x = -Math.PI / 2
      terrain.position.y = -0.5
      terrain.receiveShadow = true
      scene.add(terrain)

      // Ocean
      const oceanGeom = new THREE.PlaneGeometry(300, 150)
      const ocean = new THREE.Mesh(oceanGeom, waterMat)
      ocean.rotation.x = -Math.PI / 2
      ocean.position.set(0, -2.5, -50)
      scene.add(ocean)

      // Palm trees
      const createPalmTree = (x: number, z: number, height: number = 8) => {
        const group = new THREE.Group()
        const trunkGeom = new THREE.CylinderGeometry(0.15, 0.25, height, 8)
        const trunkMat = new THREE.MeshStandardMaterial({ color: 0x6B4226, roughness: 0.8 })
        const trunk = new THREE.Mesh(trunkGeom, trunkMat)
        trunk.position.set(0, height / 2, 0)
        trunk.castShadow = true
        group.add(trunk)

        const leafMat = new THREE.MeshStandardMaterial({ color: 0x228B22, roughness: 0.7, side: THREE.DoubleSide })
        for (let i = 0; i < 7; i++) {
          const angle = (i / 7) * Math.PI * 2
          const leafShape = new THREE.Shape()
          leafShape.moveTo(0, 0)
          leafShape.quadraticCurveTo(1.5, 1.5, 4, 0.5)
          leafShape.quadraticCurveTo(1.5, 0.5, 0, 0)
          const leafGeom = new THREE.ShapeGeometry(leafShape)
          const leaf = new THREE.Mesh(leafGeom, leafMat)
          leaf.position.set(0, height, 0)
          leaf.rotation.set(-0.4, angle, 0)
          leaf.castShadow = true
          group.add(leaf)
        }
        group.position.set(x, -0.5, z)
        return group
      }

      scene.add(createPalmTree(16, 10, 7))
      scene.add(createPalmTree(-18, 12, 9))
      scene.add(createPalmTree(20, -5, 6))
      scene.add(createPalmTree(-22, -8, 8))
      scene.add(createPalmTree(25, 18, 7))
      scene.add(createPalmTree(-8, 20, 6))

      // Landscape bushes
      const bushGeom = new THREE.SphereGeometry(0.8, 8, 6)
      const bushMat = new THREE.MeshStandardMaterial({ color: 0x1a5c1a, roughness: 0.9 })
      const bushPositions = [
        [8, -0.1, 9], [-8, -0.1, 9], [12, -0.1, 4], [-12, -0.1, 4],
        [5, -0.1, -9], [-5, -0.1, -9], [15, -0.1, -3], [-15, -0.1, 0],
        [10, -0.1, -6], [-10, -0.1, -6],
      ]
      bushPositions.forEach(([bx, by, bz]) => {
        const bush = new THREE.Mesh(bushGeom, bushMat)
        bush.position.set(bx, by, bz)
        bush.scale.set(1, 0.7, 1)
        bush.castShadow = true
        scene.add(bush)
      })

      // Steps to entrance
      for (let i = 0; i < 3; i++) {
        const step = new THREE.Mesh(
          new THREE.BoxGeometry(3, 0.2, 0.8),
          stoneMat
        )
        step.position.set(0, 0.1 + i * 0.2, 8 + i * 0.8)
        step.receiveShadow = true
        scene.add(step)
      }

      // Garden wall
      const gardenWall = new THREE.Mesh(
        new THREE.BoxGeometry(30, 1.5, 0.3),
        stoneMat
      )
      gardenWall.position.set(0, 0.5, 20)
      gardenWall.castShadow = true
      gardenWall.receiveShadow = true
      scene.add(gardenWall)

      // Try to load GLB model (fallback: use procedural scene)
      let glbLoaded = false
      let sceneReady = false

      const loader = new GLTFLoader()
      loader.load(
        '/assets/villa.glb',
        (gltf) => {
          if (cleanup) return
          glbLoaded = true
          scene.remove(villa)
          const model = gltf.scene
          model.traverse((child) => {
            if ((child as THREE.Mesh).isMesh) {
              child.castShadow = true
              child.receiveShadow = true
            }
          })
          const box = new THREE.Box3().setFromObject(model)
          const center = box.getCenter(new THREE.Vector3())
          const size = box.getSize(new THREE.Vector3())
          const maxDim = Math.max(size.x, size.y, size.z)
          const scale = 20 / maxDim
          model.scale.setScalar(scale)
          model.position.sub(center.multiplyScalar(scale))
          model.position.y -= box.min.y * scale
          scene.add(model)
          sceneReady = true
          setLoadProgress(100)
          setTimeout(() => setLoading(false), 800)
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

      // Fallback: show procedural scene after timeout
      setTimeout(() => {
        if (!glbLoaded && !sceneReady && !cleanup) {
          sceneReady = true
          setLoadProgress(100)
          setTimeout(() => setLoading(false), 800)
        }
      }, 2500)

      // Camera animation targets for each section
      const cameraData = {
        section1: { pos: { x: 22, y: 10, z: 28 }, target: { x: 0, y: 4, z: 0 } },
        section2: { pos: { x: 5, y: 5, z: 10 }, target: { x: 0, y: 4, z: -4 } },
        section3: { pos: { x: -3, y: 5, z: -2 }, target: { x: -2, y: 4, z: -6 } },
        section4: { pos: { x: 35, y: 22, z: 40 }, target: { x: 0, y: 5, z: 0 } },
      }

      const currentTarget = new THREE.Vector3(0, 4, 0)

      // GSAP ScrollTrigger camera animations
      const sections = scrollContainerRef.current?.querySelectorAll('.arqai-section')
      if (sections && sections.length >= 4) {
        // Section 1 -> 2 transition
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

        // Section 2 -> 3 transition
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

        // Section 3 -> 4 transition
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

      // GSAP scroll-reveal animations for content cards
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

      // Animation loop
      const clock = new THREE.Clock()
      const animate = () => {
        if (cleanup) return
        animationId = requestAnimationFrame(animate)
        const elapsed = clock.getElapsedTime()

        // Subtle camera breathing
        camera.position.x += Math.sin(elapsed * 0.12) * 0.008
        camera.position.y += Math.cos(elapsed * 0.15) * 0.004

        camera.lookAt(currentTarget)

        // Animate pool water shimmer
        poolWater.material = poolWaterMat
        poolWater.position.y = 0.78 + Math.sin(elapsed * 1.5) * 0.012

        // Animate ocean slight movement
        ocean.position.y = -2.5 + Math.sin(elapsed * 0.5) * 0.05

        renderer.render(scene, camera)
      }
      animate()

      // Resize handler
      const handleResize = () => {
        camera.aspect = window.innerWidth / window.innerHeight
        camera.updateProjectionMatrix()
        renderer.setSize(window.innerWidth, window.innerHeight)
      }
      window.addEventListener('resize', handleResize)

      // Refresh ScrollTrigger after layout stabilizes
      const refreshInterval = setInterval(() => {
        ScrollTrigger.refresh()
      }, 1000)

      setTimeout(() => clearInterval(refreshInterval), 5000)

      // Store cleanup
      const destroy = () => {
        cleanup = true
        window.removeEventListener('resize', handleResize)
        cancelAnimationFrame(animationId)
        clearInterval(refreshInterval)
        ScrollTrigger.getAll().forEach(t => t.kill())
        renderer.dispose()
        scene.clear()
      }

      // Attach cleanup to window for component unmount
      ;(window as unknown as Record<string, () => void>).__arqaiCleanup = destroy
    }

    initScene()

    return () => {
      const cleanupFn = (window as unknown as Record<string, (() => void) | undefined>).__arqaiCleanup
      if (cleanupFn) cleanupFn()
    }
  }, [])

  return (
    <>
      {/* Loading Screen */}
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

      {/* Three.js Canvas (fixed background) */}
      <canvas
        ref={canvasRef}
        className="fixed inset-0 w-full h-full"
        style={{ zIndex: 0, pointerEvents: 'none' }}
      />

      {/* Scrollable HTML Content Overlay */}
      <div
        ref={scrollContainerRef}
        className="relative"
        style={{ zIndex: 1, pointerEvents: 'none' }}
      >
        {/* Navbar */}
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

        {/* Section 1: Hero */}
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

        {/* Section 2: Workflow */}
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

        {/* Section 3: Solution */}
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

        {/* Section 4: Pricing */}
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

        {/* Footer */}
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
