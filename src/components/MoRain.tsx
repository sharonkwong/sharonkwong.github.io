import { createContext, useContext, useEffect, useState, useCallback, useRef } from "react";
import { IconButton, HStack, Box, Text } from "@chakra-ui/react";
import { FiRepeat } from "react-icons/fi";

const BATCH_SIZE = 20;
const MAX_MOS = 200;

interface MoItem {
    id: number;
    x: number;
    delay: number;
    duration: number;
    size: number;
    rotation: number;
    rotationEnd: number;
}

let nextId = 0;

function createMos(count: number): MoItem[] {
    return Array.from({ length: count }, () => {
        nextId += 1;
        return {
            id: nextId,
            x: Math.random() * 95,
            delay: Math.random() * 0.5,
            duration: 2.5 + Math.random() * 2,
            size: 24 + Math.random() * 32,
            rotation: Math.random() * 360,
            rotationEnd: Math.random() * 360 + 180,
        };
    });
}

interface MoRainContextType {
    spawnBatch: () => void;
    toggleLoop: () => void;
    looping: boolean;
}

const MoRainContext = createContext<MoRainContextType | null>(null);

export function useMoRain() {
    return useContext(MoRainContext);
}

export function MoControls() {
    const ctx = useMoRain();
    if (!ctx) return null;
    const { spawnBatch, toggleLoop, looping } = ctx;

    return (
        <HStack spacing={1} justify="center">
            <Box
                as="button"
                onClick={spawnBatch}
                position="relative"
                overflow="hidden"
                height="24px"
                px={3}
                borderRadius="full"
                border="1px solid"
                borderColor="#EAA3C4"
                bg="transparent"
                cursor="pointer"
                transition="all 0.2s"
                _hover={{ bg: "rgba(234, 163, 196, 0.1)" }}
                _active={{ transform: "scale(0.95)" }}
            >
                <Text
                    position="relative"
                    fontSize="xs"
                    fontWeight="500"
                    color="#EAA3C4"
                    whiteSpace="nowrap"
                >
                    spawn more mos
                </Text>
            </Box>
            <IconButton
                aria-label="Toggle loop"
                icon={<FiRepeat />}
                onClick={toggleLoop}
                size="xs"
                fontSize="sm"
                borderRadius="full"
                bg={looping ? "rgba(234, 163, 196, 0.2)" : "transparent"}
                color={looping ? "#EAA3C4" : "gray.400"}
                border="1px solid"
                borderColor={looping ? "#EAA3C4" : "gray.300"}
                _hover={{ bg: looping ? "rgba(234, 163, 196, 0.25)" : "rgba(0,0,0,0.04)" }}
                _active={{ bg: "rgba(234, 163, 196, 0.3)" }}
                transition="all 0.2s"
            />
        </HStack>
    );
}

export default function MoRain({ children }: { children?: React.ReactNode }) {
    const [mos, setMos] = useState<MoItem[]>(() => createMos(BATCH_SIZE));
    const [looping, setLooping] = useState(false);
    const loopRef = useRef<ReturnType<typeof setInterval>>();

    const removeMo = useCallback((id: number) => {
        setMos((prev) => prev.filter((m) => m.id !== id));
    }, []);

    const spawnBatch = useCallback(() => {
        setMos((prev) => {
            const next = [...prev, ...createMos(BATCH_SIZE)];
            if (next.length > MAX_MOS) return next.slice(next.length - MAX_MOS);
            return next;
        });
    }, []);

    const toggleLoop = useCallback(() => {
        setLooping((prev) => {
            if (!prev) {
                if (loopRef.current) clearInterval(loopRef.current);
                loopRef.current = setInterval(() => {
                    setMos((prev) => {
                        nextId += 1;
                        const mo: MoItem = {
                            id: nextId,
                            x: Math.random() * 95,
                            delay: 0,
                            duration: 2.5 + Math.random() * 2,
                            size: 24 + Math.random() * 32,
                            rotation: Math.random() * 360,
                            rotationEnd: Math.random() * 360 + 180,
                        };
                        const next = [...prev, mo];
                        if (next.length > MAX_MOS) return next.slice(next.length - MAX_MOS);
                        return next;
                    });
                }, 200);
                return true;
            } else {
                if (loopRef.current) clearInterval(loopRef.current);
                return false;
            }
        });
    }, []);

    useEffect(() => {
        return () => {
            if (loopRef.current) clearInterval(loopRef.current);
        };
    }, []);

    const contextValue = { spawnBatch, toggleLoop, looping };

    return (
        <MoRainContext.Provider value={contextValue}>
            <style>{`
                @keyframes moFall {
                    0% {
                        transform: translateY(-80px) rotate(var(--mo-rot-start));
                        opacity: 0.85;
                    }
                    90% {
                        opacity: 0.85;
                    }
                    100% {
                        transform: translateY(110vh) rotate(var(--mo-rot-end));
                        opacity: 0;
                    }
                }
            `}</style>
            {/* Desktop: fixed top-right */}
            <HStack
                position="fixed"
                top={5}
                right={5}
                zIndex={10000}
                spacing={1}
                display={{ base: "none", md: "flex" }}
            >
                <MoControls />
            </HStack>
            <div
                style={{
                    position: "fixed",
                    top: 0,
                    left: 0,
                    width: "100%",
                    height: "100%",
                    pointerEvents: "none",
                    zIndex: 9999,
                    overflow: "hidden",
                }}
            >
                {mos.map((mo) => (
                    <img
                        key={mo.id}
                        src="/final-mo.png"
                        alt=""
                        onAnimationEnd={() => removeMo(mo.id)}
                        style={{
                            position: "absolute",
                            left: `${mo.x}vw`,
                            top: 0,
                            width: mo.size,
                            height: "auto",
                            animation: `moFall ${mo.duration}s ${mo.delay}s ease-in both`,
                            ["--mo-rot-start" as string]: `${mo.rotation}deg`,
                            ["--mo-rot-end" as string]: `${mo.rotationEnd}deg`,
                        }}
                    />
                ))}
            </div>
            {children}
        </MoRainContext.Provider>
    );
}
