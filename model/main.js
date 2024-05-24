import { SVG } from './lib/svg.esm.js';
import { Model, Monomer, Parameter, Rule, InitialCondition } from './model.js';
import { MoleculeRepresentation, CreateSVGMolecules, DefineBonds, VisualizeRules } from './representation.js';
import { xmlToObject } from './utils/xmlToObject.js';
import { fetchSvgContent } from './utils/fetchSvgContent.js';


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
    const model = new Model("model");

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

    // Should I be parsing the whole model? Does this get redundant?
    // Note I have not done anything with 'state' (free/blocked) that some reactant/product pattern components have
    // Note that sometimes different reacting molecules (in ReactantPatterns) both have their info stored as "M1" and "C1"
    // which gets overwritten with the current menthod, but ProductPatterns should be unique in that regard
    Object.entries(jsonData.ReactionRules).forEach(([ruleId, rule]) => {
        const rate = rule.RR1_RateLaw ? parseFloat(rule.RR1_RateLaw.totalrate) : 0;

        const rate_name = ruleId + "_RateLaw";
        const rate_law = rule[rate_name];
        if ('RateConstants' in rate_law) {
            var rateConstant = rate_law.RateConstants.RateConstant.value;
        } else {
            var rateConstant = 'initial'; // is this generally true? no defined rate constant = initiate?
        }
        const rateConst = rateConstant.toString();
    
        const reactant_patterns = [];
        const reactant_mol = {};
        const reactant_mol_components = {};
        const reactant_num_bonds = {};

        Object.entries(rule.ReactantPatterns).forEach(([reactant_pattern, reactant_pattern_array]) => {
            const rp = reactant_pattern.split("_")[1];
            reactant_patterns.push(rp);
            Object.entries(reactant_pattern_array.Molecules).forEach(([molecule, molecule_array]) => {
                const mol = [molecule.split("_")[1], molecule.split("_")[2]].join("_");
                reactant_mol[mol] = molecule_array.name;
                Object.entries(molecule_array.Components).forEach(([component, component_array]) => {
                    const mol_comp = [component.split("_")[1], component.split("_")[2], component.split("_")[3]].join("_")
                    reactant_mol_components[mol_comp] = component_array.name;
                    reactant_num_bonds[mol_comp] = component_array.numberOfBonds;
                });
            });
        });

        const product_patterns = [];
        const product_mol = {};
        const product_mol_components = {};
        const product_num_bonds = {};
        const product_bonds = {};
        const product_states = {};

        Object.entries(rule.ProductPatterns).forEach(([product_pattern, product_pattern_array]) => {
            const pp = product_pattern.split("_")[1];
            product_patterns.push(pp);
            Object.entries(product_pattern_array.Molecules).forEach(([molecule, molecule_array]) => {
                const mol = [molecule.split("_")[1], molecule.split("_")[2]].join("_");
                product_mol[mol] = molecule_array.name;
                Object.entries(molecule_array.Components).forEach(([component, component_array]) => {
                    const mol_comp = [component.split("_")[1], component.split("_")[2], component.split("_")[3]].join("_")
                    product_mol_components[mol_comp] = component_array.name;
                    product_num_bonds[mol_comp] = component_array.numberOfBonds;
                    if (component_array.state) {
                        product_states[mol_comp] = component_array.state;
                    }
                    else {
                        product_states[mol_comp] = null;
                    };
                });
            });

            try {
            Object.entries(product_pattern_array.Bonds).forEach(([bond, bond_array]) => {
                Object.entries(bond_array).forEach(([key, value]) => {
                    const val = [value.split("_")[1], value.split("_")[2], value.split("_")[3]].join("_")
                    product_bonds[key] = val;
                });
            });
            } catch (error) {
                const key = null; 
                const val = null; 
                product_bonds[key] = val;
            }
        });

        model.addRule(new Rule(rule.name, reactant_patterns, reactant_mol, reactant_mol_components, 
            reactant_num_bonds, product_patterns, product_mol, product_mol_components, product_num_bonds, 
            product_bonds, product_states, rate, rateConst));
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


function createMoleculeRepresentation(monomer, index, svgBasePath = "./svg/") {
    const svgContainer = document.getElementById("modelVisualization");
    const svgFilePath = constructSvgFilePath(monomer.name, svgBasePath);
    const moleculeRep = new MoleculeRepresentation(svgContainer, monomer, svgFilePath);
    moleculeRep.visualize({ x: 100, y: 100 + 100 * index });
    return moleculeRep;
}

async function createMoleculeGroups(monomer, index, svgBasePath = "./svg/") {
    const svgFilePath = constructSvgFilePath(monomer.name, svgBasePath);
    const svgContent = await fetchSvgContent(svgFilePath);
    const svgMolecules = new CreateSVGMolecules(monomer, index, svgContent);
    const group = svgMolecules.CreateMoleculeGroups();
    return group;
}

function defineBondsFromReactionRules(reactionRules) {
    const interactomeByRule = [];
    for (let rule of reactionRules) {
        const defineBonds = new DefineBonds();
        defineBonds.bondInteractors(rule.product_mol, rule.product_mol_components, rule.product_bonds);
        interactomeByRule.push(defineBonds);
    }
    return interactomeByRule;
}

function getIndexByKeyValue(userInputList, key, value) {
    for (let i = 0; i < userInputList.length; i++) {
        if (userInputList[i][key] === value) {
            return i;
        }
    }
}

function getSiteByMolecule(moleculeName, interactorMols, interactorSites) {
    for (let i = 0; i < interactorMols.length; i++) {
        if (interactorMols[i] === moleculeName) {
            return interactorSites[i];
        }
    }
    
}

function getSVGByName(svgGroupsList, name) {
    for (let i = 0; i < svgGroupsList.length; i++) {
        if (svgGroupsList[i].node.id === name) {
            return svgGroupsList[i];
        }
    
    }
}

function animateSVG(movingGroup, line, distance, duration, x1, y1, x2, y2) {
    return new Promise(resolve => {
        let mx, my, newX, newY;
        movingGroup.animate(duration).during(function(pos) {
            // Interpolate the x and y coordinates
            mx = x1 + (x2 - x1) * pos;
            my = y1 + (y2 - y1) * pos;
            movingGroup.transform({translate: {x: mx - movingGroup.bbox().cx, y: my - movingGroup.bbox().cy}});
        }).after(() => {
            // newX = mx - movingGroup.bbox().cx;
            // newY = my - movingGroup.bbox().cy;
            // console.log(movingGroup);
            // console.log(mx - movingGroup.bbox().cx, my - movingGroup.bbox().cy);
            newX = movingGroup.x();
            newY = movingGroup.y();
            // console.log(newX, newY);
            resolve([newX, newY]);
        });
    });
}

async function iterateAndVisualizeReactionRules(reactionRules, svgGroupsList, definedBonds, userInput) {
    const whichMoving = getIndexByKeyValue(userInput, 'type', 'movingGroup');
    const movingMolName = userInput[whichMoving]['name']; // assumes only one value provided here
    const whichStaying = getIndexByKeyValue(userInput, 'type', 'stayingGroup');
    const stayingMolName = userInput[whichStaying]['name']; // assumes only one value provided here
    const movingGroup = getSVGByName(svgGroupsList, movingMolName);
    const stayingGroup = getSVGByName(svgGroupsList, stayingMolName);
    
    const svgContainer = document.getElementById("ruleVisualization");
    
    movingGroup.addTo(svgContainer);
    stayingGroup.addTo(svgContainer);
    movingGroup.transform({translate: {x: 50, y: 200}});
    stayingGroup.transform({translate: {x: 50, y: 100}});
    
    //there should be as many definedBonds as there are reactionRules
    //definedBonds just may make it a bit easier to extract info from
    for (let index = 0; index < reactionRules.length; index++) {
        const rule = reactionRules[index];
        const thisBond = definedBonds[index];

        const movingSiteName = getSiteByMolecule(movingMolName, thisBond.interactorMols, thisBond.interactorSites);
        const moveFromSVGSites = movingGroup.find('circle'); // will get list of all the sites which are circles
        const movingSiteGroup = getSVGByName(moveFromSVGSites, movingSiteName);
        const x1 = movingSiteGroup.cx() + movingGroup.transform().translateX;
        const y1 = movingSiteGroup.cy() + movingGroup.transform().translateY;
        const stayingSiteName = getSiteByMolecule(stayingMolName, thisBond.interactorMols, thisBond.interactorSites);
        const moveToSVGSites = stayingGroup.find('circle');
        const stayingSiteGroup = getSVGByName(moveToSVGSites, stayingSiteName);
        const x2 = stayingSiteGroup.cx() + stayingGroup.transform().translateX;
        const y2 = stayingSiteGroup.cy() + stayingGroup.transform().translateY;
        
        const line = SVG().line(x1, y1, x2, y2).stroke({width:1}).addTo(svgContainer);
        const distance = Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
        const duration = distance * 20; // increase number to increase how long it takes to move

        const result = await animateSVG(movingGroup, line, distance, duration, x1, y1, x2, y2);
        let newX = result[0];
        let newY = result[1];
        
        movingGroup
            .x(newX)
            .y(newY);
        // break;
    }
}


async function main() {
    const userInput = await fetch("./model_xml/user_input.json").then(response => response.json());
    const xmlUrl = './model_xml/mrna_3_codon_translation_model.xml';
    const svgBasePath = "./svg/";
    // const xmlUrl = './model_xml/model.xml';
    const jsonData = await fetchAndProcessXML(xmlUrl);
    const model = await createModelFromJson(jsonData);
    const definedBonds = defineBondsFromReactionRules(model.rules);
    addSVGContainer();
    const moleculeReps = model.monomers.map(
        (monomer, index) => createMoleculeRepresentation(monomer, index, svgBasePath));
    const promises = model.monomers.map(async (monomer, index) => {
        return await createMoleculeGroups(monomer, index, svgBasePath); 
    });
    const svgMoleculeGroups = await Promise.all(promises);
    iterateAndVisualizeReactionRules(model.rules, svgMoleculeGroups, definedBonds, userInput);
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