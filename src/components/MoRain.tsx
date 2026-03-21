import { useEffect, useState, useCallback, useRef } from "react";
import { IconButton, HStack, Box, Text } from "@chakra-ui/react";
import { FiRepeat } from "react-icons/fi";

const NUM_MOS = 20;
const COOLDOWN_MS = 7000; // cooldown between spawns

interface MoItem {
    id: number;
    x: number;
    delay: number;
    duration: number;
    size: number;
    rotation: number;
    rotationEnd: number;
}

interface Batch {
    id: number;
    createdAt: number;
    mos: MoItem[];
}

let globalBatchId = 0;

function createBatch(): Batch {
    globalBatchId += 1;
    return {
        id: globalBatchId,
        createdAt: Date.now(),
        mos: Array.from({ length: NUM_MOS }, (_, i) => ({
            id: globalBatchId * NUM_MOS + i,
            x: Math.random() * 95,
            delay: Math.random() * 0.5,
            duration: 2.5 + Math.random() * 2,
            size: 24 + Math.random() * 32,
            rotation: Math.random() * 360,
            rotationEnd: Math.random() * 360 + 180,
        })),
    };
}

export default function MoRain() {
    const [batches, setBatches] = useState<Batch[]>(() => [createBatch()]);
    const [streamMos, setStreamMos] = useState<MoItem[]>([]);
    const [looping, setLooping] = useState(false);
    const [cooldown, setCooldown] = useState(true);
    const [progress, setProgress] = useState(0);
    const loopRef = useRef<ReturnType<typeof setInterval>>();
    const streamCleanupRef = useRef<ReturnType<typeof setInterval>>();
    const cooldownTimerRef = useRef<ReturnType<typeof setTimeout>>();
    const progressRef = useRef<ReturnType<typeof setInterval>>();
    const streamIdRef = useRef(100000);

    // Cleanup old batches
    useEffect(() => {
        const cleanup = setInterval(() => {
            const now = Date.now();
            setBatches((prev) => prev.filter((b) => now - b.createdAt < 7000));
        }, 2000);
        return () => clearInterval(cleanup);
    }, []);

    const startCooldown = useCallback(() => {
        setCooldown(true);
        setProgress(0);
        const startTime = Date.now();
        progressRef.current = setInterval(() => {
            const elapsed = Date.now() - startTime;
            const pct = Math.min((elapsed / COOLDOWN_MS) * 100, 100);
            setProgress(pct);
            if (pct >= 100) {
                clearInterval(progressRef.current);
            }
        }, 30);
        cooldownTimerRef.current = setTimeout(() => {
            setCooldown(false);
            setProgress(100);
        }, COOLDOWN_MS);
    }, []);

    // Start cooldown on mount for initial batch
    useEffect(() => {
        startCooldown();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const spawnBatch = useCallback(() => {
        setBatches((prev) => [...prev, createBatch()]);
        startCooldown();
    }, [startCooldown]);

    const handleSpawnClick = useCallback(() => {
        if (cooldown) return;
        spawnBatch();
    }, [cooldown, spawnBatch]);

    const toggleLoop = useCallback(() => {
        setLooping((prev) => {
            if (!prev) {
                // Clear any stale intervals first
                if (loopRef.current) clearInterval(loopRef.current);
                if (streamCleanupRef.current) clearInterval(streamCleanupRef.current);
                // Spawn one mo every 200ms for a constant rain
                loopRef.current = setInterval(() => {
                    streamIdRef.current += 1;
                    const mo: MoItem = {
                        id: streamIdRef.current,
                        x: Math.random() * 95,
                        delay: 0,
                        duration: 2.5 + Math.random() * 2,
                        size: 24 + Math.random() * 32,
                        rotation: Math.random() * 360,
                        rotationEnd: Math.random() * 360 + 180,
                    };
                    setStreamMos((prev) => [...prev, mo]);
                }, 200);
                // Clean up old stream mos periodically
                streamCleanupRef.current = setInterval(() => {
                    setStreamMos((prev) => {
                        if (prev.length > 50) return prev.slice(prev.length - 50);
                        return prev;
                    });
                }, 3000);
                return true;
            } else {
                if (loopRef.current) clearInterval(loopRef.current);
                if (streamCleanupRef.current) clearInterval(streamCleanupRef.current);
                // Let remaining mos finish falling, then clean up
                setTimeout(() => setStreamMos([]), 5000);
                return false;
            }
        });
    }, []);

    useEffect(() => {
        return () => {
            if (loopRef.current) clearInterval(loopRef.current);
            if (streamCleanupRef.current) clearInterval(streamCleanupRef.current);
            if (cooldownTimerRef.current) clearTimeout(cooldownTimerRef.current);
            if (progressRef.current) clearInterval(progressRef.current);
        };
    }, []);

    return (
        <>
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
            <HStack
                position="fixed"
                top={5}
                right={5}
                zIndex={10000}
                spacing={1}
            >
                <Box
                    as="button"
                    onClick={handleSpawnClick}
                    position="relative"
                    overflow="hidden"
                    height="24px"
                    px={3}
                    borderRadius="full"
                    border="1px solid"
                    borderColor={cooldown ? "gray.300" : "#EAA3C4"}
                    bg="transparent"
                    cursor={cooldown ? "not-allowed" : "pointer"}
                    opacity={cooldown ? 0.7 : 1}
                    transition="all 0.2s"
                    _hover={cooldown ? {} : { bg: "rgba(234, 163, 196, 0.1)" }}
                >
                    {/* Loading bar fill */}
                    <Box
                        position="absolute"
                        top={0}
                        left={0}
                        height="100%"
                        width={`${progress}%`}
                        bg="rgba(234, 163, 196, 0.15)"
                        transition={progress === 0 ? "none" : "width 0.05s linear"}
                        borderRadius="full"
                    />
                    <Text
                        position="relative"
                        fontSize="xs"
                        fontWeight="500"
                        color={cooldown ? "gray.400" : "#EAA3C4"}
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
                {batches.map((batch) =>
                    batch.mos.map((mo) => (
                        <img
                            key={mo.id}
                            src="/final-mo.png"
                            alt=""
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
                    ))
                )}
                {streamMos.map((mo) => (
                    <img
                        key={`stream-${mo.id}`}
                        src="/final-mo.png"
                        alt=""
                        style={{
                            position: "absolute",
                            left: `${mo.x}vw`,
                            top: 0,
                            width: mo.size,
                            height: "auto",
                            animation: `moFall ${mo.duration}s 0s ease-in both`,
                            ["--mo-rot-start" as string]: `${mo.rotation}deg`,
                            ["--mo-rot-end" as string]: `${mo.rotationEnd}deg`,
                        }}
                    />
                ))}
            </div>
        </>
    );
}
