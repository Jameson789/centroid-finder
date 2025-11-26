import { useEffect, useRef } from "react";

export default function useBinarizedImage(imgRef, imgLoaded, color, threshold) {
    const canvasRef = useRef(null);

    useEffect(() => {
        if (!imgRef.current || !canvasRef.current) return;
        const img = imgRef.current;
        const canvas = canvasRef.current;
        const ctx = canvas.getContext("2d");

        // Scale image
        const scale = 300 / img.width;
        const width = img.width * scale;
        const height = img.height * scale;

        canvas.width = width;
        canvas.height = height;

        // Draw and process the image
        ctx.drawImage(img, 0, 0, width, height);
        const imageData = ctx.getImageData(0, 0, width, height);
        const data = imageData.data;

        // target color values
        const rT = parseInt(color.slice(1, 3), 16);
        const gT = parseInt(color.slice(3, 5), 16);
        const bT = parseInt(color.slice(5, 7), 16);

        // Process each individual pixel
        for (let i = 0; i < data.length; i += 4) {
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];

            const diff = Math.sqrt((r - rT) ** 2 + (g - gT) ** 2 + (b - bT) ** 2);
            const value = diff < threshold ? 0 : 255;
            data[i] = data[i + 1] = data[i + 2] = value;
        }

        ctx.putImageData(imageData, 0, 0);
    }, [imgRef, imgLoaded, color, threshold]);

    return canvasRef;
}


