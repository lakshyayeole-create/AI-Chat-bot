import * as THREE from 'three';

/**
 * Creates the procedural stone geometry via vertex deformation math.
 * Starts with an 8-sided diamond base (OctahedronGeometry(1.14, 2)),
 * then elongates and tapers vertices along the Y axis, squashing X & Z slightly.
 */
export function createProceduralStoneGeometry(): THREE.BufferGeometry {
  const geom = new THREE.OctahedronGeometry(1.14, 2);
  const pos = geom.attributes.position;

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);

    // Taper factor: Widest at equator (y = 0), narrowest at the tips (|y| ≈ 1)
    const taper = 0.57 + 0.43 * (1 - Math.abs(y));

    // 1.82 * y vertically elongates the crystal
    // 0.8 and 0.72 squash X and Z to create an elliptical diamond
    pos.setXYZ(i, x * taper * 0.8, 1.82 * y, z * taper * 0.72);
  }

  pos.needsUpdate = true;
  geom.computeVertexNormals();
  return geom;
}

/**
 * Creates curved energy ribbon trail mesh trailing behind each stone along the orbit path.
 */
export function createOrbitTrailGeometry(radius: number, numStones: number): THREE.BufferGeometry {
  const segments = 24;
  const arcLength = ((Math.PI * 2) / numStones) * 0.72; // ~37 degrees trailing wake
  const curvePoints: THREE.Vector3[] = [];

  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const a = -t * arcLength; // trails in negative angle direction
    const y = Math.sin(t * Math.PI) * 0.04;
    curvePoints.push(new THREE.Vector3(radius * Math.cos(a), y, radius * Math.sin(a)));
  }

  const curve = new THREE.CatmullRomCurve3(curvePoints);
  return new THREE.TubeGeometry(curve, segments, 0.026, 6, false);
}
