import { extendTheme } from "@chakra-ui/react";

const theme = extendTheme({
    config: {
        initialColorMode: "light",
        useSystemColorMode: false,
    },
    fonts: {
        heading: "Inter, sans-serif",
        body: "Inter, sans-serif",
    },
    colors: {
        brand: {
            50: "#f0f9ff",
            100: "#e0f2fe",
            200: "#bae6fd",
            300: "#7dd3fc",
            400: "#38bdf8",
            500: "#0ea5e9",
            600: "#0284c7",
            700: "#0369a1",
            800: "#075985",
            900: "#0c4a6e",
        },
    },
    components: {
        Button: {
            defaultProps: {
                colorScheme: "brand",
            },
        },
    },
    styles: {
        global: {
            body: {
                bg: "gray.50",
            },
        },
    },
});

export default theme;
