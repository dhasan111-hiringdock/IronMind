import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import type { GLTFLoader as GLTFLoaderType } from 'three/examples/jsm/loaders/GLTFLoader.js';

type Body3DProps = {
  primaryMuscles?: string[];
  secondaryMuscles?: string[];
  className?: string;
  modelUrl?: string;
};

type MuscleGroup =
  | 'Chest'
  | 'Back'
  | 'Shoulders'
  | 'Biceps'
  | 'Triceps'
  | 'Forearms'
  | 'Quads'
  | 'Hamstrings'
  | 'Glutes'
  | 'Abs'
  | 'Calves';

export const getMuscleGroupFromLabel = (label: string, primaryMuscles?: string[]): MuscleGroup => {
  const l = (label || '').toLowerCase();
  if (l.includes('bicep')) return 'Biceps';
  if (l.includes('tricep')) return 'Triceps';
  if (l.includes('pect') || l.includes('chest')) return 'Chest';
  if (l.includes('lat') || l.includes('back')) return 'Back';
  if (l.includes('quad') || l.includes('quadriceps')) return 'Quads';
  if (l.includes('hamstring')) return 'Hamstrings';
  if (l.includes('glute')) return 'Glutes';
  if (l.includes('calf') || l.includes('soleus') || l.includes('gastro')) return 'Calves';
  if (l.includes('abs') || l.includes('rectus') || l.includes('core')) return 'Abs';
  if (l.includes('deltoid') || l.includes('shoulder')) return 'Shoulders';
  const m = (primaryMuscles || [])[0]?.toLowerCase() || '';
  if (m.includes('bicep')) return 'Biceps';
  if (m.includes('tricep')) return 'Triceps';
  if (m.includes('chest') || m.includes('pect')) return 'Chest';
  if (m.includes('back') || m.includes('lat')) return 'Back';
  if (m.includes('quad') || m.includes('quadriceps')) return 'Quads';
  if (m.includes('hamstring')) return 'Hamstrings';
  if (m.includes('glute')) return 'Glutes';
  if (m.includes('calf')) return 'Calves';
  if (m.includes('abs') || m.includes('core')) return 'Abs';
  if (m.includes('shoulder') || m.includes('deltoid')) return 'Shoulders';
  return 'Back';
};

export function MuscleThumbnail({ group, className }: { group: MuscleGroup | string; className?: string }) {
  const neutral = '#cbd5e1';
  const g = typeof group === 'string' ? (group as string) : String(group);
  const is = (target: MuscleGroup) => g.toLowerCase() === target.toLowerCase();
  const colorFor = (target: MuscleGroup): { from: string; to: string } => {
    switch (target) {
      case 'Chest':
        return { from: '#fb7185', to: '#f472b6' };
      case 'Back':
        return { from: '#22d3ee', to: '#60a5fa' };
      case 'Shoulders':
        return { from: '#a78bfa', to: '#c084fc' };
      case 'Biceps':
        return { from: '#f43f5e', to: '#fb7185' };
      case 'Triceps':
        return { from: '#f59e0b', to: '#fbbf24' };
      case 'Forearms':
        return { from: '#22d3ee', to: '#06b6d4' };
      case 'Quads':
        return { from: '#34d399', to: '#10b981' };
      case 'Hamstrings':
        return { from: '#f59e0b', to: '#f97316' };
      case 'Glutes':
        return { from: '#8b5cf6', to: '#a78bfa' };
      case 'Abs':
        return { from: '#06b6d4', to: '#22d3ee' };
      case 'Calves':
        return { from: '#6366f1', to: '#818cf8' };
      default:
        return { from: '#ef4444', to: '#f97316' };
    }
  };
  const grad = colorFor(g.toLowerCase() as MuscleGroup);
  const gradId = `grad-${g.toLowerCase()}`;
  return (
    <svg viewBox="0 0 64 64" className={className ?? 'w-6 h-6'} role="img" aria-label={`${g} muscle thumbnail`}>
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={grad.from} />
          <stop offset="100%" stopColor={grad.to} />
        </linearGradient>
        <filter id="shadow" x="-50%" y="-50%" width="200%" height="200%">
          <feDropShadow dx="0" dy="1" stdDeviation="1.5" floodColor="#000000" floodOpacity="0.25" />
        </filter>
      </defs>
      <circle cx="32" cy="10" r="6" fill={neutral} />
      <rect x="24" y="16" width="16" height="24" rx="4" fill={neutral} />
      <circle cx="24" cy="20" r="4" fill={neutral} />
      <circle cx="40" cy="20" r="4" fill={neutral} />
      <rect x="14" y="20" width="8" height="14" rx="3" fill={neutral} />
      <rect x="42" y="20" width="8" height="14" rx="3" fill={neutral} />
      <rect x="12" y="34" width="10" height="14" rx="3" fill={neutral} />
      <rect x="42" y="34" width="10" height="14" rx="3" fill={neutral} />
      <rect x="26" y="40" width="8" height="14" rx="3" fill={neutral} />
      <rect x="34" y="40" width="8" height="14" rx="3" fill={neutral} />
      <rect x="26" y="54" width="8" height="10" rx="3" fill={neutral} />
      <rect x="34" y="54" width="8" height="10" rx="3" fill={neutral} />
      {is('Chest') && <rect x="24" y="22" width="16" height="8" rx="3" fill={`url(#${gradId})`} filter="url(#shadow)" />}
      {is('Back') && <rect x="24" y="22" width="16" height="8" rx="3" fill={`url(#${gradId})`} filter="url(#shadow)" />}
      {is('Abs') && <rect x="26" y="30" width="12" height="8" rx="3" fill={`url(#${gradId})`} filter="url(#shadow)" />}
      {is('Shoulders') && (
        <>
          <circle cx="24" cy="20" r="4" fill={`url(#${gradId})`} filter="url(#shadow)" />
          <circle cx="40" cy="20" r="4" fill={`url(#${gradId})`} filter="url(#shadow)" />
        </>
      )}
      {is('Biceps') && (
        <>
          <rect x="14" y="20" width="8" height="14" rx="3" fill={`url(#${gradId})`} filter="url(#shadow)" />
          <rect x="42" y="20" width="8" height="14" rx="3" fill={`url(#${gradId})`} filter="url(#shadow)" />
        </>
      )}
      {is('Triceps') && (
        <>
          <rect x="14" y="20" width="8" height="14" rx="3" fill={`url(#${gradId})`} filter="url(#shadow)" />
          <rect x="42" y="20" width="8" height="14" rx="3" fill={`url(#${gradId})`} filter="url(#shadow)" />
        </>
      )}
      {is('Forearms') && (
        <>
          <rect x="12" y="34" width="10" height="14" rx="3" fill={`url(#${gradId})`} filter="url(#shadow)" />
          <rect x="42" y="34" width="10" height="14" rx="3" fill={`url(#${gradId})`} filter="url(#shadow)" />
        </>
      )}
      {is('Quads') && (
        <>
          <rect x="26" y="40" width="8" height="14" rx="3" fill={`url(#${gradId})`} filter="url(#shadow)" />
          <rect x="34" y="40" width="8" height="14" rx="3" fill={`url(#${gradId})`} filter="url(#shadow)" />
        </>
      )}
      {is('Hamstrings') && (
        <>
          <rect x="26" y="40" width="8" height="14" rx="3" fill={`url(#${gradId})`} filter="url(#shadow)" />
          <rect x="34" y="40" width="8" height="14" rx="3" fill={`url(#${gradId})`} filter="url(#shadow)" />
        </>
      )}
      {is('Glutes') && <rect x="24" y="36" width="16" height="6" rx="3" fill={`url(#${gradId})`} filter="url(#shadow)" />}
      {is('Calves') && (
        <>
          <rect x="26" y="54" width="8" height="10" rx="3" fill={`url(#${gradId})`} filter="url(#shadow)" />
          <rect x="34" y="54" width="8" height="10" rx="3" fill={`url(#${gradId})`} filter="url(#shadow)" />
        </>
      )}
    </svg>
  );
}

export function FocusBadge({ group, text, className }: { group: MuscleGroup | string; text?: string; className?: string }) {
  const g = typeof group === 'string' ? (group as string) : String(group);
  const colorFor = (target: MuscleGroup): { from: string; to: string } => {
    switch (target) {
      case 'Chest':
        return { from: '#fb7185', to: '#f472b6' };
      case 'Back':
        return { from: '#22d3ee', to: '#60a5fa' };
      case 'Shoulders':
        return { from: '#a78bfa', to: '#c084fc' };
      case 'Biceps':
        return { from: '#f43f5e', to: '#fb7185' };
      case 'Triceps':
        return { from: '#f59e0b', to: '#fbbf24' };
      case 'Forearms':
        return { from: '#22d3ee', to: '#06b6d4' };
      case 'Quads':
        return { from: '#34d399', to: '#10b981' };
      case 'Hamstrings':
        return { from: '#f59e0b', to: '#f97316' };
      case 'Glutes':
        return { from: '#8b5cf6', to: '#a78bfa' };
      case 'Abs':
        return { from: '#06b6d4', to: '#22d3ee' };
      case 'Calves':
        return { from: '#6366f1', to: '#818cf8' };
      default:
        return { from: '#ef4444', to: '#f97316' };
    }
  };
  const grad = colorFor(g.toLowerCase() as MuscleGroup);
  return (
    <span className={`px-3 py-2 bg-white/10 border border-white/20 rounded-md text-white/80 inline-flex items-center gap-3 shadow-sm ${className ?? ''}`}>
      <MuscleThumbnail group={group} className="w-8 h-8" />
      <span className="font-medium">Focus:</span>
      <span>{text ?? g}</span>
      <span className="w-2 h-2 rounded-full" style={{ backgroundImage: `linear-gradient(to bottom, ${grad.from}, ${grad.to})` }} />
    </span>
  );
}

export function MuscleSpotlight({ group, className }: { group: MuscleGroup | string; className?: string }) {
  const g = typeof group === 'string' ? (group as string) : String(group);
  const colorFor = (target: MuscleGroup): { from: string; to: string } => {
    switch (target) {
      case 'Chest':
        return { from: '#fb7185', to: '#f472b6' };
      case 'Back':
        return { from: '#22d3ee', to: '#60a5fa' };
      case 'Shoulders':
        return { from: '#a78bfa', to: '#c084fc' };
      case 'Biceps':
        return { from: '#f43f5e', to: '#fb7185' };
      case 'Triceps':
        return { from: '#f59e0b', to: '#fbbf24' };
      case 'Forearms':
        return { from: '#22d3ee', to: '#06b6d4' };
      case 'Quads':
        return { from: '#34d399', to: '#10b981' };
      case 'Hamstrings':
        return { from: '#f59e0b', to: '#f97316' };
      case 'Glutes':
        return { from: '#8b5cf6', to: '#a78bfa' };
      case 'Abs':
        return { from: '#06b6d4', to: '#22d3ee' };
      case 'Calves':
        return { from: '#6366f1', to: '#818cf8' };
      default:
        return { from: '#ef4444', to: '#f97316' };
    }
  };
  const grad = colorFor(g.toLowerCase() as MuscleGroup);
  const gradId = `spot-${g.toLowerCase()}`;
  const is = (target: MuscleGroup) => g.toLowerCase() === target.toLowerCase();
  return (
    <svg viewBox="0 0 64 64" className={className ?? 'w-16 h-16'} role="img" aria-label={`${g} muscle spotlight`}>
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={grad.from} />
          <stop offset="100%" stopColor={grad.to} />
        </linearGradient>
        <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
          <feDropShadow dx="0" dy="2" stdDeviation="2.5" floodColor="#000000" floodOpacity="0.35" />
        </filter>
      </defs>
      {is('Chest') && <rect x="16" y="20" width="32" height="16" rx="6" fill={`url(#${gradId})`} filter="url(#glow)" />}
      {is('Back') && <rect x="16" y="20" width="32" height="16" rx="6" fill={`url(#${gradId})`} filter="url(#glow)" />}
      {is('Abs') && <rect x="22" y="28" width="20" height="14" rx="6" fill={`url(#${gradId})`} filter="url(#glow)" />}
      {is('Shoulders') && (
        <>
          <circle cx="20" cy="22" r="6" fill={`url(#${gradId})`} filter="url(#glow)" />
          <circle cx="44" cy="22" r="6" fill={`url(#${gradId})`} filter="url(#glow)" />
        </>
      )}
      {is('Biceps') && (
        <>
          <rect x="10" y="22" width="12" height="20" rx="5" fill={`url(#${gradId})`} filter="url(#glow)" />
          <rect x="42" y="22" width="12" height="20" rx="5" fill={`url(#${gradId})`} filter="url(#glow)" />
        </>
      )}
      {is('Triceps') && (
        <>
          <rect x="10" y="22" width="12" height="20" rx="5" fill={`url(#${gradId})`} filter="url(#glow)" />
          <rect x="42" y="22" width="12" height="20" rx="5" fill={`url(#${gradId})`} filter="url(#glow)" />
        </>
      )}
      {is('Forearms') && (
        <>
          <rect x="8" y="38" width="14" height="16" rx="5" fill={`url(#${gradId})`} filter="url(#glow)" />
          <rect x="42" y="38" width="14" height="16" rx="5" fill={`url(#${gradId})`} filter="url(#glow)" />
        </>
      )}
      {is('Quads') && (
        <>
          <rect x="24" y="40" width="12" height="18" rx="5" fill={`url(#${gradId})`} filter="url(#glow)" />
          <rect x="36" y="40" width="12" height="18" rx="5" fill={`url(#${gradId})`} filter="url(#glow)" />
        </>
      )}
      {is('Hamstrings') && (
        <>
          <rect x="24" y="40" width="12" height="18" rx="5" fill={`url(#${gradId})`} filter="url(#glow)" />
          <rect x="36" y="40" width="12" height="18" rx="5" fill={`url(#${gradId})`} filter="url(#glow)" />
        </>
      )}
      {is('Glutes') && <rect x="20" y="36" width="24" height="10" rx="5" fill={`url(#${gradId})`} filter="url(#glow)" />}
      {is('Calves') && (
        <>
          <rect x="24" y="54" width="12" height="10" rx="5" fill={`url(#${gradId})`} filter="url(#glow)" />
          <rect x="36" y="54" width="12" height="10" rx="5" fill={`url(#${gradId})`} filter="url(#glow)" />
        </>
      )}
    </svg>
  );
}

export default function Body3D(props: Body3DProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const muscleMapRef = useRef<Record<string, THREE.Mesh>>({});
  const glowMapRef = useRef<Record<string, THREE.Mesh>>({});
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const frameIdRef = useRef<number | null>(null);
  const primarySetRef = useRef<Set<string>>(new Set());
  const secondarySetRef = useRef<Set<string>>(new Set());
  const modelGroupRef = useRef<THREE.Group | null>(null);
  const pulseRef = useRef<number>(0);

  useEffect(() => {
    primarySetRef.current = new Set((props.primaryMuscles || []).map(normalize));
    secondarySetRef.current = new Set((props.secondaryMuscles || []).map(normalize));
    applyHighlight();
  }, [props.primaryMuscles, props.secondaryMuscles]);

  useEffect(() => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    const container = containerRef.current!;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0b0f1a);
    sceneRef.current = scene;

    const aspect = container.clientWidth / Math.max(1, container.clientHeight);
    const camera = new THREE.PerspectiveCamera(45, aspect, 0.1, 100);
    camera.position.set(0, 1.8, 6);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(container.clientWidth, container.clientHeight);
    rendererRef.current = renderer;

    const ambient = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambient);
    const dir = new THREE.DirectionalLight(0xffffff, 0.8);
    dir.position.set(5, 10, 7.5);
    scene.add(dir);

    (async () => {
      if (props.modelUrl) {
        try {
          const mod = await import('three/examples/jsm/loaders/GLTFLoader.js');
          const GLTFLoaderCtor = (mod as { GLTFLoader: new () => GLTFLoaderType }).GLTFLoader;
          const loader = new GLTFLoaderCtor();
          const gltf = await loader.loadAsync(props.modelUrl);
          const model = gltf.scene as THREE.Group;
          scene.add(model);
          modelGroupRef.current = model;
          const mapLabels = (name: string) => {
            const n = name.toLowerCase();
            const labels: string[] = [];
            if (n.includes('bicep')) labels.push('Biceps');
            if (n.includes('tricep')) labels.push('Triceps');
            if (n.includes('pect') || n.includes('chest')) labels.push('Chest');
            if (n.includes('lat') || n.includes('back')) labels.push('Back');
            if (n.includes('quad')) labels.push('Quads');
            if (n.includes('hamstring')) labels.push('Hamstrings');
            if (n.includes('glute')) labels.push('Glutes');
            if (n.includes('calf') || n.includes('soleus') || n.includes('gastro')) labels.push('Calves');
            if (n.includes('abs') || n.includes('rectus') || n.includes('core')) labels.push('Abs');
            if (n.includes('deltoid') || n.includes('shoulder')) labels.push('Shoulders');
            if (n.includes('forearm') || n.includes('brachiorad')) labels.push('Forearms');
            return labels;
          };
          model.traverse((obj) => {
            const mesh = obj as THREE.Mesh;
            if (mesh.isMesh && mesh.geometry) {
              const labels = mapLabels(mesh.name);
              for (const lab of labels) {
                muscleMapRef.current[normalize(lab)] = mesh;
                const glowMat = new THREE.MeshBasicMaterial({
                  color: 0xef4444,
                  transparent: true,
                  opacity: 0.12,
                  blending: THREE.AdditiveBlending,
                  depthWrite: false,
                });
                const glowMesh = new THREE.Mesh(mesh.geometry.clone(), glowMat);
                glowMesh.position.copy(mesh.position);
                glowMesh.quaternion.copy(mesh.quaternion);
                glowMesh.scale.copy(mesh.scale).multiplyScalar(1.06);
                glowMesh.userData.baseScale = glowMesh.scale.clone();
                model.add(glowMesh);
                glowMapRef.current[normalize(lab)] = glowMesh;
              }
            }
          });
          applyHighlight();
        } catch {
          const model = buildModel();
          scene.add(model);
          modelGroupRef.current = model;
        }
      } else {
        const model = buildModel();
        scene.add(model);
        modelGroupRef.current = model;
      }
    })();

    const ro = new ResizeObserver(() => {
      const w = container.clientWidth;
      const h = container.clientHeight;
      renderer.setSize(w, h);
      camera.aspect = w / Math.max(1, h);
      camera.updateProjectionMatrix();
    });
    ro.observe(container);

    let isDragging = false;
    let lastX = 0;
    let lastY = 0;
    const onPointerDown = (e: PointerEvent) => {
      isDragging = true;
      lastX = e.clientX;
      lastY = e.clientY;
      (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    };
    const onPointerMove = (e: PointerEvent) => {
      if (!isDragging || !modelGroupRef.current) return;
      const dx = e.clientX - lastX;
      const dy = e.clientY - lastY;
      lastX = e.clientX;
      lastY = e.clientY;
      modelGroupRef.current.rotation.y += dx * 0.005;
      const newX = modelGroupRef.current.rotation.x + dy * 0.003;
      modelGroupRef.current.rotation.x = Math.max(-Math.PI / 6, Math.min(Math.PI / 6, newX));
    };
    const onPointerUp = (e: PointerEvent) => {
      isDragging = false;
      (e.target as HTMLElement).releasePointerCapture?.(e.pointerId);
    };
    const onWheel = (e: WheelEvent) => {
      const minDist = 3;
      const maxDist = 12;
      const z = camera.position.z + Math.sign(e.deltaY) * 0.5;
      camera.position.z = Math.max(minDist, Math.min(maxDist, z));
    };
    canvas.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    canvas.addEventListener('wheel', onWheel, { passive: true });

    const render = () => {
      renderer.render(scene, camera);
    };
    const animate = (t: number) => {
      frameIdRef.current = t as unknown as number;
      pulseRef.current = t * 0.002;
      const primaryKeys = Array.from(primarySetRef.current.values());
      for (const k of primaryKeys) {
        const glow = glowMapRef.current[k];
        if (!glow || !glow.visible) continue;
        const amp = (Math.sin(pulseRef.current) + 1) * 0.5; // 0..1
        const baseScale = glow.userData.baseScale as THREE.Vector3;
        if (baseScale) {
          glow.scale.copy(baseScale).multiplyScalar(1.06 + amp * 0.03);
        }
        const gmat = glow.material as THREE.MeshBasicMaterial;
        gmat.opacity = 0.16 + amp * 0.12;
        gmat.needsUpdate = true;
      }
      render();
    };
    renderer.setAnimationLoop(animate);

    primarySetRef.current = new Set((props.primaryMuscles || []).map(normalize));
    secondarySetRef.current = new Set((props.secondaryMuscles || []).map(normalize));
    applyHighlight();

    return () => {
      ro.disconnect();
      if (frameIdRef.current != null) {
        renderer.setAnimationLoop(null);
        frameIdRef.current = null;
      }
      canvas.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      canvas.removeEventListener('wheel', onWheel);
      disposeScene(scene);
      renderer.dispose();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const applyHighlight = () => {
    const muscleMap = muscleMapRef.current;
    const primary = primarySetRef.current;
    const secondary = secondarySetRef.current;
    const neutralColor = new THREE.Color(0x5a6470);
    const primaryColor = new THREE.Color(0xef4444);
    const secondaryColor = new THREE.Color(0xf59e0b);
    for (const key of Object.keys(muscleMap)) {
      const mesh = muscleMap[key];
      const isPrimary = primary.has(key);
      const isSecondary = secondary.has(key);
      const target = isPrimary ? primaryColor : isSecondary ? secondaryColor : neutralColor;
      const mat = mesh.material as THREE.MeshStandardMaterial;
      mat.color.copy(target);
      mat.transparent = true;
      mat.opacity = isPrimary ? 0.95 : isSecondary ? 0.7 : 0.25;
      mat.emissive = isPrimary ? primaryColor.clone().multiplyScalar(0.35) : new THREE.Color(0x000000);
      mat.needsUpdate = true;
      mesh.visible = true;
      const glow = glowMapRef.current[key];
      if (glow) {
        glow.visible = isPrimary;
        const gmat = glow.material as THREE.MeshBasicMaterial;
        gmat.color.copy(primaryColor);
        gmat.opacity = isPrimary ? 0.18 : 0.0;
        gmat.needsUpdate = true;
      }
    }
  };

  const normalize = (s: string) => (s || '').trim().toLowerCase();

  const disposeScene = (scene: THREE.Scene) => {
    scene.traverse((obj: THREE.Object3D) => {
      const mesh = obj as THREE.Mesh;
      if (mesh.geometry) mesh.geometry.dispose();
      const mat = mesh.material as THREE.Material | THREE.Material[];
      if (Array.isArray(mat)) {
        mat.forEach((m) => m && m.dispose());
      } else if (mat) {
        mat.dispose();
      }
    });
  };

  const addOverlay = (group: THREE.Group, name: string, geo: THREE.BufferGeometry, pos: THREE.Vector3, rot?: THREE.Euler, scale?: THREE.Vector3) => {
    const mat = new THREE.MeshStandardMaterial({ color: 0x808b98, transparent: true, opacity: 0.6, roughness: 0.85, metalness: 0.15 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.copy(pos);
    if (rot) mesh.rotation.copy(rot);
    if (scale) mesh.scale.copy(scale);
    group.add(mesh);
    muscleMapRef.current[normalize(name)] = mesh;
    const glowMat = new THREE.MeshBasicMaterial({
      color: 0xef4444,
      transparent: true,
      opacity: 0.12,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const glowMesh = new THREE.Mesh(geo.clone(), glowMat);
    glowMesh.position.copy(pos);
    if (rot) glowMesh.rotation.copy(rot);
    if (scale) glowMesh.scale.copy(scale);
    glowMesh.scale.multiplyScalar(1.06);
    glowMesh.visible = false;
    glowMesh.userData.baseScale = glowMesh.scale.clone();
    group.add(glowMesh);
    glowMapRef.current[normalize(name)] = glowMesh;
    return mesh;
  };

  const buildModel = () => {
    const group = new THREE.Group();

    const baseMat = new THREE.MeshStandardMaterial({ color: 0x556071, roughness: 0.95, metalness: 0.05 });

    const torsoGeo = new THREE.CylinderGeometry(0.8, 0.9, 2.2, 24);
    const torso = new THREE.Mesh(torsoGeo, baseMat);
    torso.position.set(0, 1.2, 0);
    group.add(torso);

    const head = new THREE.Mesh(new THREE.SphereGeometry(0.35, 24, 24), baseMat);
    head.position.set(0, 2.6, 0);
    group.add(head);

    const upperArmGeo = new THREE.CylinderGeometry(0.25, 0.25, 1.0, 16);
    const lowerArmGeo = new THREE.CylinderGeometry(0.2, 0.2, 1.0, 16);
    const shoulderGeo = new THREE.SphereGeometry(0.3, 16, 16);

    const leftShoulder = new THREE.Mesh(shoulderGeo, baseMat);
    leftShoulder.position.set(-1.05, 2.0, 0);
    group.add(leftShoulder);
    const rightShoulder = leftShoulder.clone();
    rightShoulder.position.x = 1.05;
    group.add(rightShoulder);

    const leftUpperArm = new THREE.Mesh(upperArmGeo, baseMat);
    leftUpperArm.position.set(-1.05, 1.45, 0);
    leftUpperArm.rotation.z = Math.PI / 10;
    group.add(leftUpperArm);
    const rightUpperArm = leftUpperArm.clone();
    rightUpperArm.position.x = 1.05;
    rightUpperArm.rotation.z = -Math.PI / 10;
    group.add(rightUpperArm);

    const leftLowerArm = new THREE.Mesh(lowerArmGeo, baseMat);
    leftLowerArm.position.set(-1.2, 0.75, 0);
    leftLowerArm.rotation.z = Math.PI / 10;
    group.add(leftLowerArm);
    const rightLowerArm = leftLowerArm.clone();
    rightLowerArm.position.x = 1.2;
    rightLowerArm.rotation.z = -Math.PI / 10;
    group.add(rightLowerArm);

    const upperLegGeo = new THREE.CylinderGeometry(0.35, 0.35, 1.3, 18);
    const lowerLegGeo = new THREE.CylinderGeometry(0.28, 0.28, 1.2, 18);
    const leftUpperLeg = new THREE.Mesh(upperLegGeo, baseMat);
    leftUpperLeg.position.set(-0.5, 0.0, 0);
    group.add(leftUpperLeg);
    const rightUpperLeg = leftUpperLeg.clone();
    rightUpperLeg.position.x = 0.5;
    group.add(rightUpperLeg);
    const leftLowerLeg = new THREE.Mesh(lowerLegGeo, baseMat);
    leftLowerLeg.position.set(-0.5, -0.9, 0);
    group.add(leftLowerLeg);
    const rightLowerLeg = leftLowerLeg.clone();
    rightLowerLeg.position.x = 0.5;
    group.add(rightLowerLeg);

    const overlays = new THREE.Group();
    group.add(overlays);

    // Chest (front upper torso)
    addOverlay(overlays, 'Chest', new THREE.BoxGeometry(1.2, 0.6, 0.3), new THREE.Vector3(0, 1.7, 0.6));
    // Back (upper torso back)
    addOverlay(overlays, 'Back', new THREE.BoxGeometry(1.2, 0.6, 0.3), new THREE.Vector3(0, 1.7, -0.6));
    // Abs (front lower torso)
    addOverlay(overlays, 'Abs', new THREE.BoxGeometry(0.8, 0.6, 0.25), new THREE.Vector3(0, 1.1, 0.55));
    // Shoulders (both)
    addOverlay(overlays, 'Shoulders', new THREE.SphereGeometry(0.32, 16, 16), new THREE.Vector3(-1.05, 2.0, 0));
    addOverlay(overlays, 'Shoulders', new THREE.SphereGeometry(0.32, 16, 16), new THREE.Vector3(1.05, 2.0, 0));
    // Biceps (upper arms front)
    addOverlay(overlays, 'Biceps', new THREE.CylinderGeometry(0.27, 0.27, 0.9, 16), new THREE.Vector3(-1.05, 1.45, 0.3));
    addOverlay(overlays, 'Biceps', new THREE.CylinderGeometry(0.27, 0.27, 0.9, 16), new THREE.Vector3(1.05, 1.45, 0.3));
    // Triceps (upper arms back)
    addOverlay(overlays, 'Triceps', new THREE.CylinderGeometry(0.27, 0.27, 0.9, 16), new THREE.Vector3(-1.05, 1.45, -0.3));
    addOverlay(overlays, 'Triceps', new THREE.CylinderGeometry(0.27, 0.27, 0.9, 16), new THREE.Vector3(1.05, 1.45, -0.3));
    // Forearms
    addOverlay(overlays, 'Forearms', new THREE.CylinderGeometry(0.22, 0.22, 0.9, 14), new THREE.Vector3(-1.2, 0.75, 0.25));
    addOverlay(overlays, 'Forearms', new THREE.CylinderGeometry(0.22, 0.22, 0.9, 14), new THREE.Vector3(1.2, 0.75, 0.25));
    // Quads
    addOverlay(overlays, 'Quads', new THREE.CylinderGeometry(0.36, 0.36, 1.1, 16), new THREE.Vector3(-0.5, 0.1, 0.32));
    addOverlay(overlays, 'Quads', new THREE.CylinderGeometry(0.36, 0.36, 1.1, 16), new THREE.Vector3(0.5, 0.1, 0.32));
    // Hamstrings
    addOverlay(overlays, 'Hamstrings', new THREE.CylinderGeometry(0.36, 0.36, 1.1, 16), new THREE.Vector3(-0.5, 0.1, -0.32));
    addOverlay(overlays, 'Hamstrings', new THREE.CylinderGeometry(0.36, 0.36, 1.1, 16), new THREE.Vector3(0.5, 0.1, -0.32));
    // Glutes
    addOverlay(overlays, 'Glutes', new THREE.BoxGeometry(1.0, 0.5, 0.5), new THREE.Vector3(0, 0.5, -0.5));
    // Calves
    addOverlay(overlays, 'Calves', new THREE.CylinderGeometry(0.25, 0.25, 1.0, 16), new THREE.Vector3(-0.5, -0.9, 0.25));
    addOverlay(overlays, 'Calves', new THREE.CylinderGeometry(0.25, 0.25, 1.0, 16), new THREE.Vector3(0.5, -0.9, 0.25));

    return group;
  };

  return (
    <div ref={containerRef} className={props.className ?? 'w-full h-80 rounded-xl overflow-hidden'}>
      <canvas ref={canvasRef} />
    </div>
  );
}
