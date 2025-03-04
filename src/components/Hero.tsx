import { Box, Container, Heading, Text, VStack, Button, HStack } from "@chakra-ui/react";
import { motion } from "framer-motion";
import TypewriterComponent from "typewriter-effect";
import { FaGithub, FaLinkedin, FaEnvelope } from "react-icons/fa";

const MotionBox = motion(Box);

export default function Hero() {
    return (
        <Container maxW="4xl" id="hero" centerContent>
            <VStack spacing={8} alignItems="center" py={20}>
                <MotionBox
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5 }}
                >
                    <Heading
                        as="h1"
                        size="2xl"
                        bgGradient="linear(to-r, brand.400, brand.600)"
                        bgClip="text"
                        textAlign="center"
                    >
                        Sharon Kwong
                    </Heading>
                </MotionBox>

                <MotionBox
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.5, delay: 0.2 }}
                >
                    <Text fontSize="xl" color="gray.500" textAlign="center">
                        <TypewriterComponent
                            options={{
                                strings: [
                                    "Associate Product Manager",
                                    "Full Stack Developer",
                                    "Data Enthusiast",
                                    "Problem Solver"
                                ],
                                autoStart: true,
                                loop: true,
                            }}
                        />
                    </Text>
                </MotionBox>

                <MotionBox
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.5, delay: 0.4 }}
                >
                    <Text color="gray.600" textAlign="center" fontSize="lg">
                        Based in the Bay Area
                    </Text>
                </MotionBox>

                <MotionBox
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.5, delay: 0.6 }}
                >
                    <HStack spacing={4}>
                        <Button
                            as="a"
                            href="https://linkedin.com/in/sharonjkwong"
                            target="_blank"
                            leftIcon={<FaLinkedin />}
                            variant="ghost"
                        >
                            LinkedIn
                        </Button>
                        <Button
                            as="a"
                            href="mailto:sharonjkwong@gmail.com"
                            leftIcon={<FaEnvelope />}
                            variant="ghost"
                        >
                            Email
                        </Button>
                        <Button
                            as="a"
                            href="https://github.com/sharonkwong"
                            target="_blank"
                            leftIcon={<FaGithub />}
                            variant="ghost"
                        >
                            GitHub
                        </Button>
                    </HStack>
                </MotionBox>
            </VStack>
        </Container>
    );
} 