export async function fetchSvgContent(svgFileName) {
    try {
        const response = await fetch(svgFileName);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const svgText = await response.text();
        return svgText;
    } catch (error) {
        console.error("Could not fetch SVG: ", error);
        return null;
    }
}