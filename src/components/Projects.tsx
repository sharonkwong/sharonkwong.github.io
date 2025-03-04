import {
    Container,
    Heading,
    SimpleGrid,
    VStack,
    Text,
    Box,
    Badge,
    Link,
    Icon,
    useColorModeValue,
    HStack,
} from "@chakra-ui/react";
import { motion } from "framer-motion";
import { useInView } from "react-intersection-observer";
import {  FaExternalLinkAlt } from "react-icons/fa";

const MotionBox = motion(Box);

const projects = [
    {
        title: "Kuroha Hojicha",
        description: "Building a premium hojicha brand and e-commerce business from scratch. Developing the website with modern technologies and integrating with Stripe for seamless payment processing.",
        technologies: ["React", "TypeScript", "Stripe", "E-commerce"],
        inProgress: true,
    },
    {
        title: "Kalendir",
        description: "A SaaS appointment scheduling platform enabling businesses across 15+ industries to create customizable booking flows and manage employees effectively.",
        technologies: ["Django", "React", "PostgreSQL", "Tableau", "Power BI"],
        link: "https://kalendir.com",
    },
    {
        title: "ReferralHub",
        description: "An online platform facilitating user connections and referrals, featuring in-chat payments and marketplace functionality. Achieved 200% week-over-week growth.",
        technologies: ["React", "TypeScript", "Python", "Grafana"],
        link: "https://referralhub.dev",
    },
];

const ProjectCard = ({ project, index }: { project: typeof projects[0]; index: number }) => {
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
            position="relative"
            _hover={{
                transform: "translateY(-5px)",
                transition: "all 0.2s",
                boxShadow: "xl",
            }}
        >
            <VStack align="stretch" spacing={4}>
                <Box>
                    <Heading size="md" color="brand.500" mb={2}>
                        {project.title}
                        {project.inProgress && (
                            <Badge ml={2} colorScheme="green">
                                In Progress
                            </Badge>
                        )}
                    </Heading>
                    <Text color={useColorModeValue("gray.600", "gray.300")}>
                        {project.description}
                    </Text>
                </Box>

                <Box>
                    {project.technologies.map((tech) => (
                        <Badge
                            key={tech}
                            mr={2}
                            mb={2}
                            colorScheme="brand"
                            variant="subtle"
                        >
                            {tech}
                        </Badge>
                    ))}
                </Box>

                {project.link && (
                    <Link
                        href={project.link}
                        isExternal
                        color="brand.500"
                        _hover={{ textDecoration: "none" }}
                    >
                        <HStack spacing={1}>
                            <Icon as={FaExternalLinkAlt} />
                            <Text>Visit Project</Text>
                        </HStack>
                    </Link>
                )}
            </VStack>
        </MotionBox>
    );
};

export default function Projects() {
    return (
        <Container maxW="4xl" id="projects">
            <VStack spacing={12}>
                <Heading
                    as="h2"
                    size="xl"
                    bgGradient="linear(to-r, brand.400, brand.600)"
                    bgClip="text"
                    textAlign="center"
                >
                    Projects
                </Heading>

                <SimpleGrid columns={{ base: 1, md: 2 }} spacing={8} width="100%">
                    {projects.map((project, index) => (
                        <ProjectCard key={project.title} project={project} index={index} />
                    ))}
                </SimpleGrid>
            </VStack>
        </Container>
    );
} 