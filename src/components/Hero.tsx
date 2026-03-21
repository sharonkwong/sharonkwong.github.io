import { Box, Container, Heading, Text, VStack, HStack, IconButton, Image } from "@chakra-ui/react";
import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect } from "react";
import { FaLinkedinIn, FaEnvelope, FaFileAlt, FaGithub } from "react-icons/fa";

const ROTATING_PHRASES = [
    "products that matter.",
    "ideas into reality.",
    "delightful experiences.",
    "from zero to one.",
    "what people love.",
];

export default function Hero() {
    const [phraseIndex, setPhraseIndex] = useState(0);

    useEffect(() => {
        const interval = setInterval(() => {
            setPhraseIndex((prev) => (prev + 1) % ROTATING_PHRASES.length);
        }, 2500);
        return () => clearInterval(interval);
    }, []);

    return (
        <Container maxW="4xl" id="hero" pt={{ base: 28, md: 36 }} pb={{ base: 16, md: 24 }}>
            <VStack spacing={6} alignItems="center" textAlign="center">
                {/* Circle photo */}
                <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.7 }}
                >
                    <Image
                        src="/headshot.JPG"
                        alt="Sharon Kwong"
                        w={{ base: "140px", md: "160px" }}
                        h={{ base: "140px", md: "160px" }}
                        borderRadius="full"
                        objectFit="cover"
                    />
                </motion.div>

                {/* Name */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, delay: 0.15 }}
                >
                    <Heading
                        as="h1"
                        fontSize={{ base: "4xl", md: "5xl", lg: "6xl" }}
                        fontWeight="700"
                        color="gray.900"
                        lineHeight="1.1"
                    >
                        Sharon Kwong
                    </Heading>
                </motion.div>

                {/* Tagline */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, delay: 0.25 }}
                >
                    <Heading
                        as="h2"
                        fontSize={{ base: "lg", md: "xl", lg: "2xl" }}
                        fontWeight="600"
                        lineHeight="1.4"
                    >
                        <Box as="span" color="gray.600">
                            I design, prototype & build{" "}
                        </Box>
                        <AnimatePresence mode="wait">
                            <motion.span
                                key={phraseIndex}
                                initial={{ opacity: 0, y: 8 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -8 }}
                                transition={{ duration: 0.3, ease: "easeInOut" }}
                                style={{
                                    backgroundImage: "linear-gradient(to right, #EAA3C4, #FABDB2, #f9d470)",
                                    WebkitBackgroundClip: "text",
                                    WebkitTextFillColor: "transparent",
                                    backgroundClip: "text",
                                }}
                            >
                                {ROTATING_PHRASES[phraseIndex]}
                            </motion.span>
                        </AnimatePresence>
                    </Heading>
                </motion.div>

                {/* Description */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, delay: 0.35 }}
                >
                    <Text
                        fontSize={{ base: "md", md: "lg" }}
                        color="gray.500"
                        maxW="500px"
                        lineHeight="1.7"
                    >
                        Product builder at the intersection of design, engineering, and AI.
                        Turning ideas into real, working products.
                    </Text>
                </motion.div>

                {/* Social icons */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, delay: 0.45 }}
                >
                    <HStack spacing={3} pt={2}>
                        <IconButton
                            as="a"
                            href="mailto:sharonjkwong@gmail.com"
                            aria-label="Email"
                            icon={<FaEnvelope />}
                            variant="ghost"
                            fontSize="xl"
                            color="#EAA3C4"
                            _hover={{
                                color: "#D88BAF",
                                bg: "rgba(234, 163, 196, 0.1)",
                            }}
                            borderRadius="full"
                            size="lg"
                            transition="all 0.2s"
                        />
                        <IconButton
                            as="a"
                            href="https://linkedin.com/in/sharonjkwong"
                            target="_blank"
                            aria-label="LinkedIn"
                            icon={<FaLinkedinIn />}
                            variant="ghost"
                            fontSize="xl"
                            color="#EAA3C4"
                            _hover={{
                                color: "#D88BAF",
                                bg: "rgba(234, 163, 196, 0.1)",
                            }}
                            borderRadius="full"
                            size="lg"
                            transition="all 0.2s"
                        />
                        <IconButton
                            as="a"
                            href="https://github.com/sharonkwong"
                            target="_blank"
                            aria-label="GitHub"
                            icon={<FaGithub />}
                            variant="ghost"
                            fontSize="xl"
                            color="#EAA3C4"
                            _hover={{
                                color: "#D88BAF",
                                bg: "rgba(234, 163, 196, 0.1)",
                            }}
                            borderRadius="full"
                            size="lg"
                            transition="all 0.2s"
                        />
                        <IconButton
                            as="a"
                            href="/Kwong_Sharon_Resume.pdf"
                            download
                            aria-label="Resume"
                            icon={<FaFileAlt />}
                            variant="ghost"
                            fontSize="xl"
                            color="#EAA3C4"
                            _hover={{
                                color: "#D88BAF",
                                bg: "rgba(234, 163, 196, 0.1)",
                            }}
                            borderRadius="full"
                            size="lg"
                            transition="all 0.2s"
                        />
                    </HStack>
                    <Text fontSize="s" fontWeight="400" color="gray.500" pt={1} marginTop="10">
                        Based in Cupertino, CA
                    </Text>
                </motion.div>
            </VStack>
        </Container>
    );
}
