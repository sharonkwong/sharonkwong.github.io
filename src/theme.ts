import { extendTheme } from "@chakra-ui/react";

const theme = extendTheme({
    config: {
        initialColorMode: "light",
        useSystemColorMode: false,
    },
    fonts: {
        heading: "'Inter', sans-serif",
        body: "'Inter', sans-serif",
    },
    colors: {
        brand: {
            50: "#FFF5F9",
            100: "#FFE8F0",
            200: "#FFD1E1",
            300: "#FFEDBC", // third
            400: "#FABDB2", // secondary
            500: "#EAA3C4", // primary
            600: "#D88BAF",
            700: "#C4739A",
            800: "#A85A82",
            900: "#8C4169",
        },
    },
    styles: {
        global: {
            body: {
                bg: "white",
                color: "gray.800",
            },
        },
    },
});

export default theme;
