import { Flex, Button, Stack, HStack } from "@chakra-ui/react";
import { Link } from "react-scroll";
import { NavItem } from "../types";

const NAV_ITEMS: NavItem[] = [
    { label: "Experience", section: "experience" },
    // { label: "Hobbies", section: "hobbies" },
    { label: "Contact", section: "hero" },
];

export default function Navbar() {
    return (
        <Flex
            position="fixed"
            top={4}
            left="50%"
            transform="translateX(-50%)"
            zIndex="sticky"
            className="liquid-glass-nav"
            px={2}
            py={1}
            alignItems="center"
            justifyContent="center"
        >
            <HStack spacing={0} alignItems="center">
                <Stack direction="row" spacing={0}>
                    {NAV_ITEMS.map((navItem) => (
                        <Link
                            key={navItem.label}
                            to={navItem.section}
                            smooth={true}
                            duration={500}
                            offset={-80}
                        >
                            <Button
                                variant="ghost"
                                size="sm"
                                fontWeight="500"
                                fontSize="sm"
                                color="gray.700"
                                _hover={{
                                    color: "#ea8cb8",
                                    bg: "rgba(234, 163, 196, 0.15)",
                                }}
                                borderRadius="full"
                                px={5}
                                h={9}
                                transition="all 0.2s"
                            >
                                {navItem.label}
                            </Button>
                        </Link>
                    ))}
                </Stack>
            </HStack>
        </Flex>
    );
}
