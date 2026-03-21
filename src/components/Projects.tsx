import { Container, Heading, Text, VStack } from "@chakra-ui/react";
import { motion } from "framer-motion";

export default function Projects() {
    return (
        <Container maxW="6xl" id="projects" py={{ base: 16, md: 24 }}>
            <motion.div
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-100px" }}
                transition={{ duration: 0.6 }}
            >
                <VStack spacing={4} alignItems="flex-start">
                    <Heading
                        as="h2"
                        fontSize={{ base: "3xl", md: "4xl" }}
                        fontWeight="700"
                        color="#EAA3C4"
                    >
                        Projects
                    </Heading>
                    <Text color="gray.500" fontSize="lg" pt={4}>
                        Coming soon — things I've built and shipped.
                    </Text>
                </VStack>
            </motion.div>
        </Container>
    );
}
