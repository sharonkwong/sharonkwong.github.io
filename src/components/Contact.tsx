import { Box, Container, Heading, Text, VStack, HStack, IconButton } from "@chakra-ui/react";
import { motion } from "framer-motion";
import { FaLinkedinIn, FaEnvelope } from "react-icons/fa";

export default function Contact() {
    return (
        <Container maxW="6xl" id="contact" py={{ base: 16, md: 24 }}>
            <motion.div
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-100px" }}
                transition={{ duration: 0.6 }}
            >
                <VStack spacing={6} alignItems="center" textAlign="center">
                    <Heading
                        as="h2"
                        fontSize={{ base: "3xl", md: "4xl" }}
                        fontWeight="700"
                        color="gray.900"
                    >
                        Let's Connect
                    </Heading>
                    <Box w="60px" h="3px" bgGradient="linear(to-r, #EAA3C4, #FABDB2)" borderRadius="full" />
                    <Text color="gray.500" fontSize="lg" maxW="500px" pt={2}>
                        I'm always open to chatting about product, building, or new opportunities.
                    </Text>
                    <HStack spacing={4} pt={4}>
                        <IconButton
                            as="a"
                            href="mailto:sharonjkwong@gmail.com"
                            aria-label="Email"
                            icon={<FaEnvelope />}
                            fontSize="xl"
                            color="gray.600"
                            bg="gray.50"
                            _hover={{
                                color: "white",
                                bg: "#EAA3C4",
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
                            fontSize="xl"
                            color="gray.600"
                            bg="gray.50"
                            _hover={{
                                color: "white",
                                bg: "#EAA3C4",
                            }}
                            borderRadius="full"
                            size="lg"
                            transition="all 0.2s"
                        />
                    </HStack>
                </VStack>
            </motion.div>
        </Container>
    );
}
