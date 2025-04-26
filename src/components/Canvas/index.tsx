import { Canvas as ThreeCanvas } from "@react-three/fiber";
import { World } from "./World";
import { Camera } from "./Camera";

export default function Canvas() {
  return (
    <ThreeCanvas>
      <Camera />
      <World />
      <ambientLight intensity={0.5} />
      <directionalLight position={[10, 10, 5]} />
    </ThreeCanvas>
  );
}
