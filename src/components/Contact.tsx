import {
    Container,
    Heading,
    VStack,
    HStack,
    Text,
    Button,
    useColorModeValue,
    Icon,
} from "@chakra-ui/react";
import { FaLinkedin, FaGithub, FaEnvelope, FaPhone } from "react-icons/fa";


const contactInfo = [
    {
        icon: FaEnvelope,
        label: "Email",
        value: "sharonjkwong@gmail.com",
        href: "mailto:sharonjkwong@gmail.com",
    },
    {
        icon: FaPhone,
        label: "Phone",
        value: "(408) 702-7692",
        href: "tel:+14087027692",
    },
    {
        icon: FaLinkedin,
        label: "LinkedIn",
        value: "linkedin.com/in/sharonjkwong",
        href: "https://linkedin.com/in/sharonjkwong",
    },
    {
        icon: FaGithub,
        label: "GitHub",
        value: "github.com/sharonkwong",
        href: "https://github.com/sharonkwong",
    },
];

export default function Contact() {
    const buttonBg = useColorModeValue("brand.500", "brand.200");
    const buttonColor = useColorModeValue("white", "gray.800");

    return (
        <Container maxW="4xl" id="contact">
            <VStack spacing={12}>
                <Heading
                    as="h2"
                    size="xl"
                    bgGradient="linear(to-r, brand.400, brand.600)"
                    bgClip="text"
                    textAlign="center"
                >
                    Get in Touch
                </Heading>

                <VStack
                    spacing={8}
                    width="100%"
                >
                    <Text fontSize="lg" textAlign="center" maxW="xl">
                        I'm always open to new opportunities and collaborations. Feel free to reach out!
                    </Text>

                    <HStack
                        spacing={{ base: 4, md: 8 }}
                        flexWrap="wrap"
                        justify="center"
                        width="100%"
                    >
                        {contactInfo.map((contact) => (
                            <Button
                                key={contact.label}
                                as="a"
                                href={contact.href}
                                target={contact.icon !== FaPhone ? "_blank" : undefined}
                                leftIcon={<Icon as={contact.icon} />}
                                size="lg"
                                variant="solid"
                                bg={buttonBg}
                                color={buttonColor}
                                _hover={{
                                    transform: "translateY(-2px)",
                                    boxShadow: "lg",
                                }}
                                m={2}
                            >
                                {contact.label}
                            </Button>
                        ))}
                    </HStack>

                    <Text fontSize="sm" color="gray.500" textAlign="center">
                        Based in Cupertino, CA • Available for remote opportunities
                    </Text>
                </VStack>
            </VStack>
        </Container>
    );
} 