import { SVG } from './lib/svg.esm.js';
import { fetchSvgContent } from './utils/fetchSvgContent.js';

export class Representation {
    constructor(svgContainer) {
        this.svgContainer = svgContainer;
    }
}

export class CreateSVGMolecules extends Representation {
    // create the SVG representation of the molecules including site and pass those groups around
    constructor(svgContainer, monomer, simulation, userInput, svgContent) {
        super(svgContainer);
        this.svgContent = svgContent;
        this.molecule = monomer;
        this.simulation = simulation;
        this.userInput = userInput;
        this.sites = [];
    }

    getTypeIdFromMolName(moleculeTypes, molName) {
        for (let i = 0; i < moleculeTypes.length; i++) {
            if (moleculeTypes[i].name === molName) {
                return moleculeTypes[i].typeID;
            }
        }
    }

    getSomethingByName(simulationJSON, value) {
        const array = {};
        for (let i = 0; i < simulationJSON.length; i++) {
            if (simulationJSON[i].name === value) {
                const typeID = simulationJSON[i].typeID;
                array[typeID] = value;
            }
        }
        return array;
    }
    
    getNumParticlesByTypeID(initialState, typeID) {
        const numbers = [];
        var start = 0;
        var add = 0;
        // console.log("type=", typeID);
        for (let i = 0; i < initialState.length; i++) {
            // console.log(initialState[i], "next start=", start);
            if (initialState[i][0] == typeID) {
                const end = initialState[i][1];
                var iter = 0;
                for (let j = start; j < start + end; j++) {
                    // console.log("j=", j);
                    numbers.push(j);
                    iter += 1;
                }
            }
            add = initialState[i][1];
            start += add;
            // console.log("after add", start);
        }
        return numbers;
    }

    getIndexbyTypeId(initialState, typeID) {
        for (let i = 0; i < initialState.length; i++) {
            if (initialState[i][0] == typeID) {
                return i;
            }
        }
    }

    CreateSVGMoleculeGroups() {
        const containerWidth = this.svgContainer.getBoundingClientRect().width;
        const containerHeight = this.svgContainer.getBoundingClientRect().height;
        const initialState = this.simulation["simulation"]["initialState"]["molecule_array"];
        const moleculeTypes = this.simulation["simulation"]["molecule_types"];
        const molArray = this.getSomethingByName(moleculeTypes, this.molecule.name);
        const molTypeId = this.getTypeIdFromMolName(moleculeTypes, this.molecule.name);
        const numInitialParticles = this.getNumParticlesByTypeID(initialState, molTypeId);
        // const startNamingIndex = this.getIndexbyTypeId(initialState, molTypeId);
        // const endNamingIndex = startNamingIndex + numInitialParticles;

        if (this.svgContent) {
            const groupElements = [];
            // for (let i = startNamingIndex; i < endNamingIndex; i++) {
            for (let i of numInitialParticles) {
                
                const groupElement = SVG().group(); // create a SVG group from the fetched SVG content
                groupElement.svg(this.svgContent);
                
                const moleculeElement = groupElement.first(); // use .first() because size will change as elements are added to group
                const numSites = this.molecule.sites.length;

                if (numSites == 1) {
                    var spacing = moleculeElement.width() / 2; 
                }
                else (spacing = moleculeElement.width() / (numSites + 1));
                
                groupElement.text([this.molecule.name, i].join('_'))
                    .attr("text-anchor", "left")
                    .fill("black");
                
                if (this.molecule.sites.length < 10) {

                    this.molecule.sites.forEach((site, index) => {
                        const relativePosition = {
                            x: (index + 1) * spacing,
                            y: moleculeElement.height() / 2
                        };
                        this.sites.push(new SiteRepresentationVisible(groupElement, this, site, relativePosition));
                        });
                    }
                else {
                    this.molecule.sites.forEach((site, index) => {
                        const relativePosition = {
                            x: (index + 1) * spacing,
                            y: moleculeElement.height() / 2
                        };
                        this.sites.push(new SiteRepresentationInvisible(groupElement, this, site, relativePosition));
                        });
                }

                const svgMolId = [this.molecule.name, i].join('_');
                groupElement.id(svgMolId);

                groupElements.push(groupElement);
            }
            const typeIdGroupsArr = {}
            typeIdGroupsArr[molTypeId] = groupElements;
            return typeIdGroupsArr;
            }
            else {
                console.error("SVG content is empty.");
            }
    }
}

export class CreateSVGModelMolecules extends Representation{
    constructor(svgContainer, monomer, index, svgContent) {
        super(svgContainer);
        this.svgContent = svgContent;
        this.molecule = monomer;
        this.index = index;
        this.sites = [];
    }

    CreateModelMoleculeGroups() {
        const containerWidth = this.svgContainer.getBoundingClientRect().width;
        const containerHeight = this.svgContainer.getBoundingClientRect().height;
        
        if (this.svgContent) {
            const groupElement = SVG().group();
            groupElement.svg(this.svgContent);
            
            // // resize group element based on container size
            // const aspectRatio = groupElement.width() / groupElement.height();
            // const newWidth = containerWidth * 0.1;
            // const newHeight = newWidth / aspectRatio;
            // const scale = newWidth / groupElement.width();
            // groupElement.style.transform = "translate(" + 0 + "px," + 0 + "px) scale(" + scale + ")";

            const moleculeElement = groupElement.first();
            const numSites = this.molecule.sites.length;

            if (numSites == 1) {
                var spacing = moleculeElement.width() / 2; 
            }
            else (spacing = moleculeElement.width() / (numSites + 1));
            
            groupElement.text(this.molecule.name)
                .attr("text-anchor", "left")
                .fill("black");

            if (this.molecule.sites.length < 10) {
                this.molecule.sites.forEach((site, index) => {
                    const relativePosition = {
                        x: (index + 1) * spacing,
                        y: moleculeElement.height() / 2
                    };
                    this.sites.push(new SiteRepresentationVisible(groupElement, this, site, relativePosition));
                    });
            }
            else {
                this.molecule.sites.forEach((site, index) => {
                    const relativePosition = {
                        x: (index + 1) * spacing,
                        y: moleculeElement.height() / 2
                    };
                    this.sites.push(new SiteRepresentationInvisible(groupElement, this, site, relativePosition));
                    });
            }
            
            groupElement.id(this.molecule.name);

            return groupElement;
            }
            else {
                console.error("SVG content is empty.");
            }
        }
}

export class DefineBonds {
    constructor(rule) {
        this.name = rule.name;
        this.interactorIds = [];
        this.interactorMols = [];
        this.interactorSites = [];
        this.reactorIds = [];
        this.reactorMols = [];
        this.reactorSites = [];
        this.operations = rule.operations;
    }

    // right now, they are 'linked' by indice, so it may be good to consider null conditions
    BondInteractors(productMol, productMolComponents, productBonds) {
        for (let i = 0; i < Object.keys(productBonds).length; i++) {
            const interactor = Object.entries(productBonds)[i][1]; // 0 is just the word 'site'
            const interactingMol = productMol[[interactor?.split('_')[0], interactor?.split('_')[1], interactor?.split('_')[2]].join('_')];
            const interactingSite = productMolComponents[interactor];
            this.interactorIds.push(interactor);
            this.interactorMols.push(interactingMol);
            this.interactorSites.push(interactingSite);
            }
        }

    Reactants(reactantMol, reactantMolComponents) {
        for (let i = 0; i < Object.keys(reactantMol).length; i++) {
            const interactor = Object.entries(reactantMolComponents)[i][0];
            const interactingMol = Object.entries(reactantMol)[i][1];
            const interactingSite = Object.entries(reactantMolComponents)[i][1];
            this.reactorIds.push(interactor);
            this.reactorMols.push(interactingMol);
            this.reactorSites.push(interactingSite);
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
    // for the molecule, site, and state initial visualization
    constructor(svgContainer, molecule, svgFilePath) {
        super(svgContainer);
        this.molecule = molecule;
        this.sites = []; // Stores SiteRepresentation instances
        this.svgContent = ''; // Placeholder for SVG content
        this.svgFilePath = svgFilePath;
    }

    async visualize(position = { x: 0, y: 0 }) {
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

            if (this.molecule.sites.length < 10) {
                this.molecule.sites.forEach((site, index) => {
                    // Calculate position for each site
                    const relativePosition = {
                        x: (index + 1) * spacing, // +1 so we don't start at 0,
                        y: moleculeElement.height() / 2 // Center vertically
                    };
                    this.sites.push(new SiteRepresentationInitial(groupElement, this, site, relativePosition));
                });
            }
        } else {
            console.error("SVG content is empty.");
        }
    }
}

class SiteRepresentationInitial extends Representation {
    // for the molecule, site, and state initial visualization
    constructor(svgContainer, moleculeRep, site, relativePosition = { x: 0, y: 0 }) {
        super(svgContainer);
        this.moleculeRep = moleculeRep;
        this.site = site;
        this.relativePosition = relativePosition;
        this.siteElement = SVG().group().addTo(this.svgContainer);

        SVG().circle()
            .cx(relativePosition.x)
            .cy(relativePosition.y)
            .radius(5)
            .fill("green")
            .id(this.site)
            .addTo(this.siteElement);

        SVG().text(this.site)
            .x(relativePosition.x)
            .y(relativePosition.y)
            .attr("text-anchor", "middle")
            .fill("green")
            .id(this.site)
            .addTo(this.siteElement);

        let states = this.moleculeRep.molecule.states[site]; // Define your states
        if (states.length > 0) { // Check if states is not empty
            this.stateRepresentation = new StateRepresentation(svgContainer, this.siteElement, this.site, states);
            this.stateRepresentation.startStateSwitching(1000); // Switch state every 1000 milliseconds
        }
    }
}


class SiteRepresentationVisible extends Representation {
    // if there are a reasonable number of sites, render them
    constructor(svgContainer, moleculeRep, site, relativePosition = { x: 0, y: 0 }) {
        super(svgContainer);
        this.moleculeRep = moleculeRep;
        this.site = site;
        this.relativePosition = relativePosition;
        this.siteElement = SVG().group().addTo(this.svgContainer);

        SVG().circle()
            .cx(relativePosition.x)
            .cy(relativePosition.y)
            .radius(5)
            .fill("green")
            .id(this.site)
            .addTo(this.siteElement);

        SVG().text(this.site)
            .x(relativePosition.x)
            .y(relativePosition.y)
            .attr("text-anchor", "middle")
            .fill("green")
            .id(this.site)
            .addTo(this.siteElement);
    }
}

class SiteRepresentationInvisible extends Representation {
    // if there are too many sites, render them invisible
    constructor(svgContainer, moleculeRep, site, relativePosition = { x: 0, y: 0 }) {
        super(svgContainer);
        this.moleculeRep = moleculeRep;
        this.site = site;
        this.relativePosition = relativePosition;
        this.siteElement = SVG().group().addTo(this.svgContainer);

        SVG().circle()
            .cx(relativePosition.x)
            .cy(relativePosition.y)
            .radius(5)
            .fill("green")
            .id(this.site)
            .attr('opacity', 0)
            .addTo(this.siteElement);

        SVG().text(this.site)
            .x(relativePosition.x)
            .y(relativePosition.y)
            .attr("text-anchor", "middle")
            .fill("green")
            .id(this.site)
            .attr('opacity', 0)
            .addTo(this.siteElement);
    }
}

class StateRepresentation extends Representation {
    constructor(svgContainer, siteElement, site, states = []) {
        super(svgContainer);
        this.siteElement = siteElement;
        this.states = states;
        this.stateIndex = 0;
        this.stateColors = ['red', 'blue', 'green'];
        this.site = site;
        this.setState(this.states[this.stateIndex]);
    }

    getSVGByName(svgGroupsList, name) {
        for (let i = 0; i < svgGroupsList.length; i++) {
            if (svgGroupsList[i].node.id === name) {
                return svgGroupsList[i];
            }
        }
    }

    setState(state) {
        this.state = state;
        const circleElement = this.getSVGByName(this.siteElement.children(), this.site);
        const textElement = SVG().text(state)
            .attr({"text-anchor": "middle", fill: this.stateColors[this.stateIndex], id: 'state'})
            .center(circleElement.attr("cx"), parseInt(circleElement.attr("cy")) + 20)
            .addTo(this.siteElement);
    }

    startStateSwitching(interval = 1000) {
        setInterval(() => {
            this.stateIndex = (this.stateIndex + 1) % this.states.length;
            const textElement = this.siteElement.findOne('#state');
            const circleElement = this.getSVGByName(this.siteElement.children(), this.site);
            circleElement.attr("fill", this.stateColors[this.stateIndex]);
            textElement.attr("fill", this.stateColors[this.stateIndex])
                .text(this.states[this.stateIndex]);
        }, interval);
    }
}
