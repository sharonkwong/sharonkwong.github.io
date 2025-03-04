import {
    Container,
    Heading,
    SimpleGrid,
    Box,
    Text,
    VStack,
    useColorModeValue,
} from "@chakra-ui/react";
import { motion } from "framer-motion";
import { useInView } from "react-intersection-observer";

const MotionBox = motion(Box);

const skills = [
    {
        category: "Technical",
        items: ["Jira", "Excel", "Tableau", "Figma", "Canva", "Qualtrics", "Jupyter", "Git", "Grafana", "Looker"]
    },
    {
        category: "Software",
        items: ["SQL", "R", "Python", "Java", "React", "Power BI", "PostgreSQL", "MySQL", "AWS (ECS, RDS)", "Django", "Terraform"]
    },
    {
        category: "Strengths",
        items: ["Research & Strategy", "Product Management", "Optimization", "Ad Hoc Reports", "Data Analysis", "Software Development"]
    }
];

const SkillCard = ({ category, items, index }: { category: string; items: string[]; index: number }) => {
    const [ref, inView] = useInView({
        threshold: 0.1,
        triggerOnce: true,
    });

    return (
        <MotionBox
            ref={ref}
            initial={{ opacity: 0, y: 20 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.5, delay: index * 0.1 }}
            bg={useColorModeValue("white", "gray.800")}
            p={6}
            borderRadius="lg"
            boxShadow="md"
            height="100%"
        >
            <VStack align="stretch" spacing={4}>
                <Heading size="md" color="brand.500">
                    {category}
                </Heading>
                <Box>
                    {items.map((item, idx) => (
                        <Text
                            key={idx}
                            as="span"
                            display="inline-block"
                            bg="brand.50"
                            color="brand.700"
                            px={3}
                            py={1}
                            borderRadius="full"
                            fontSize="sm"
                            m={1}
                            _hover={{
                                bg: "brand.100",
                                transform: "translateY(-2px)",
                                transition: "all 0.2s",
                            }}
                        >
                            {item}
                        </Text>
                    ))}
                </Box>
            </VStack>
        </MotionBox>
    );
};

export default function Skills() {
    return (
        <Container maxW="4xl" id="skills">
            <VStack spacing={12}>
                <Heading
                    as="h2"
                    size="xl"
                    bgGradient="linear(to-r, brand.400, brand.600)"
                    bgClip="text"
                    textAlign="center"
                >
                    Skills
                </Heading>

                <SimpleGrid columns={{ base: 1, md: 3 }} spacing={8} width="100%">
                    {skills.map((skill, index) => (
                        <SkillCard
                            key={skill.category}
                            category={skill.category}
                            items={skill.items}
                            index={index}
                        />
                    ))}
                </SimpleGrid>
            </VStack>
        </Container>
    );
} 