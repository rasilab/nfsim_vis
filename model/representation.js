import { Model, Monomer, Parameter, Rule, InitialCondition } from './model.js';

export class Representation {
    constructor(svgContainer) {
        this.svgContainer = svgContainer;
    }

    createSvgElement(tagName, attributes) {
        const elem = document.createElementNS("http://www.w3.org/2000/svg", tagName);
        for (const attr in attributes) {
            elem.setAttribute(attr, attributes[attr]);
        }
        return elem;
    }

    appendSvgElement(element) {
        this.svgContainer.appendChild(element);
    }
}

async function fetchSvgContent(svgFileName) {
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

export class MoleculeRepresentation extends Representation {
    constructor(svgContainer, molecule, svgFilePath) {
        super(svgContainer);
        this.molecule = molecule;
        this.position = { x: 0, y: 0 }; // Default position
        this.sites = []; // Stores SiteRepresentation instances
        this.svgContent = ''; // Placeholder for SVG content
        this.svgFilePath = svgFilePath;
    }

    async visualize(position) {
        this.position = position; // Store the position

        if (!this.svgContent) {
            this.svgContent = await fetchSvgContent(this.svgFilePath);
        }

        if (this.svgContent) {
            const svgElement = this.createSvgElement("g", {}); // Group element for molecule visualization
            this.svgContainer.appendChild(svgElement);
            svgElement.setAttribute("transform", `translate(${this.position.x}, ${this.position.y})`);
            // Parse the SVG string and append it to the group element
            const parser = new DOMParser();
            const svgDoc = parser.parseFromString(this.svgContent, "image/svg+xml");
            svgElement.appendChild(svgDoc.documentElement);
        } else {
            console.error("SVG content is empty.");
        }
    }

}



export class SiteRepresentation extends Representation {
    constructor(svgContainer, moleculeRep, site) {
        super(svgContainer);
        this.moleculeRep = moleculeRep;
        this.site = site;
        this.relativePosition = { x: 0, y: 0 }; // Default relative position
        this.siteElement = this.createSvgElement("g", {}); // Group element for site visualization
        this.svgContainer.appendChild(this.siteElement);
    }

    visualize(relativePosition) {
        this.relativePosition = relativePosition; // Store relative position
        const absolutePosition = {
            x: this.moleculeRep.position.x + relativePosition.x,
            y: this.moleculeRep.position.y + relativePosition.y
        };
        // Create and append the SVG element for the site

        // Optionally, add a label or other visual indicators as needed
        const text = this.createSvgElement("text", {
            x: absolutePosition.x,
            y: absolutePosition.y + 4, // Adjust for centering the text within the rectangle
            "font-size": "10px",
            "text-anchor": "middle",
            fill: "black"
        });
        text.textContent = this.site;
        this.siteElement.appendChild(text);
        var textwidth = text.getBBox().width;
        var textheight = text.getBBox().height;

        // console.log(textwidth, textheight)

        const rect = this.createSvgElement("rect", {
            x: absolutePosition.x - textwidth / 2, // Adjust as needed for visual appearance
            y: absolutePosition.y - textheight / 2, // Adjust as needed for visual appearance
            width: textwidth,
            height: textheight,
            fill: "none",
            stroke: "black",
            opacity: 0.5,
            "stroke-width": 1
        });
        this.siteElement.appendChild(rect);



        // Set the initial position of the group
        this.siteElement.setAttribute("transform", `translate(${absolutePosition.x}, ${absolutePosition.y})`);
        // console.log("Site visualized at:", absolutePosition);
    }

    updatePosition(position) {
        // Update the position of the group element
        if (this.siteElement) {
            this.siteElement.setAttribute("transform", `translate(${position.x}, ${position.y})`);
            // console.log("Site moved to:", position);
        }
    }
}
