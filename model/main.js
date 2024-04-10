import { SVG } from './lib/svg.esm.js';
import { Model, Monomer, Parameter, Rule, InitialCondition } from './model.js';
import { MoleculeRepresentation, SiteRepresentation } from './representation.js';
import { xmlToObject } from './utils/xmlToObject.js';

async function fetchAndProcessXML(url) {
    try {
        console.log('Fetching XML data from:', url);
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Network response was not ok: ${response.statusText}`);
        }
        const xmlText = await response.text();
        return xmlToObject(xmlText);
    } catch (error) {
        console.error('There was a problem with your fetch operation:', error);
    }
}


function createModelFromJson(jsonData) {
    const model = new Model("mrna_3_codon_translation_model");

    // Add Parameters
    Object.entries(jsonData.Parameters).forEach(([name, param]) => {
        model.addParameter(new Parameter(name, parseFloat(param.value)));
    });

    // Add MoleculeTypes as Monomers with States
    Object.entries(jsonData.MoleculeTypes).forEach(([name, molecule]) => {
        const sites = Object.keys(molecule.ComponentTypes);
        const states = {}; // A new object to hold states for each site

        // Loop through ComponentTypes to populate states
        Object.entries(molecule.ComponentTypes).forEach(([siteName, component]) => {
            if (component.AllowedStates) {
                states[siteName] = Object.keys(component.AllowedStates);
            } else {
                states[siteName] = []; // No states defined for this site
            }
        });

        const monomer = new Monomer(name, sites, states);
        model.addMonomer(monomer);
    });

    // Add Species as InitialConditions
    Object.entries(jsonData.Species).forEach(([speciesId, species]) => {
        model.addInitialCondition(new InitialCondition(species.name, parseFloat(species.concentration)));
    });

    // Simplified example of adding ReactionRules as Rules
    // Note: This does not fully parse the complex structure of ReactionRules
    // It's simplified for illustration purposes
    Object.entries(jsonData.ReactionRules).forEach(([ruleId, rule]) => {
        const rate = rule.RR1_RateLaw ? parseFloat(rule.RR1_RateLaw.totalrate) : 0;
        // Placeholder reactants and products string construction
        const reactants = "Placeholder";
        const products = "Placeholder";
        model.addRule(new Rule(rule.name, reactants, products, rate));
    });

    return model;
}

function constructSvgFilePath(moleculeName, baseDirectory = "path/to/svgs/") {
    return `${baseDirectory}${moleculeName}.svg`;
}


function addSVGContainer() {
    const svgContainer = SVG()
        .addTo('body')
        .size(600, 600)
        .css('border', '1px solid lightgray')
        .attr('id', 'modelVisualization');
    svgContainer
        .text('Molecule, Site, State Visualizer')
        .move(svgContainer.width() / 2, 20)
        .font({ size: 20, anchor: 'middle' });

    const svgContainer2 = SVG()
        .addTo('body')
        .size(600, 600)
        .css('border', '1px solid lightgray')
        .css('margin-left', '50px')
        .attr('id', 'ruleVisualization');
    svgContainer2
        .text('Rule Visualizer')
        .move(svgContainer2.width() / 2, 20)
        .font({ size: 20, anchor: 'middle' });
}


function createMoleculeRepresentation(monomer, index) {
    const svgContainer = document.getElementById("modelVisualization");
    const svgFilePath = constructSvgFilePath(monomer.name, "./svg/");
    const moleculeRep = new MoleculeRepresentation(svgContainer, monomer, svgFilePath);
    moleculeRep.visualize({ x: 100, y: 100 + 100 * index });
    return moleculeRep;
}


async function main() {
    const xmlUrl = './model_xml/mrna_3_codon_translation_model.xml';
    const jsonData = await fetchAndProcessXML(xmlUrl);
    const model = await createModelFromJson(jsonData);
    addSVGContainer();
    const moleculeReps = model.monomers.map(
        (monomer, index) => createMoleculeRepresentation(monomer, index));
}

main();

/* // Create model instances
const myModel = new Model("Example Model");
const monomerA = new Monomer("A", ["siteA1", "siteA2"]);
const monomerB = new Monomer("B", ["siteB1", "siteB2"]);
myModel.monomers.push([monomerA, monomerB]);
myModel.parameters.push(new Parameter("kf", 1e-5));
myModel.rules.push(new Rule("binding", ["A", "B"], ["AB"], "kf"));
myModel.initialConditions.push(new InitialCondition("A", 100));
myModel.initialConditions.push(new InitialCondition("B", 100));

// Visualize the model
const moleculeRepA = new MoleculeRepresentation(svgContainer, monomerA);
const moleculeRepB = new MoleculeRepresentation(svgContainer, monomerB);
moleculeRepA.visualize({ x: 100, y: 50 });
moleculeRepB.visualize({ x: 200, y: 50 });

// Directly add sites with their relative positions
moleculeRepA.addSite(monomerA.sites[0], { x: -15, y: -15 });
moleculeRepA.addSite(monomerA.sites[1], { x: 15, y: -15 });
moleculeRepB.addSite(monomerB.sites[0], { x: -15, y: -15 });
moleculeRepB.addSite(monomerB.sites[1], { x: 15, y: -15 });

// Move the molecule and observe the sites moving with it
setTimeout(() => {
    moleculeRepA.move({ x: 50, y: 100 });
    moleculeRepB.move({ x: -50, y: 100 });
}, 2000); */