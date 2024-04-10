import { Model, Monomer, Parameter, Rule, InitialCondition } from './model.js';
import { fetchSvgContent } from './utils/fetchSvgContent.js';

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
            const groupElement = this.createSvgElement("g", {}); // Group element for molecule visualization
            this.svgContainer.appendChild(groupElement);
            groupElement.setAttribute("transform", `translate(${this.position.x}, ${this.position.y})`);
            // Parse the SVG string and append it to the group element
            const parser = new DOMParser();
            const svgDoc = parser.parseFromString(this.svgContent, "image/svg+xml");
            const moleculeElement = svgDoc.documentElement;
            groupElement.appendChild(moleculeElement);

            // Add molecule name to the left end of the SVG element with right alignment
            const textElement = this.createSvgElement("text");
            textElement.setAttribute("x", 0); // Left end of the SVG element
            textElement.setAttribute("y", moleculeElement.height.baseVal.value / 2); // Center vertically
            textElement.setAttribute("text-anchor", "end"); // Right alignment
            textElement.setAttribute("fill", "black"); // Example text color
            textElement.textContent = this.molecule.name; // Use the name of the molecule as the text
            groupElement.appendChild(textElement);

            // Assume the SVG is longer horizontally and we're placing sites along the X-axis
            const width = moleculeElement.viewBox.baseVal.width || moleculeElement.width.baseVal.value;
            const numSites = this.molecule.sites.length;
            const spacing = width / (numSites + 1); // +1 to not place elements exactly on the edges

            this.molecule.sites.forEach((site, index) => {
                // Calculate position for each site
                const relativePosition = {
                    x: (index + 1) * spacing, // +1 so we don't start at 0,
                    y: moleculeElement.height.baseVal.value / 2 // Center vertically
                };

                this.sites.push(new SiteRepresentation(groupElement, this, site, relativePosition));
            });
        } else {
            console.error("SVG content is empty.");
        }
    }
}


export class SiteRepresentation extends Representation {
    constructor(svgContainer, moleculeRep, site, relativePosition = { x: 0, y: 0 }) {
        super(svgContainer);
        this.moleculeRep = moleculeRep;
        this.site = site;
        this.relativePosition = relativePosition;
        this.siteElement = this.createSvgElement("g"); // Group element for site visualization

        const circleElement = this.createSvgElement("circle");
        circleElement.setAttribute("cx", relativePosition.x);
        circleElement.setAttribute("cy", relativePosition.y);
        circleElement.setAttribute("r", 5); // Example radius
        circleElement.setAttribute("fill", "green"); // Example fill color
        this.siteElement.appendChild(circleElement);

        const textElement = this.createSvgElement("text");
        textElement.setAttribute("x", relativePosition.x);
        textElement.setAttribute("y", relativePosition.y - 10); // Adjust the y position for the text
        textElement.setAttribute("text-anchor", "middle"); // Center the text horizontally
        textElement.setAttribute("fill", "green"); // Example text color
        textElement.textContent = this.site; // Use the name of the site as the text
        this.siteElement.appendChild(textElement);

        this.svgContainer.appendChild(this.siteElement);

        let states = this.moleculeRep.molecule.states[site]; // Define your states
        if (states.length > 0) { // Check if states is not empty
            this.stateRepresentation = new StateRepresentation(svgContainer, this.siteElement, states);
            this.stateRepresentation.startStateSwitching(1000); // Switch state every 1000 milliseconds
        }
    }
}

export class StateRepresentation extends Representation {
    constructor(svgContainer, siteElement, states = []) {
        super(svgContainer);
        this.siteElement = siteElement;
        this.states = states;
        this.stateIndex = 0;
        this.stateColors = ['red', 'blue', 'green'];
        this.setState(this.states[this.stateIndex]);
    }

    setState(state) {
        this.state = state;
        const circleElement = this.siteElement.querySelector('circle');
        const textElement = this.createSvgElement("text");
        textElement.setAttribute("tag", circleElement.getAttribute("cx"));
        textElement.setAttribute("x", circleElement.getAttribute("cx"));
        textElement.setAttribute("y", parseInt(circleElement.getAttribute("cy")) + 20); // Adjust the y position for the text
        textElement.setAttribute("text-anchor", "middle"); // Center the text horizontally
        textElement.setAttribute("fill", this.stateColors[this.stateIndex]); // Example text color
        textElement.textContent = state; // Use the state as the text
        this.siteElement.appendChild(textElement);
    }

    startStateSwitching(interval = 1000) {
        setInterval(() => {
            this.stateIndex = (this.stateIndex + 1) % this.states.length;
            const textElement = this.siteElement.querySelector('text:last-child');
            const circleElement = this.siteElement.querySelector('circle');
            circleElement.setAttribute("fill", this.stateColors[this.stateIndex]);
            textElement.setAttribute("fill", this.stateColors[this.stateIndex]);
            textElement.textContent = this.states[this.stateIndex];
        }, interval);
    }
}