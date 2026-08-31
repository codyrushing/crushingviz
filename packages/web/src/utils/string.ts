import { marked } from "marked";

export const parse = (markdown: string) => marked.parse(markdown, { async: false }) as string;
