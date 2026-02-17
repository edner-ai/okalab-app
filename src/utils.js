import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

export const createPageUrl = (name) => {
    if (name === 'Home') return '/';
    return `/${name.toLowerCase()}`;
};