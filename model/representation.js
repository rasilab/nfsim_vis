import { SVG } from './lib/svg.esm.js';
import { Model, Monomer, Parameter, Rule, InitialCondition } from './model.js';
import { fetchSvgContent } from './utils/fetchSvgContent.js';

export class Representation {
    constructor(svgContainer) {
        this.svgContainer = svgContainer;
    }
}

export class RuleModeling extends Representation {
    constructor(svgContainer, rr_attrs, rr, rateConstant, svgFilePath) {
        super(svgContainer);
        this.svgContent = '';
        this.svgFilePath = svgFilePath;
        this.rr_attrs = rr_attrs;
        this.rr = rr;
        this.name = rr_attrs.name;
        this.rulemap = rr_attrs.Map.MapItem;
        this.operations = rr_attrs.Operations;
        this.rp = rr_attrs.ReactantPatterns;
        this.pp = rr_attrs.ProductPatterns;
        this.rateConstant = rateConstant;
    }

    make_dictionary_moleculetypes() {
        const moleculetypes = {};
        const moleculelist = [];
        for (const reactantRule in this.pp) {
            for (const molecule in this.pp[reactantRule].Molecules) {
                const interactor_name = this.pp[reactantRule].Molecules[molecule].name;
                const mol_num = molecule.split("_")[molecule.split("_").length - 1];
                moleculetypes[mol_num] = interactor_name;
                moleculelist.push(interactor_name);
            }
        }
        return [moleculetypes, moleculelist];
    }

    async initiate_reaction(monomer, index, moleculelist) {
        this.moleculelist = moleculelist;
        this.svgContent = ''; // Placeholder for SVG content
        this.sites = [];
        this.index = index;
        this.position = { x: 100, y: 100 + 100 * this.index};
        this.molecule = monomer;
        // console.log(this.molecule);
        
        // find the allowed states for this reaction
        // for (const pattern in this.rp) {
        //     console.log(this.rp[pattern].Molecules);
        // }


        if (!this.svgContent) {
            this.svgContent = await fetchSvgContent(this.svgFilePath);
        }

        if (this.svgContent) {
            const groupElement = SVG().group()
                .addTo(this.svgContainer);

                groupElement.transform({translate: this.position});

            const svgDoc = SVG()
                .svg(this.svgContent)
                .addTo(groupElement);
            
            const moleculeElement = svgDoc.first();
            const width = moleculeElement.width();
            const height = moleculeElement.height();
            const numSites = this.molecule.sites.length;

            // Calculate position for initial site
            const relativePosition = {
                // assumes mrna=0 and ribo=1 in model
                x: (this.index * width / 2),
                y: height / 2 
            };
            this.sites.push(new SiteRepresentation(groupElement, this, this.molecule.sites[0], relativePosition)); 
        } 
        else {
            console.error("SVG content is empty.");
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
