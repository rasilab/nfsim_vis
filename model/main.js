import { SVG } from './lib/svg.esm.js';
import { Model, Monomer, Parameter, Rule, InitialCondition } from './model.js';
import { MoleculeRepresentation, CreateSVGMolecules, DefineBonds, CreateSVGModelMolecules} from './representation.js';
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

        const operations = {};
        Object.entries(rule.Operations).forEach(([index, operation]) => {
            operations[index] = operation;
        });
    
        const reactant_patterns = [];
        const reactant_mol = {};
        const reactant_mol_components = {};
        const reactant_num_bonds = {};

        Object.entries(rule.ReactantPatterns).forEach(([reactant_pattern, reactant_pattern_array]) => {
            const rp = reactant_pattern.split("_")[1];
            reactant_patterns.push(rp);
            Object.entries(reactant_pattern_array.Molecules).forEach(([molecule, molecule_array]) => {
                // const mol = [molecule.split("_")[1], molecule.split("_")[2]].join("_");
                const mol = molecule;
                reactant_mol[mol] = molecule_array.name;
                Object.entries(molecule_array.Components).forEach(([component, component_array]) => {
                    // const mol_comp = [component.split("_")[1], component.split("_")[2], component.split("_")[3]].join("_")
                    const mol_comp = component;
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
                // const mol = [molecule.split("_")[1], molecule.split("_")[2]].join("_");
                const mol = molecule;
                product_mol[mol] = molecule_array.name;
                Object.entries(molecule_array.Components).forEach(([component, component_array]) => {
                    // const mol_comp = [component.split("_")[1], component.split("_")[2], component.split("_")[3]].join("_")
                    const mol_comp = component;
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
                    // const val = [value.split("_")[1], value.split("_")[2], value.split("_")[3]].join("_")
                    const val = value;
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
            product_bonds, product_states, rate, rateConst, operations));
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

    const svgContainer3 = SVG()
        .addTo('body')
        .size(600, 600)
        .css('border', '1px solid lightgray')
        .css('margin-left', '50px')
        .attr('id', 'simulationVisualization');
    svgContainer3
        .text('Simulation Visualizer')
        .move(svgContainer3.width() / 2, 20)
        .font({ size: 20, anchor: 'middle' });
}


function createMoleculeRepresentation(monomer, index, svgBasePath = "./svg/") {
    const svgContainer = document.getElementById("modelVisualization");
    const svgFilePath = constructSvgFilePath(monomer.name, svgBasePath);
    const moleculeRep = new MoleculeRepresentation(svgContainer, monomer, svgFilePath);
    moleculeRep.visualize({ x: 100, y: 100 + 100 * index });
    return moleculeRep;
}

async function createMoleculeModelGroups(monomer, index, svgBasePath = "./svg/") {
    const svgFilePath = constructSvgFilePath(monomer.name, svgBasePath);
    const svgContent = await fetchSvgContent(svgFilePath);
    const svgMolecules = new CreateSVGModelMolecules(monomer, index, svgContent);
    const group = svgMolecules.CreateModelMoleculeGroups();
    return group;
}

async function createMoleculeGroups(monomer, simulation, userInput, svgBasePath = "./svg/") {
    const svgFilePath = constructSvgFilePath(monomer.name, svgBasePath);
    const svgContent = await fetchSvgContent(svgFilePath);
    const svgMolecules = new CreateSVGMolecules(monomer, simulation, userInput, svgContent);
    const group = svgMolecules.CreateSVGMoleculeGroups();
    return group;
}

function defineBondsFromReactionRules(reactionRules) {
    const interactomeByRule = [];
    for (let rule of reactionRules) {
        const defineBonds = new DefineBonds(rule);
        defineBonds.BondInteractors(rule.product_mol, rule.product_mol_components, rule.product_bonds);
        defineBonds.Reactants(rule.reactant_mol, rule.reactant_mol_components);
        interactomeByRule.push(defineBonds);
    }
    return interactomeByRule;
}

function getIndexByKeyValue(inputList, key, value) {
    for (let i = 0; i < inputList.length; i++) {
        if (inputList[i][key] === value) {
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

function animateSVG(movingGroup, movingSiteGroup, duration, x1, y1, x2, y2) {
    return new Promise(resolve => {
        let mx, my, newX, newY;
        movingGroup.animate(duration).during(function(pos) {
            // Interpolate the x and y coordinates
            mx = x1 + (x2 - x1) * pos;
            my = y1 + (y2 - y1) * pos;
            movingGroup.transform({translate: {x: mx - movingSiteGroup.cx(), y: my - movingSiteGroup.cy()}});
        }).after(() => {
            newX = movingGroup.x();
            newY = movingGroup.y();
            resolve([newX, newY]);
        });
    });
}

function animateSVGTermination(movingGroup, duration, x1, y1, x2, y2) {
    return new Promise(resolve => {
        let mx, my;
        movingGroup.animate(duration).during(function(pos) {
            mx = x1 + (x2 - x1) * pos;
            my = y1 + (y2 - y1) * pos;
            movingGroup.transform({translate: {x: mx - movingGroup.bbox().x, y: my - movingGroup.bbox().y}});
        })
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
    const containerWidth = svgContainer.getBoundingClientRect().width;
    const containerHeight = svgContainer.getBoundingClientRect().height;
    const stayingPos = {x: (containerWidth / 2) - (stayingGroup.width()/2), y: (containerHeight / 2) - (stayingGroup.height()/2)};
    const movingPos = {x: (containerWidth / 4) - (movingGroup.width()/2), y: (containerHeight / 4) - (movingGroup.height()/2)};
    
    movingGroup.addTo(svgContainer);
    stayingGroup.addTo(svgContainer);
    movingGroup.transform({translate: movingPos});
    stayingGroup.transform({translate: stayingPos});
    
    //there should be as many definedBonds as there are reactionRules
    //definedBonds just may make it a bit easier to extract info from
    for (let index = 0; index < reactionRules.length; index++) {
        const rule = reactionRules[index];
        const thisBond = definedBonds[index];
        if (thisBond.interactorMols.length === 1) {
            if (thisBond.interactorMols[0] === undefined || thisBond.interactorMols[0] === null) {
                const x1 = movingGroup.transform().translateX;
                const y1 = movingGroup.transform().translateY;
                const x2 = movingGroup.transform().translateX + 50; 
                const y2 = movingGroup.transform().translateY - 50; 
                const distance = Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
                const duration = distance * 20; 
                animateSVGTermination(movingGroup, duration, x1, y1, x2, y2);
            }
        }
        else {
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
            
            const distance = Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
            const duration = distance * 20; // increase number to increase how long it takes to move
            const result = await animateSVG(movingGroup, movingSiteGroup, duration, x1, y1, x2, y2);
        }
    }
}

function getTypeIdFromMolName(moleculeTypes, molName) {
    for (let i = 0; i < moleculeTypes.length; i++) {
        if (moleculeTypes[i].name === molName) {
            return moleculeTypes[i].typeID;
        }
    }
}

function getSVGListByTypeId(svgGroupsList, typeId) {
    for (let i = 0; i < svgGroupsList.length; i++) {
        for (let key in svgGroupsList[i]) {
            if (key === typeId.toString()) {
                return svgGroupsList[i][key];
            }
        }
    }
}

function getValueByKey(obj, key) {
    if (obj.hasOwnProperty(key)) {
        return obj[key];
    }
}

function getRuleOpsByPropsName(modelRules, ruleName) {
    for (let i = 0; i < modelRules.length; i++) {
        if (modelRules[i].name === ruleName) {
            return modelRules[i].operations;
        }
    }
}

function getRuleByPropsName(modelRules, ruleName) {
    for (let i = 0; i < modelRules.length; i++) {
        if (modelRules[i].name === ruleName) {
            return modelRules[i];
        }
    }
}

function getAddBondOp(ops) {
    for (let i = 0; i < ops.length; i++) {
        if (ops[i][0] === "AddBond") {
            return ops[i].slice(1);
        }
    }
}

function getDeleteBondOp(ops) {
    for (let i = 0; i < ops.length; i++) {
        if (ops[i][0] === "DeleteBond") {
            return ops[i].slice(1);
        }
    }
}

function getAddBondRuleOp(ruleOps) {
    const sites = [];
    Object.entries(ruleOps).forEach(([key, value]) => {
        if (value.type === "AddBond") {
            sites.push(value['site1'], value['site2']);
        }
    });
    return sites;
}

function getIndexByValue(list, value) {
    for (let i = 0; i < list.length; i++) {
        if (list[i] === value) {
            return i;
        }
    }
}

function getBondByName(ruleName, definedBonds) {
    for (let i = 0; i < definedBonds.length; i++) {
        if (definedBonds[i].name === ruleName) {
            return definedBonds[i];
        }
    }
}

async function iterateAndVisualizeSimulationFirings(modelRules, definedBonds, svgGroupsList, firings, moleculeTypes, userInput) {
    const svgContainer = document.getElementById("simulationVisualization");
    const whichMoving = getIndexByKeyValue(userInput, 'type', 'movingGroup');
    const movingMolName = userInput[whichMoving]['name']; // assumes only one value provided here
    const movingMolTypeId = getTypeIdFromMolName(moleculeTypes, movingMolName);
    const whichStaying = getIndexByKeyValue(userInput, 'type', 'stayingGroup');
    const stayingMolName = userInput[whichStaying]['name']; // assumes only one value provided here
    const stayingMolTypeId = getTypeIdFromMolName(moleculeTypes, stayingMolName);
    const movingGroup = getSVGListByTypeId(svgGroupsList, movingMolTypeId);
    const stayingGroup = getSVGListByTypeId(svgGroupsList, stayingMolTypeId);
    const containerWidth = svgContainer.getBoundingClientRect().width;
    const containerHeight = svgContainer.getBoundingClientRect().height;

    var position;
    // center the staying group to the container
    for (let i = 0; i < stayingGroup.length; i++) {
        position = {x: (containerWidth / 2) - (stayingGroup[i].width()/2), y: (containerHeight / 2) - (stayingGroup[i].height()/2)};
        stayingGroup[i].addTo(svgContainer);
        stayingGroup[i].transform({translate: position});
    }

    // set the stack of moving groups somewhere in the corner or to the side
    for (let i = 0; i < movingGroup.length; i++) {
        movingGroup[i].addTo(svgContainer);
        position = {x: (containerWidth / 4) - (movingGroup[i].width()/2), y: (containerHeight / 4) - (movingGroup[i].height()/2)};
        movingGroup[i].transform({translate: position});
    }
    
    for (let index = 0; index < firings.length; index++) {
        const firing = firings[index];
        const props = getValueByKey(firing, 'props');
        const ops = getValueByKey(firing, 'ops');
        const ruleName = props[0];
        const thisBond = getBondByName(ruleName, definedBonds);
        const ruleOps = getRuleOpsByPropsName(modelRules, ruleName);
        const rule = getRuleByPropsName(modelRules, ruleName);
        const addBond = getAddBondOp(ops); // for viz purposes, I think this is the only one I need
        const addBondRule = getAddBondRuleOp(ruleOps);
        const idxMove = getIndexByValue(thisBond.reactorMols, movingMolName);
        const idxStay = getIndexByValue(thisBond.reactorMols, stayingMolName);
        if (addBond === undefined) {
            const deleteBond = getDeleteBondOp(ops);
            const movingMolNum = deleteBond[idxMove];
            const moveSVGName = movingMolName + "_" + movingMolNum;
            const movingGroup_i = getSVGByName(movingGroup, moveSVGName);
            const x1 = movingGroup_i.transform().translateX;
            const y1 = movingGroup_i.transform().translateY;
            const x2 = movingGroup_i.transform().translateX + 100; 
            const y2 = movingGroup_i.transform().translateY - 100; 
            const distance = Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
            const duration = distance * 5; 
            animateSVGTermination(movingGroup_i, duration, x1, y1, x2, y2);
            
        }
        else {
            const movingMolNum = addBond[idxMove];
            const stayingMolNum = addBond[idxStay + 1];
            const movingSiteName = getSiteByMolecule(movingMolName, thisBond.interactorMols, thisBond.interactorSites);
            const stayingSiteName = getSiteByMolecule(stayingMolName, thisBond.interactorMols, thisBond.interactorSites);
            const moveSVGName = movingMolName + "_" + movingMolNum;
            const staySVGName = stayingMolName + "_" + stayingMolNum;
            const movingGroup_i = getSVGByName(movingGroup, moveSVGName);
            const moveFromSVGSites = movingGroup_i.find('circle'); // will get list of all the sites which are circles
            const movingSiteGroup = getSVGByName(moveFromSVGSites, movingSiteName);
            const x1 = movingSiteGroup.cx() + movingGroup_i.transform().translateX;
            const y1 = movingSiteGroup.cy() + movingGroup_i.transform().translateY;
            const stayingGroup_i = getSVGByName(stayingGroup, staySVGName);
            const moveToSVGSites = stayingGroup_i.find('circle');
            const stayingSiteGroup = getSVGByName(moveToSVGSites, stayingSiteName);
            const x2 = stayingSiteGroup.cx() + stayingGroup_i.transform().translateX;
            const y2 = stayingSiteGroup.cy() + stayingGroup_i.transform().translateY;
            
            const distance = Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
            const duration = distance * 5; // increase number to increase how long it takes to move
            
            const result = await animateSVG(movingGroup_i, movingSiteGroup, duration, x1, y1, x2, y2);
        }
    }
}


async function main() {
    const xmlUrl = './model_xml/model.xml';
    const svgBasePath = "./svg/";
    const jsonData = await fetchAndProcessXML(xmlUrl);
    const model = await createModelFromJson(jsonData);
    const definedBonds = defineBondsFromReactionRules(model.rules);
    const userInput = await fetch("./model_xml/user_input.json").then(response => response.json());
    const simulation = await fetch("./model_xml/model.json").then(response => response.json());
    const firings = simulation["simulation"]["firings"];
    const moleculeTypes = simulation["simulation"]["molecule_types"];
    addSVGContainer();

    const moleculeReps = model.monomers.map(
        (monomer, index) => createMoleculeRepresentation(monomer, index, svgBasePath));
    
    const promisesModel = model.monomers.map(async (monomer, index) => {
        return await createMoleculeModelGroups(monomer, index, svgBasePath); 
    });
    const svgMoleculeGroupsModel =  await Promise.all(promisesModel);
    iterateAndVisualizeReactionRules(model.rules, svgMoleculeGroupsModel, definedBonds, userInput);

    const promises = model.monomers.map(async (monomer) => {
        return await createMoleculeGroups(monomer, simulation, userInput, svgBasePath); 
    });
    const svgMoleculeGroups = await Promise.all(promises);
    iterateAndVisualizeSimulationFirings(model.rules, definedBonds, svgMoleculeGroups, firings, moleculeTypes, userInput);
    
}

main();