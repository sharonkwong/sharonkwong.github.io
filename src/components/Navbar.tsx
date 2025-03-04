import { Box, Flex, Button, useColorModeValue, Stack, HStack } from "@chakra-ui/react";
import { Link } from "react-scroll";
import { NavItem } from "../types";

const NAV_ITEMS: NavItem[] = [
    { label: "About", section: "about" },
    { label: "Experience", section: "experience" },
    { label: "Projects", section: "projects" },
    { label: "Skills", section: "skills" },
    { label: "Contact", section: "contact" },
];

export default function Navbar() {
    const bg = useColorModeValue("white", "gray.800");

    return (
        <Box
            position="fixed"
            top={0}
            left={0}
            right={0}
            bg={bg}
            px={4}
            boxShadow="sm"
            zIndex="sticky"
        >
            <Flex h={16} alignItems="center" justifyContent="space-between" maxW="6xl" mx="auto">
                <Link to="hero" smooth={true} duration={500} offset={-80}>
                    <Button variant="ghost" fontSize="lg" fontWeight="bold">
                        SK
                    </Button>
                </Link>

                <HStack spacing={8} alignItems="center">
                    <Stack direction="row" spacing={4}>
                        {NAV_ITEMS.map((navItem) => (
                            <Link
                                key={navItem.label}
                                to={navItem.section}
                                smooth={true}
                                duration={500}
                                offset={-80}
                            >
                                <Button variant="ghost" size="sm">
                                    {navItem.label}
                                </Button>
                            </Link>
                        ))}
                    </Stack>
                </HStack>
            </Flex>
        </Box>
    );
} 