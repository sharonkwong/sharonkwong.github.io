import { Container, Heading, Text, VStack } from "@chakra-ui/react";
import { motion } from "framer-motion";

export default function Hobbies() {
    return (
        <Container maxW="6xl" id="hobbies" py={{ base: 16, md: 24 }}>
            <motion.div
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-100px" }}
                transition={{ duration: 0.6 }}
            >
                <VStack spacing={4} alignItems="center">
                    <Heading
                        as="h2"
                        fontSize={{ base: "3xl", md: "4xl" }}
                        fontWeight="700"
                        color="#EAA3C4"
                        textAlign="center"
                    >
                        Hobbies
                    </Heading>
                    <Text color="gray.500" fontSize="lg" pt={4}>
                        Coming soon — what I do outside of work.
                    </Text>
                </VStack>
            </motion.div>
        </Container>
    );
}
