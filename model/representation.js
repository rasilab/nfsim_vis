import { SVG } from './lib/svg.esm.js';
import { fetchSvgContent } from './utils/fetchSvgContent.js';

export class Representation {
    constructor(svgContainer) {
        this.svgContainer = svgContainer;
    }
}

export class CreateSVGMolecules {
    // create the SVG representation of the molecules including site and pass those groups around
    constructor(monomer, index, svgContent) {
        this.svgContent = svgContent;
        this.molecule = monomer;
        this.index = index;
    }

    CreateMoleculeGroups() {
        
        if (this.svgContent) {
            const groupElement = SVG().group();
            groupElement.svg(this.svgContent);
            
            const moleculeElement = groupElement.first();
            const numSites = this.molecule.sites.length;

            if (numSites == 1) {
                var spacing = moleculeElement.width() / 2; 
            }
            else (spacing = moleculeElement.width() / (numSites + 1));
            
            groupElement.text(this.molecule.name)
                .attr("text-anchor", "left")
                .fill("black");

            this.molecule.sites.forEach((site, index) => {
                const relativePosition = {
                    x: (index + 1) * spacing,
                    y: moleculeElement.height() / 2
                };
                groupElement.circle()
                    .cx(relativePosition.x)
                    .cy(relativePosition.y)
                    .radius(5)
                    .fill("green")
                    .id(site);

                groupElement.text(site)
                    .x(relativePosition.x)
                    .y(relativePosition.y)
                    .attr("text-anchor", "middle")
                    .fill("green")
                    .id(site);
                });

            groupElement.id(this.molecule.name);

            return groupElement;
            }
            else {
                console.error("SVG content is empty.");
            }
    }
}

export class DefineBonds {
    constructor() {
        this.interactorIds = [];
        this.interactorMols = [];
        this.interactorSites = [];
    }

    // right now, they are 'linked' by indice, so it may be good to consider null conditions
    bondInteractors(productMol, productMolComponents, productBonds) {
        for (let i = 0; i < Object.keys(productBonds).length; i++) {
            const interactor = Object.entries(productBonds)[i][1]; // 0 is just the word 'site'
            const interactingMol = productMol[[interactor?.split('_')[0], interactor?.split('_')[1]].join('_')];
            const interactingSite = productMolComponents[interactor];
            this.interactorIds.push(interactor);
            this.interactorMols.push(interactingMol);
            this.interactorSites.push(interactingSite);
            }
        }
}

export class VisualizeRules extends Representation{
    constructor(svgContainer, definedBondsClass, rule, svgGroups) {
        super(svgContainer);
        this.interactome = definedBondsClass;
        this.rule = rule;
        this.svgGroups = svgGroups;
    }

    checkResultantStates(moleculeComponent, productStates) {
        // check if state is not null using key ('PP1_M1_C1')
        // add the state as some kind of attribute to be retained, or text?
        if (productStates[moleculeComponent] != null) {
            const resultantState = productStates[moleculeComponent]
            return resultantState;
        }
        else {
            return null;
        }
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
            const groupElement = SVG().group()
                .addTo(this.svgContainer)
            
            groupElement.transform({translate: this.position});

            const svgDoc = SVG()
                .svg(this.svgContent)
                .addTo(groupElement);

            const moleculeElement = svgDoc.first();

            const textElement = SVG().text(this.molecule.name)
                .x(0)
                .y(moleculeElement.height() / 2)
                .attr({ "text-anchor": "end", "fill": "black" })
                .addTo(groupElement);


            // Assume the SVG is longer horizontally and we're placing sites along the X-axis
            const width = moleculeElement.width();
            const numSites = this.molecule.sites.length;
            const spacing = width / (numSites + 1); // +1 to not place elements exactly on the edges

            this.molecule.sites.forEach((site, index) => {
                // Calculate position for each site
                const relativePosition = {
                    x: (index + 1) * spacing, // +1 so we don't start at 0,
                    y: moleculeElement.height() / 2 // Center vertically
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
        this.siteElement = SVG().group().addTo(this.svgContainer);
        SVG().circle()
            .center(relativePosition.x, relativePosition.y)
            .radius(5)
            .fill("green")
            .addTo(this.siteElement);
        SVG().text(this.site)
            .move(relativePosition.x, relativePosition.y - 25)
            .attr("text-anchor", "middle")
            .fill("green")
            .addTo(this.siteElement);

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
        const circleElement = this.siteElement.findOne('circle');
        const textElement = SVG().text(state)
            .attr({"text-anchor": "middle", fill: this.stateColors[this.stateIndex], id: 'state'})
            .center(circleElement.attr("cx"), parseInt(circleElement.attr("cy")) + 20)
            .addTo(this.siteElement);
    }

    startStateSwitching(interval = 1000) {
        setInterval(() => {
            this.stateIndex = (this.stateIndex + 1) % this.states.length;
            const textElement = this.siteElement.findOne('#state');
            const circleElement = this.siteElement.findOne('circle');
            circleElement.attr("fill", this.stateColors[this.stateIndex]);
            textElement.attr("fill", this.stateColors[this.stateIndex])
                .text(this.states[this.stateIndex]);
        }, interval);
    }
}
