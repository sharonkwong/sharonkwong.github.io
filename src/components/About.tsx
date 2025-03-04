import {
    Container,
    Heading,
    Text,
    VStack,
    HStack,
    Box,
    Image,
    useColorModeValue,
} from "@chakra-ui/react";
import { motion } from "framer-motion";
import { useInView } from "react-intersection-observer";

const MotionBox = motion(Box);

export default function About() {
    const [ref, inView] = useInView({
        threshold: 0.1,
        triggerOnce: true,
    });

    return (
        <Container maxW="4xl" id="about">
            <VStack spacing={12}>
                <Heading
                    as="h2"
                    size="xl"
                    bgGradient="linear(to-r, brand.400, brand.600)"
                    bgClip="text"
                    textAlign="center"
                >
                    About Me
                </Heading>

                <HStack
                    spacing={8}
                    alignItems="center"
                    ref={ref}
                    flexDirection={{ base: "column", md: "row" }}
                >
                    <MotionBox
                        initial={{ opacity: 0, x: -50 }}
                        animate={inView ? { opacity: 1, x: 0 } : {}}
                        transition={{ duration: 0.5 }}
                        flex={1}
                    >
                        <Image
                            src="https://placecats.com/400/400"
                            alt="Sharon Kwong"
                            borderRadius="2xl"
                            boxShadow="lg"
                            objectFit="cover"
                            width="100%"
                            height="400px"
                        />
                    </MotionBox>

                    <MotionBox
                        initial={{ opacity: 0, x: 50 }}
                        animate={inView ? { opacity: 1, x: 0 } : {}}
                        transition={{ duration: 0.5, delay: 0.2 }}
                        flex={1}
                    >
                        <VStack
                            spacing={4}
                            align="stretch"
                            bg={useColorModeValue("white", "gray.800")}
                            p={6}
                            borderRadius="lg"
                            boxShadow="md"
                        >
                            <Text fontSize="lg">
                                Hi there! I'm Sharon, an Associate Product Manager and Full Stack Developer based in Cupertino, CA. I'm passionate about building innovative products and solving complex problems.
                            </Text>
                            <Text fontSize="lg">
                                With experience in product management, software development, and data analysis, I bring a unique blend of technical and strategic skills to every project I work on.
                            </Text>
                            <Text fontSize="lg">
                                Currently, I'm working at Frequence (acquired by Madhive) where I lead product initiatives and manage a high-performing development team. I'm also the co-founder of Kalendir and ReferralHub, where I've built successful SaaS products from the ground up.
                            </Text>
                            <Text fontSize="lg">
                                When I'm not coding or managing products, you can find me working on my hojicha brand, Kuroha Hojicha, where I'm combining my love for tea with my entrepreneurial spirit.
                            </Text>
                        </VStack>
                    </MotionBox>
                </HStack>
            </VStack>
        </Container>
    );
} 