import { ChakraProvider, Box, VStack } from "@chakra-ui/react";
import { useState, useEffect } from "react";
import Navbar from "./components/Navbar";
import Hero from "./components/Hero";
import About from "./components/About";
import Experience from "./components/Experience";
import Projects from "./components/Projects";
import Skills from "./components/Skills";
import Contact from "./components/Contact";
import EasterEgg from "./components/EasterEgg";
import theme from "./theme";

function App() {
  const [showEasterEgg, setShowEasterEgg] = useState(false);
  const [, setKonami] = useState<string[]>([]);

  // Konami code easter egg
  useEffect(() => {
    const konamiCode = ["ArrowUp", "ArrowUp", "ArrowDown", "ArrowDown", "ArrowLeft", "ArrowRight", "ArrowLeft", "ArrowRight", "b", "a"];

    const handleKeyDown = (event: KeyboardEvent) => {
      setKonami((prev) => {
        const newKonami = [...prev, event.key];
        if (newKonami.length > konamiCode.length) {
          newKonami.shift();
        }

        if (JSON.stringify(newKonami) === JSON.stringify(konamiCode)) {
          setShowEasterEgg(true);
        }

        return newKonami;
      });
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <ChakraProvider theme={theme}>
      <Box bg="gray.50" minH="100vh">
        <Navbar />
        <VStack spacing={20} py={20}>
          <Hero />
          <About />
          <Experience />
          <Projects />
          <Skills />
          <Contact />
        </VStack>
        {showEasterEgg && <EasterEgg onClose={() => setShowEasterEgg(false)} />}
      </Box>
    </ChakraProvider>
  );
}

export default App;
