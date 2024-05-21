import { SVG } from './lib/svg.esm.js';
import { Model, Monomer, Parameter, Rule, InitialCondition } from './model.js';
import { fetchSvgContent } from './utils/fetchSvgContent.js';

export class Representation {
    constructor(svgContainer) {
        this.svgContainer = svgContainer;
    }
}

export class CreateSVGMolecules {
    // create the SVG representation of the molecules including site and pass those groups around
    constructor(svgFilePath, monomer, index, svgContent) {
        this.svgContent = svgContent;
        this.svgFilePath = svgFilePath;
        this.molecule = monomer;
        this.index = index;
    }

    CreateMoleculeGroups(position) {
        this.position = position;
        const groupElement = '';
        
        if (this.svgContent) {
            // const drawContext = SVG().addTo(this.svgContainer);
            const drawContext = SVG();
            const groupElement = drawContext.group();
            groupElement.svg(this.svgContent);
            groupElement.y(this.position.y);
            
            const moleculeElement = groupElement.first();
            const numSites = this.molecule.sites.length;

            if (numSites == 1) {
                var spacing = moleculeElement.width() / 2; 
            }
            else (spacing = moleculeElement.width() / (numSites + 1));
            
            SVG().text(this.molecule.name)
                .cx(this.position.x)
                .cy(this.position.y)
                .attr("text-anchor", "left")
                .fill("black")
                .addTo(groupElement);

            this.molecule.sites.forEach((site, index) => {
                const relativePosition = {
                    x: (index + 1) * spacing,
                    y: this.position.y + moleculeElement.height() / 2
                };
                SVG().circle()
                    // .center(relativePosition.x, relativePosition.y)
                    .cx(relativePosition.x)
                    .cy(relativePosition.y)
                    .radius(5)
                    .fill("green")
                    .id(site)
                    .addTo(groupElement);

                SVG().text(site)
                    .move(relativePosition.x, relativePosition.y)
                    .attr("text-anchor", "middle")
                    .fill("green")
                    .id(site)
                    .addTo(groupElement);
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

    async visualizeBonds(position) {
        this.position = position;
        // console.log(this.svgGroups);
        // for (let i = 0; i < this.interactome.interactorMols.length; i++) {
        //     const interactingMol = this.interactome.interactorMols[i];
        //     if (interactingMol != null) {
        //         const interactingMolComp = this.interactome.interactorIds[i];
        //         const svgFilePath = this.constructSvgFilePath(interactingMol);
        //         const interactingSite = this.interactome.interactorSites[i];
                
        //         if (!this.svgContent) {
        //             this.svgContent = await fetchSvgContent(svgFilePath);
        //         }
                
        //         if (this.svgContent) {
        //             var drawContext = SVG().addTo(this.svgContainer);
        //             var groupElement = drawContext.group();
        //             groupElement.svg(this.svgContent);
        //             groupElement.transform({translate: this.position});

        //             SVG().text(interactingSite)
        //                 .center(this.position.x - groupElement.width()/2, groupElement.height() / 2)
        //                 .attr("text-anchor", "middle")
        //                 .fill("green")
        //                 .addTo(groupElement);

        //             const stateText = this.checkResultantStates(interactingMolComp, this.rule.product_states);
        //             if (stateText != null){
        //                 const textElement = SVG().text(stateText)
        //                     .x(0)
        //                     .y(groupElement.height() / 2)
        //                     .attr({ "text-anchor": "end", "fill": "black" })
        //                     .addTo(groupElement);
        //             }
        //         // console.log(i, this.interactome, interactingSite, interactingMolComp, svgFilePath);
        //         this.svgContent = '';
        //         // debugger;
                // }
        // }
                // use SVG to transform the sites (and associated things) onto each other
                // for any M_Cs that don't form bonds (==0 in product_num_bonds), check if they have states information
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
