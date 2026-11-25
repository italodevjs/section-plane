import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { section, type Analysis, type Vec3 } from "./geometry";

export class Viewer {
  private scene = new THREE.Scene();
  private camera = new THREE.OrthographicCamera(-70, 70, 50, -50, 0.01, 10000);
  private renderer: THREE.WebGLRenderer;
  private controls: OrbitControls;
  private group = new THREE.Group();
  private surface: THREE.Mesh<
    THREE.BufferGeometry,
    THREE.MeshStandardMaterial
  > | null = null;
  private sectionLines: THREE.LineSegments | null = null;
  private planeVisual: THREE.Mesh | null = null;
  private wire: THREE.LineSegments | null = null;
  private positions = new Float32Array();
  private analysis: Analysis | null = null;
  private center = new THREE.Vector3();
  private radius = 60;
  private measureMode = false;
  private points: THREE.Vector3[] = [];
  private marks = new THREE.Group();
  private observer: ResizeObserver;
  private pointerStart = [0, 0];
  private animation = 0;
  onMeasure: (distance: number | null) => void = () => {};
  constructor(private host: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.setClearColor(0xf0f0eb, 1);
    this.renderer.localClippingEnabled = true;
    this.renderer.domElement.setAttribute(
      "aria-label",
      "3D mesh viewport. Drag to orbit; scroll to zoom. Use view controls for keyboard-accessible camera positioning.",
    );
    this.host.append(this.renderer.domElement);
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x62655c, 2.5));
    const light = new THREE.DirectionalLight(0xffffff, 3);
    light.position.set(80, 120, 90);
    this.scene.add(light);
    this.scene.add(this.group, this.marks);
    this.camera.up.set(0, 0, 1);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.1;
    this.observer = new ResizeObserver(() => this.resize());
    this.observer.observe(host);
    this.renderer.domElement.addEventListener("pointerdown", (e) => {
      this.pointerStart = [e.clientX, e.clientY];
    });
    this.renderer.domElement.addEventListener("pointerup", (e) => {
      if (
        !this.measureMode ||
        !this.surface ||
        Math.hypot(
          e.clientX - this.pointerStart[0]!,
          e.clientY - this.pointerStart[1]!,
        ) > 4
      )
        return;
      const rect = this.renderer.domElement.getBoundingClientRect();
      const ray = new THREE.Raycaster();
      ray.setFromCamera(
        new THREE.Vector2(
          ((e.clientX - rect.left) / rect.width) * 2 - 1,
          (-(e.clientY - rect.top) / rect.height) * 2 + 1,
        ),
        this.camera,
      );
      const hit = ray.intersectObject(this.surface)[0];
      if (!hit) return;
      if (this.points.length === 2) this.clearMeasurement();
      this.points.push(hit.point.clone());
      const marker = new THREE.Mesh(
        new THREE.SphereGeometry(this.radius * 0.013, 12, 8),
        new THREE.MeshBasicMaterial({ color: 0xb8562f, depthTest: false }),
      );
      marker.position.copy(hit.point);
      marker.renderOrder = 5;
      this.marks.add(marker);
      if (this.points.length === 2) {
        const line = new THREE.Line(
          new THREE.BufferGeometry().setFromPoints(this.points),
          new THREE.LineBasicMaterial({ color: 0xb8562f, depthTest: false }),
        );
        line.renderOrder = 5;
        this.marks.add(line);
        this.onMeasure(this.points[0]!.distanceTo(this.points[1]!));
      }
    });
    const render = () => {
      this.animation = requestAnimationFrame(render);
      this.controls.update();
      this.renderer.render(this.scene, this.camera);
    };
    render();
  }
  private resize(): void {
    const w = this.host.clientWidth,
      h = this.host.clientHeight;
    if (!w || !h) return;
    this.renderer.setSize(w, h);
    const scale = (this.camera.top - this.camera.bottom) / 2;
    this.camera.left = (-scale * w) / h;
    this.camera.right = (scale * w) / h;
    this.camera.updateProjectionMatrix();
  }
  load(positions: Float32Array, analysis: Analysis): void {
    this.clearGroup(this.group);
    this.clearMeasurement();
    this.positions = positions;
    this.analysis = analysis;
    this.center
      .set(...analysis.min)
      .add(new THREE.Vector3(...analysis.max))
      .multiplyScalar(0.5);
    this.radius = Math.max(...analysis.size, 1e-8);
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.computeVertexNormals();
    this.surface = new THREE.Mesh(
      geometry,
      new THREE.MeshStandardMaterial({
        color: 0xc4c8bb,
        roughness: 0.82,
        metalness: 0.04,
        side: THREE.DoubleSide,
        polygonOffset: true,
        polygonOffsetFactor: 1,
        polygonOffsetUnits: 1,
      }),
    );
    this.group.add(this.surface);
    this.wire = new THREE.LineSegments(
      new THREE.EdgesGeometry(geometry, 24),
      new THREE.LineBasicMaterial({
        color: 0x62685b,
        transparent: true,
        opacity: 0.65,
      }),
    );
    this.group.add(this.wire);
    this.sectionLines = null;
    this.planeVisual = null;
    this.view("iso");
  }
  view(mode: "iso" | "front" | "top" | "right"): void {
    const vectors: Record<typeof mode, Vec3> = {
      iso: [1.4, -1.8, 1.25],
      front: [0, -2, 0],
      top: [0, 0, 2],
      right: [2, 0, 0],
    };
    this.camera.position
      .copy(this.center)
      .add(new THREE.Vector3(...vectors[mode]).multiplyScalar(this.radius * 2));
    this.camera.near = Math.max(this.radius * 0.0001, 1e-10);
    this.camera.far = this.radius * 30;
    this.camera.top = this.radius * 0.9;
    this.camera.bottom = -this.radius * 0.9;
    this.camera.zoom = 1;
    this.controls.target.copy(this.center);
    this.controls.update();
    this.resize();
  }
  edges(visible: boolean): void {
    if (this.wire) this.wire.visible = visible;
  }
  cut(enabled: boolean, axis: 0 | 1 | 2, ratio: number): number {
    if (!this.surface || !this.analysis) return 0;
    if (this.sectionLines) {
      this.group.remove(this.sectionLines);
      this.dispose(this.sectionLines);
      this.sectionLines = null;
    }
    if (this.planeVisual) {
      this.group.remove(this.planeVisual);
      this.dispose(this.planeVisual);
      this.planeVisual = null;
    }
    this.surface.material.clippingPlanes = [];
    if (!enabled) return 0;
    const a = this.analysis,
      value = a.min[axis] + a.size[axis] * ratio;
    const normal = new THREE.Vector3();
    normal.setComponent(axis, -1);
    this.surface.material.clippingPlanes = [new THREE.Plane(normal, value)];
    const segments = section(this.positions, axis, value, a.weldTolerance);
    this.sectionLines = new THREE.LineSegments(
      new THREE.BufferGeometry().setAttribute(
        "position",
        new THREE.BufferAttribute(segments, 3),
      ),
      new THREE.LineBasicMaterial({ color: 0xbd582f, depthTest: false }),
    );
    this.sectionLines.renderOrder = 3;
    this.group.add(this.sectionLines);
    this.planeVisual = new THREE.Mesh(
      new THREE.PlaneGeometry(this.radius * 1.35, this.radius * 1.35),
      new THREE.MeshBasicMaterial({
        color: 0xc4663b,
        transparent: true,
        opacity: 0.075,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
    );
    if (axis === 0) this.planeVisual.rotation.y = Math.PI / 2;
    if (axis === 1) this.planeVisual.rotation.x = Math.PI / 2;
    this.planeVisual.position.copy(this.center).setComponent(axis, value);
    this.group.add(this.planeVisual);
    return segments.length / 6;
  }
  measure(enabled: boolean): void {
    this.measureMode = enabled;
    this.renderer.domElement.style.cursor = enabled ? "crosshair" : "grab";
  }
  clearMeasurement(): void {
    this.points = [];
    this.clearGroup(this.marks);
    this.onMeasure(null);
  }
  private dispose(object: THREE.Object3D): void {
    const mesh = object as THREE.Mesh;
    if (mesh.geometry) mesh.geometry.dispose();
    const m = mesh.material;
    if (Array.isArray(m)) m.forEach((x) => x.dispose());
    else m?.dispose();
  }
  private clearGroup(group: THREE.Group): void {
    for (const child of [...group.children]) {
      this.dispose(child);
      group.remove(child);
    }
  }
  destroy(): void {
    cancelAnimationFrame(this.animation);
    this.observer.disconnect();
    this.controls.dispose();
    this.clearGroup(this.group);
    this.clearGroup(this.marks);
    this.renderer.dispose();
  }
}
