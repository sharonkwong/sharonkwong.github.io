import { Box, Container, Heading, Text, VStack, HStack, List, ListItem, ListIcon, Image, Link, Badge, Wrap, WrapItem } from "@chakra-ui/react";
import { motion } from "framer-motion";
import { useEffect, useRef } from "react";
import { BsDot } from "react-icons/bs";

interface ExperienceItem {
    title: string;
    company: string;
    logo: string;
    logoSize?: string;
    link?: string;
    linkLabel?: string;
    location: string;
    duration: string;
    highlights: string[];
}

const experiences: ExperienceItem[] = [
    {
        title: "Associate Product Manager",
        company: "Madhive",
        logo: "/madhive-fq.png",
        link: "madhive.com",
        location: "Mountain View, CA",
        duration: "July 2024 – Present",
        highlights: [
            "Led a complete revamp of the reporting architecture, enhancing scalability and reducing future developer effort by 13x, driving consensus across sales, client success, operations, engineering, and product",
            "Drove the launch of Digital Out-of-Home across 6 teams, covering the full product cycle from campaign insertion order to reporting, contributing to $19M+ in revenue and growing",
            "Managing two high-performing teams, owning both data pipelines/ETLs and frontend components of enterprise analytics dashboards with a revenue-driven sprint backlog",
            "Owning end-to-end product documentation (PRDs, one-pagers, technical specs, data flow diagrams) to deliver enterprise solutions on time",
        ],
    },
    {
        title: "Co-founder",
        company: "Kalendir",
        logo: "/kalendir.png",
        logoSize: "28px",
        link: "kalendir.com",
        location: "Cupertino, CA",
        duration: "December 2024 – Present",
        highlights: [
            "Shipped a fully functional MVP (desktop web, iOS, and Android) within 3 months — by month 4, customers were fully relying on the platform to manage clients, appointments, and day-to-day operations",
            "Building a SaaS appointment scheduling tool using Django & React, enabling businesses across 15+ industries and hundreds of users to create customizable booking flows",
            "Planning product roadmap and ensuring strong market fit through competitor research, door-to-door sales, client conversations, and demos",
            "Designing database models, contributing heavily to frontend development, and leveraging AI tools (Figma Make, Claude Code, Cursor) to streamline design and implementation",
            "Developed interactive Grafana dashboards using PostgreSQL, tracking outreach, customer retention, and revenue growth",
        ],
    },
    {
        title: "Co-founder",
        company: "ReferralHub",
        logo: "/referralhub.png",
        link: "referralhub.dev",
        location: "Cupertino, CA",
        duration: "December 2023 – June 2024",
        highlights: [
            "Co-founded and scaled a platform from 0 to 1, achieving 200% average weekly user growth and generating thousands in sales within the first month (featured by Bloomberg!)",
            "Developed customer-facing features using React, TypeScript, and Python, including in-chat payments, user onboarding, and marketplace features",
            "Managed Agile sprints, go-to-market strategy, and created internal Grafana dashboards using PostgreSQL, 3x-ing user acquisition rate",
            "Utilized Canva and Figma to create wireframes and user interaction mockups for critical features",
        ],
    },
];

const consultingClients = [
    { name: "Abby's Legendary Pizza", logo: "/abbys_legendary_pizza-removebg-preview.png" },
    { name: "North Coast Container", logo: "/North-Coast-Container-logo.webp" },
    { name: "Camp Lutherwood", logo: "/camp lutherwood.png" },
    { name: "University of Oregon", logo: "/University-of-Oregon.png" },
    { name: "Maple Microdevelopment", logo: "/maple microdevelopment.webp" },
];

const consultingTags = [
    { label: "Real estate expansion", color: "#E8967A" },
    { label: "Production optimization", color: "#D88BAF" },
    { label: "Market entry", color: "#E8967A" },
    { label: "New program development", color: "#D88BAF" },
];

export default function Experience() {
    const calendarRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const script = document.createElement("script");
        script.src = "https://unpkg.com/github-calendar@latest/dist/github-calendar.min.js";
        script.onload = () => {
            if (calendarRef.current && (window as any).GitHubCalendar) {
                (window as any).GitHubCalendar(calendarRef.current, "sharonkwong", {
                    responsive: true,
                    tooltips: true,
                });
            }
        };
        document.head.appendChild(script);

        const link = document.createElement("link");
        link.rel = "stylesheet";
        link.href = "https://unpkg.com/github-calendar@latest/dist/github-calendar-responsive.css";
        document.head.appendChild(link);

        return () => {
            document.head.removeChild(script);
            document.head.removeChild(link);
        };
    }, []);

    return (
        <Container maxW="4xl" id="experience" py={{ base: 16, md: 24 }}>
            <VStack spacing={12} alignItems="stretch" w="100%">
                <motion.div
                    initial={{ opacity: 0, y: 30 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: "-100px" }}
                    transition={{ duration: 0.6 }}
                >
                    <Heading
                        as="h2"
                        fontSize={{ base: "3xl", md: "4xl" }}
                        fontWeight="700"
                        color="#EAA3C4"
                        textAlign="center"
                    >
                        Experience
                    </Heading>
                </motion.div>

                {/* GitHub Contribution Calendar */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: "-50px" }}
                    transition={{ duration: 0.5 }}
                >
                    <Box
                        ref={calendarRef}
                        w="100%"
                        fontSize="sm"
                        color="gray.500"
                        textAlign="center"
                        sx={{
                            "& .calendar": {
                                fontFamily: "Inter, sans-serif",
                            },
                            "& .contrib-legend": {
                                display: "none",
                            },
                            "& .text-muted": {
                                display: "none",
                            },
                            "& rect": {
                                rx: "3",
                                ry: "3",
                            },
                        }}
                    >
                        Loading contributions...
                    </Box>
                </motion.div>

                <VStack spacing={10} alignItems="stretch" w="100%">
                    {experiences.map((exp, index) => (
                        <motion.div
                            key={index}
                            initial={{ opacity: 0, y: 30 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true, margin: "-50px" }}
                            transition={{ duration: 0.5, delay: index * 0.1 }}
                        >
                            <Box
                                pl={6}
                                borderLeft="2px solid"
                                borderColor="gray.100"
                                _hover={{ borderLeft: "4px solid", borderColor: "#EAA3C4" }}
                                transition="all 0.3s"
                            >
                                <HStack
                                    justify="space-between"
                                    align="flex-start"
                                    flexWrap="wrap"
                                    gap={1}
                                >
                                    <HStack spacing={3} align="center">
                                        {exp.logo && (
                                            <Image
                                                src={exp.logo}
                                                alt={exp.company}
                                                w={exp.logoSize || "36px"}
                                                h={exp.logoSize || "36px"}
                                                objectFit="contain"
                                                borderRadius="md"
                                                flexShrink={0}
                                            />
                                        )}
                                        <Box>
                                            <Heading as="h3" fontSize={{ base: "lg", md: "xl" }} fontWeight="700" color="gray.900">
                                                {exp.title}
                                            </Heading>
                                            <Text fontSize="md" fontWeight="500" color="#EAA3C4">
                                                {exp.company}
                                                {exp.link && (
                                                    <>
                                                        <Text as="span" color="gray.400" fontWeight="400">{" "}· </Text>
                                                        <Link
                                                            href={exp.link.startsWith("http") ? exp.link : `https://${exp.link}`}
                                                            isExternal
                                                            color="gray.400"
                                                            fontWeight="400"
                                                            _hover={{ color: "gray.600", textDecoration: "underline" }}
                                                        >
                                                            {exp.linkLabel || exp.link}
                                                        </Link>
                                                    </>
                                                )}
                                            </Text>
                                        </Box>
                                    </HStack>
                                    <Box textAlign={{ base: "left", md: "right" }} flexShrink={0}>
                                        <Text fontSize="sm" color="gray.500">
                                            {exp.duration}
                                        </Text>
                                        <Text fontSize="sm" color="gray.400">
                                            {exp.location}
                                        </Text>
                                    </Box>
                                </HStack>

                                <List spacing={2} mt={4}>
                                    {exp.highlights.map((highlight, idx) => (
                                        <ListItem
                                            key={idx}
                                            display="flex"
                                            alignItems="flex-start"
                                            fontSize="sm"
                                            color="gray.600"
                                            lineHeight="1.6"
                                        >
                                            <ListIcon as={BsDot} color="gray.400" fontSize="2xl" mt="-2px" flexShrink={0} />
                                            {highlight}
                                        </ListItem>
                                    ))}
                                </List>
                            </Box>
                        </motion.div>
                    ))}
                    {/* NBC Sports */}
                    <motion.div
                        initial={{ opacity: 0, y: 30 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true, margin: "-50px" }}
                        transition={{ duration: 0.5, delay: 0.1 }}
                    >
                        <Box
                            pl={6}
                            borderLeft="2px solid"
                            borderColor="gray.100"
                            _hover={{ borderLeft: "4px solid", borderColor: "#EAA3C4" }}
                            transition="all 0.3s"
                        >
                            <HStack
                                justify="space-between"
                                align="flex-start"
                                flexWrap="wrap"
                                gap={1}
                            >
                                <HStack spacing={3} align="center">
                                    <Image
                                        src="/nbcsports.png"
                                        alt="NBC Sports"
                                        w="36px"
                                        h="36px"
                                        objectFit="contain"
                                        borderRadius="md"
                                        flexShrink={0}
                                    />
                                    <Box>
                                        <Heading as="h3" fontSize={{ base: "lg", md: "xl" }} fontWeight="700" color="gray.900">
                                            Social Media Project Management Intern
                                        </Heading>
                                        <Text fontSize="md" fontWeight="500" color="#EAA3C4">
                                            NBC Sports
                                            <Text as="span" color="gray.400" fontWeight="400">{" "}· </Text>
                                            <Link
                                                href="https://www.canva.com/design/DAFHeLbJnbA/Z3rraybpXOgbV7Ny6DRekg/view"
                                                isExternal
                                                color="gray.400"
                                                fontWeight="400"
                                                _hover={{ color: "gray.600", textDecoration: "underline" }}
                                            >
                                                summary deck
                                            </Link>
                                        </Text>
                                    </Box>
                                </HStack>
                                <Box textAlign={{ base: "left", md: "right" }} flexShrink={0}>
                                    <Text fontSize="sm" color="gray.500">
                                        November 2021 – July 2022
                                    </Text>
                                    <Text fontSize="sm" color="gray.400">
                                        Eugene, OR
                                    </Text>
                                </Box>
                            </HStack>

                            <List spacing={2} mt={4}>
                                <ListItem display="flex" alignItems="flex-start" fontSize="sm" color="gray.600" lineHeight="1.6">
                                    <ListIcon as={BsDot} color="gray.400" fontSize="2xl" mt="-2px" flexShrink={0} />
                                    Collaborated with NBC Sports and Olympics executives and NIL influencers to implement strategies to increase Track and Field engagement with the younger generation
                                </ListItem>
                                <ListItem display="flex" alignItems="flex-start" fontSize="sm" color="gray.600" lineHeight="1.6">
                                    <ListIcon as={BsDot} color="gray.400" fontSize="2xl" mt="-2px" flexShrink={0} />
                                    Led graphic design, video editing, and app development for the Prefontaine Classic and World Championships, resulting in 900K+ engagements across Instagram Reels and TikTok
                                </ListItem>
                            </List>
                        </Box>
                    </motion.div>
                    {/* Management Consultant section */}
                    <motion.div
                        initial={{ opacity: 0, y: 30 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true, margin: "-50px" }}
                        transition={{ duration: 0.5, delay: 0.1 }}
                    >
                        <Box
                            pl={6}
                            borderLeft="2px solid"
                            borderColor="gray.100"
                            _hover={{ borderLeft: "4px solid", borderColor: "#EAA3C4" }}
                            transition="all 0.3s"
                        >
                            <HStack
                                justify="space-between"
                                align="flex-start"
                                flexWrap="wrap"
                                gap={1}
                            >
                                <HStack spacing={3} align="center">
                                    <Image
                                        src="/images.png"
                                        alt="Management Consulting"
                                        w="36px"
                                        h="36px"
                                        objectFit="contain"
                                        borderRadius="md"
                                        flexShrink={0}
                                    />
                                    <Box>
                                        <Heading as="h3" fontSize={{ base: "lg", md: "xl" }} fontWeight="700" color="gray.900">
                                            Management Consultant
                                        </Heading>
                                        <Text fontSize="md" fontWeight="500" color="#EAA3C4">
                                            Past Clients
                                        </Text>
                                    </Box>
                                </HStack>
                                <Box textAlign={{ base: "left", md: "right" }} flexShrink={0}>
                                    <Text fontSize="sm" color="gray.500">
                                        September 2021 – June 2022
                                    </Text>
                                    <Text fontSize="sm" color="gray.400">
                                        Eugene, OR
                                    </Text>
                                </Box>
                            </HStack>

                            <HStack mt={6} flexWrap="wrap" alignItems="center" justify="space-between" pl={6} gap={4}>
                                {consultingClients.map((client) => (
                                    <Image
                                        key={client.name}
                                        src={client.logo}
                                        alt={client.name}
                                        objectFit="contain"
                                        h={{ base: "45px", md: "60px" }}
                                        maxW={{ base: "120px", md: "160px" }}
                                        title={client.name}
                                    />
                                ))}
                            </HStack>

                            <Wrap spacing={2} mt={5} pl={6}>
                                {consultingTags.map((tag) => (
                                    <WrapItem key={tag.label}>
                                        <Badge
                                            px={3}
                                            py={1}
                                            borderRadius="full"
                                            fontSize="xs"
                                            fontWeight="500"
                                            bg={`${tag.color}30`}
                                            color={tag.color}
                                            border="1px solid"
                                            borderColor={`${tag.color}60`}
                                        >
                                            {tag.label}
                                        </Badge>
                                    </WrapItem>
                                ))}
                            </Wrap>
                        </Box>
                    </motion.div>
                </VStack>
            </VStack>
        </Container>
    );
}
