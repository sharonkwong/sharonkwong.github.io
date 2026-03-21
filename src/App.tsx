import { ChakraProvider, Box, VStack, HStack, Image } from "@chakra-ui/react";
import Navbar from "./components/Navbar";
import Hero from "./components/Hero";
import Experience from "./components/Experience";
// import Hobbies from "./components/Hobbies";
import ScrollToTop from "./components/ScrollToTop";
import MoRain from "./components/MoRain";
import theme from "./theme";

function App() {
  return (
    <ChakraProvider theme={theme}>
      <Box bg="white" minH="100vh" px={{ base: 6, md: 0 }}>
        <MoRain>
          <Navbar />
          <Hero />
          <VStack spacing={0}>
            <Experience />
            {/* <Hobbies /> */}
          </VStack>
          <ScrollToTop />
        </MoRain>
        {/* Footer */}
        <Box
          as="footer"
          py={8}
          textAlign="center"
          color="gray.400"
          fontSize="sm"
          borderTop="1px solid"
          borderColor="gray.100"
        >
          Sharon Kwong &copy; {new Date().getFullYear()}
          <HStack fontSize="xs" color="gray.300" mt={1} justify="center" spacing={1}>
            <span>Made with</span>
            <Image src="/claude.png" alt="Claude" h="12px" display="inline-block" />
            <span>Claude Code</span>
          </HStack>
        </Box>
      </Box>
    </ChakraProvider>
  );
}

export default App;
