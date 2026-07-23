import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { useGLTF, Environment } from "@react-three/drei";
import * as THREE from "three";
import type { FaceTrackingResult } from "@/hooks/useVideoFaceTracking";

interface GlassesSceneProps {
  modelPath: string;
  trackingResult: FaceTrackingResult;
  videoWidth: number;
  videoHeight: number;
}

const NOSE_BRIDGE_IDX = 6;
const LEFT_TEMPLE_IDX = 234;
const RIGHT_TEMPLE_IDX = 454;

const _matrix = new THREE.Matrix4();
const _position = new THREE.Vector3();
const _quaternion = new THREE.Quaternion();
const _scale = new THREE.Vector3();
const _euler = new THREE.Euler();

function ndcToThree(
  nx: number,
  ny: number,
  videoWidth: number,
  videoHeight: number
): THREE.Vector3 {
  const aspect = videoWidth / videoHeight;
  const distance = 1; 
  const vFov = (60 * Math.PI) / 180;
  
  const height = 2 * Math.tan(vFov / 2) * distance;
  const width = height * aspect;

  return new THREE.Vector3(
    (nx - 0.5) * width,
    -(ny - 0.5) * height,
    0
  );
}

export function GlassesScene({
  modelPath,
  trackingResult,
  videoWidth,
  videoHeight,
}: GlassesSceneProps) {
  const { scene } = useGLTF(modelPath);
  const groupRef = useRef<THREE.Group>(null);

  const { modelWidth, centerOffset } = useMemo(() => {
    const box = new THREE.Box3().setFromObject(scene);
    const size = new THREE.Vector3();
    const center = new THREE.Vector3();
    
    box.getSize(size);
    box.getCenter(center);
    
    return {
      modelWidth: size.x > 0 ? size.x : 1,
      centerOffset: center,
    };
  }, [scene]);

  useEffect(() => {
    if (!scene) return;
    
    scene.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        const applyRealisticMaterial = (material: THREE.Material) => {
          const matName = material.name?.toLowerCase() || "";
          const objName = obj.name?.toLowerCase() || "";
          
          const isGlass = 
            matName.includes("lens") || 
            matName.includes("glass") || 
            matName.includes("cristal") || 
            matName.includes("vidrio") ||
            objName.includes("lens") || 
            objName.includes("glass") || 
            (material.opacity !== undefined && material.opacity < 1);

          if (isGlass) {
            return new THREE.MeshPhysicalMaterial({
              color: 0xffffff,
              metalness: 0.1,
              roughness: 0,
              transmission: 0.95,
              ior: 1.5,
              thickness: 0.05,
              transparent: true,
              envMapIntensity: 2.5,
              side: THREE.DoubleSide
            });
          } else {
            return new THREE.MeshStandardMaterial({
              color: 0x1a1a1a,
              metalness: 0.85,
              roughness: 0.2,
              envMapIntensity: 1.5,
              side: THREE.DoubleSide
            });
          }
        };

        if (Array.isArray(obj.material)) {
          obj.material = obj.material.map(applyRealisticMaterial);
        } else if (obj.material) {
          obj.material = applyRealisticMaterial(obj.material);
        }
      }
    });
  }, [scene]);

  useFrame(() => {
    const group = groupRef.current;
    if (!group) return;

    const { landmarks, matrix4x4 } = trackingResult;

    const noseBridge = landmarks[NOSE_BRIDGE_IDX];
    const leftTemple = landmarks[LEFT_TEMPLE_IDX];
    const rightTemple = landmarks[RIGHT_TEMPLE_IDX];

    if (!noseBridge || !leftTemple || !rightTemple) {
      group.visible = false;
      return;
    }

    group.visible = true;

    const leftPos = ndcToThree(leftTemple.x, leftTemple.y, videoWidth, videoHeight);
    const rightPos = ndcToThree(rightTemple.x, rightTemple.y, videoWidth, videoHeight);
    const faceWidth = leftPos.distanceTo(rightPos);
    
    const targetWidth = faceWidth * 1.05;
    const finalScale = targetWidth / modelWidth;
    group.scale.setScalar(finalScale);

    _matrix.set(
      matrix4x4[0],  matrix4x4[4],  matrix4x4[8],  matrix4x4[12],
      matrix4x4[1],  matrix4x4[5],  matrix4x4[9],  matrix4x4[13],
      matrix4x4[2],  matrix4x4[6],  matrix4x4[10], matrix4x4[14],
      matrix4x4[3],  matrix4x4[7],  matrix4x4[11], matrix4x4[15]
    );

    _matrix.decompose(_position, _quaternion, _scale);
    _euler.setFromQuaternion(_quaternion, "YXZ");
    group.rotation.set(_euler.x, _euler.y, _euler.z);

    const bridgePos = ndcToThree(noseBridge.x, noseBridge.y, videoWidth, videoHeight);
    group.position.copy(bridgePos);

    group.translateZ(-faceWidth * 0.18);
    group.translateY(faceWidth * 0.08);
  });

  return (
    <group ref={groupRef} visible={false}>
      <ambientLight intensity={0.8} />
      <directionalLight position={[2, 5, 2]} intensity={1.5} />
      <Environment preset="city" />
      
      <group position={[-centerOffset.x, -centerOffset.y, -centerOffset.z]}>
        <primitive object={scene} />
      </group>
    </group>
  );
}