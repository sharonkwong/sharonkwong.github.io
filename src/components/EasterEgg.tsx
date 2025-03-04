import { useEffect, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import { Box, Modal, ModalOverlay, ModalContent, ModalHeader, ModalCloseButton, ModalBody } from "@chakra-ui/react";


function CatModel() {
    const meshRef = useRef<THREE.Mesh>(null);

    useFrame((state) => {
        if (meshRef.current) {
            meshRef.current.rotation.x = Math.sin(state.clock.elapsedTime) * 0.2;
            meshRef.current.rotation.y += 0.01;
        }
    });

    return (
        <mesh ref={meshRef}>
            <torusKnotGeometry args={[1, 0.3, 128, 16]} />
            <meshPhongMaterial
                color="#0ea5e9"
                emissive="#0284c7"
                specular="#ffffff"
                shininess={100}
            />
        </mesh>
    );
}

interface EasterEggProps {
    onClose: () => void;
}

export default function EasterEgg({ onClose }: EasterEggProps) {
    useEffect(() => {
        const timer = setTimeout(() => {
            onClose();
        }, 10000);

        return () => clearTimeout(timer);
    }, [onClose]);
    return (
        <Modal isOpen={true} onClose={onClose} size="xl">
            <ModalOverlay />
            <ModalContent bg="transparent" boxShadow="none">
                <ModalHeader color="white" textAlign="center">
                    🎉 You found the Easter Egg! 🎉
                </ModalHeader>
                <ModalCloseButton color="white" />
                <ModalBody>
                    <Box height="400px">
                        <Canvas camera={{ position: [0, 0, 5] }}>
                            <ambientLight intensity={0.5} />
                            <pointLight position={[10, 10, 10]} />
                            <CatModel />
                            <OrbitControls />
                        </Canvas>
                    </Box>
                </ModalBody>
            </ModalContent>
        </Modal>
    );
} 