import { Button } from "@chakra-ui/react";
import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useState } from "react";
import { FiArrowUp } from "react-icons/fi";

export default function ScrollToTop() {
    const [show, setShow] = useState(false);

    useEffect(() => {
        const onScroll = () => setShow(window.scrollY > 400);
        window.addEventListener("scroll", onScroll, { passive: true });
        return () => window.removeEventListener("scroll", onScroll);
    }, []);

    return (
        <AnimatePresence>
            {show && (
                <motion.div
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    transition={{ duration: 0.25 }}
                    style={{ position: "fixed", bottom: 28, right: 28, zIndex: 50 }}
                >
                    <Button
                        leftIcon={<FiArrowUp />}
                        onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
                        borderRadius="full"
                        size="md"
                        fontSize="sm"
                        fontWeight="500"
                        bg="transparent"
                        color="gray.500"
                        border="1px solid"
                        boxShadow="none"
                        _hover={{
                            color: "#EAA3C4",
                            borderColor: "#EAA3C4",
                        }}
                        _active={{
                            bg: "transparent",
                            color: "#EAA3C4",
                        }}
                        transition="all 0.2s"
                    >
                        Back to top
                    </Button>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
