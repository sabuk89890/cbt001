// Utility: Deterministic color from string
// JS murni, tanpa tipe agar aman di Vercel/Next.js
exports.getRandomColor = function(seed) {
	return `hsl(${Math.abs(seed.split("").reduce(function(acc, char) { return char.charCodeAt(0) + ((acc << 5) - acc); }, 0)) % 360},70%,75%)`;
};
