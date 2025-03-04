export interface NavItem {
    label: string;
    section: string;
}

export interface Experience {
    title: string;
    company: string;
    location: string;
    duration: string;
    highlights: string[];
}

export interface Project {
    title: string;
    description: string;
    technologies: string[];
    link?: string;
}

export interface Skill {
    category: string;
    items: string[];
} 