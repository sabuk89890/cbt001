export const getRandomColor = (seed: string) => `hsl(${Math.abs(seed.split("").reduce((acc, char) => char.charCodeAt(0) + ((acc << 5) - acc), 0)) % 360},70%,75%)`;
