import {
    Box,
    Container,
    Heading,
    VStack,
    Text,
    useColorModeValue,
    List,
    ListItem,
    ListIcon,
} from "@chakra-ui/react";
import { motion } from "framer-motion";
import { MdWorkOutline } from "react-icons/md";
import { useInView } from "react-intersection-observer";

const MotionBox = motion(Box);

const experiences = [
    {
        title: "Associate Product Manager",
        company: "Frequence (Acquired by Madhive)",
        location: "Mountain View, CA",
        duration: "July 2024 – Present",
        highlights: [
            "Led a complete revamp of the reporting architecture, enhancing scalability and reducing future developer effort by 13x",
            "Drove the launch of a new omnichannel adtech product, Digital Out-of-Home, contributing to $2M+ in revenue",
            "Manage a high-performing scrum team of four developers and three QA engineers",
            "Oversaw initiatives from discovery to launch"
        ]
    },
    {
        title: "Co-Founder",
        company: "Kalendir",
        location: "Cupertino, CA",
        duration: "December 2024 – Present",
        highlights: [
            "Built and launched a SaaS appointment scheduling tool using Django + React",
            "Developed interactive dashboards in Tableau and Power BI",
            "Developed core features including landing page, digital storefront, and reporting modules"
        ]
    },
    {
        title: "Co-Founder",
        company: "ReferralHub",
        location: "Cupertino, CA",
        duration: "December 2023 – June 2024",
        highlights: [
            "Co-founded and launched platform with 200% average week-over-week user growth",
            "Developed customer-facing features using React, TypeScript, and Python",
            "Managed Agile sprints and go-to-market strategy"
        ]
    }
];

export default function Experience() {
    const [ref, inView] = useInView({
        threshold: 0.1,
        triggerOnce: true,
    });

    return (
        <Container maxW="4xl" id="experience">
            <VStack spacing={12} alignItems="stretch">
                <Heading
                    as="h2"
                    size="xl"
                    textAlign="center"
                    bgGradient="linear(to-r, brand.400, brand.600)"
                    bgClip="text"
                >
                    Experience
                </Heading>

                <VStack
                    ref={ref}
                    spacing={8}
                    alignItems="stretch"
                    position="relative"
                    _before={{
                        content: "\"\"",
                        position: "absolute",
                        left: "50%",
                        height: "100%",
                        width: "2px",
                        bg: "brand.200",
                        transform: "translateX(-50%)",
                    }}
                >
                    {experiences.map((exp, index) => (
                        <MotionBox
                            key={index}
                            initial={{ opacity: 0, x: index % 2 === 0 ? -50 : 50 }}
                            animate={inView ? { opacity: 1, x: 0 } : {}}
                            transition={{ duration: 0.5, delay: index * 0.2 }}
                            bg={useColorModeValue("white", "gray.800")}
                            p={6}
                            borderRadius="lg"
                            boxShadow="md"
                            position="relative"
                            ml={index % 2 === 0 ? "0" : "auto"}
                            mr={index % 2 === 0 ? "auto" : "0"}
                            width="90%"
                            _before={{
                                content: "\"\"",
                                position: "absolute",
                                top: "50%",
                                right: index % 2 === 0 ? "-10px" : "auto",
                                left: index % 2 === 0 ? "auto" : "-10px",
                                width: "20px",
                                height: "20px",
                                bg: "brand.400",
                                borderRadius: "full",
                                transform: "translateY(-50%)",
                            }}
                        >
                            <VStack align="stretch" spacing={4}>
                                <Box>
                                    <Heading size="md" color="brand.500">
                                        {exp.title}
                                    </Heading>
                                    <Text fontSize="lg" fontWeight="medium">
                                        {exp.company}
                                    </Text>
                                    <Text color="gray.500">
                                        {exp.location} | {exp.duration}
                                    </Text>
                                </Box>

                                <List spacing={2}>
                                    {exp.highlights.map((highlight, idx) => (
                                        <ListItem key={idx} display="flex" alignItems="center">
                                            <ListIcon as={MdWorkOutline} color="brand.500" />
                                            <Text>{highlight}</Text>
                                        </ListItem>
                                    ))}
                                </List>
                            </VStack>
                        </MotionBox>
                    ))}
                </VStack>
            </VStack>
        </Container>
    );
} 