import { SVG } from './lib/svg.esm.js';
import { Model, Monomer, Parameter, Rule, InitialCondition } from './model.js';
import { MoleculeRepresentation, CreateSVGMolecules, CreateSVGModelMolecules} from './representation.js';
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
    const svgContainer = document.getElementById("ruleVisualization");
    const svgFilePath = constructSvgFilePath(monomer.name, svgBasePath);
    const svgContent = await fetchSvgContent(svgFilePath);
    const svgMolecules = new CreateSVGModelMolecules(svgContainer, monomer, index, svgContent);
    const group = svgMolecules.CreateModelMoleculeGroups();
    return group;
}

async function createMoleculeGroups(monomer, simulation, userInput, svgBasePath = "./svg/") {
    const svgContainer = document.getElementById("simulationVisualization");
    const svgFilePath = constructSvgFilePath(monomer.name, svgBasePath);
    const svgContent = await fetchSvgContent(svgFilePath);
    const svgMolecules = new CreateSVGMolecules(svgContainer, monomer, simulation, userInput, svgContent);
    const group = svgMolecules.CreateSVGMoleculeGroups();
    return group;
}

function getIndicesByKeyValue(inputList, key, value) {
    const indices = [];
    for (let i = 0; i < inputList.length; i++) {
        if (inputList[i][key] === value) {
            indices.push(i);
        }
    }
    return indices;
}

function getSVGByName(svgGroupsList, name) {
    const molName = name.split("_")[0];
    for (let i = 0; i < svgGroupsList.length; i++) {
        if (svgGroupsList[i].node.id === molName) {
            return svgGroupsList[i];
        }
    }
}

function getExactSVGByName(svgGroupsList, name) {
    for (let i = 0; i < svgGroupsList.length; i++) {
        if (svgGroupsList[i].node.id === name) {
            return svgGroupsList[i];
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

function getRuleIndexByRuleName(modelRules, ruleName) {
    for (let i = 0; i < modelRules.length; i++) {
        if (modelRules[i].name === ruleName) {
            return i;
        }
    }
}

function animateSVGAddBond(movingGroup, movingSiteGroup, duration, x1, y1, x2, y2) {
    return new Promise(resolve => {
        let mx, my, newX, newY;
        movingGroup.animate(duration).during(function(pos) {
            // Interpolate the x and y coordinates
            mx = x1 + (x2 - x1) * pos;
            my = y1 + (y2 - y1) * pos;
            movingGroup.transform({translate: {x: mx - movingSiteGroup.cx(), y: my - movingSiteGroup.cy()}}).attr('opacity', 1);
        }).after(() => {
            newX = movingGroup.x();
            newY = movingGroup.y();
            resolve([newX, newY]);
        });
    });
}

function animateSVGDeleteBond(movingGroup, duration, x1, y1, x2, y2) {
    return new Promise(resolve => {
        let mx, my;
        movingGroup.animate(duration).during(function(pos) {
            mx = x1 + (x2 - x1) * pos;
            my = y1 + (y2 - y1) * pos;
            movingGroup.transform({translate: {x: mx - movingGroup.bbox().x, y: my - movingGroup.bbox().y}});
        }).after(() => {
        resolve([mx, my]);
        });
    });
}

function animateSVGRestart(movingGroup, duration, initialPos) {
    return new Promise (resolve => {
        let mx, my;
        movingGroup.animate(duration).during(function(pos) {
            mx = movingGroup.transform().translateX + (initialPos.x - movingGroup.transform().translateX) *pos;
            my = movingGroup.transform().translateY + (initialPos.y - movingGroup.transform().translateY) *pos;
            movingGroup.transform({translate: {x: mx, y: my}}).attr('opacity', 1);
        }).after(() => {
            resolve([mx, my]);
        });
    });
}

function getMovingMolNames(userInput) {
    const whichMoving = getIndicesByKeyValue(userInput, 'type', 'movingGroup');
    const movingMolNames = [];
    for (let i = 0; i < whichMoving.length; i++) {
        movingMolNames.push(userInput[whichMoving[i]]['name']);
    }
    return movingMolNames;
}

function getStayingMolNames(userInput) {
    const whichStaying = getIndicesByKeyValue(userInput, 'type', 'stayingGroup');
    const stayingMolNames = [];
    for (let i = 0; i < whichStaying.length; i++) {
        stayingMolNames.push(userInput[whichStaying[i]]['name']);
    }
    return stayingMolNames;
}

function getSVGsByName(svgGroupsList, nameList) {
    const svgs = [];
    for (let i = 0; i < svgGroupsList.length; i++) {
        if (nameList.includes(svgGroupsList[i].node.id)) {
            svgs.push(svgGroupsList[i]);
        }
    }
    return svgs;
}

function getSiteNameByMolComp(siteMolComp, reactant_mol_components) {
    const site = getValueByKey(reactant_mol_components, siteMolComp);
    return site;
}

function getMoleculeByMolComp(siteMolComp, reactant_mol) {
    const molId = [siteMolComp.split("_")[0], siteMolComp.split("_")[1], siteMolComp.split("_")[2]].join("_");
    const molName = getValueByKey(reactant_mol, molId);
    return molName;
}

async function iterateAndVisualizeReactionRules(reactionRules, svgGroupsList, userInput) {
    const whichMoving = getMovingMolNames(userInput);
    const whichStaying = getStayingMolNames(userInput);
    const movingGroups = getSVGsByName(svgGroupsList, whichMoving);
    const stayingGroups = getSVGsByName(svgGroupsList, whichStaying);
    const groupedSVGs = [];
    
    const svgContainer = document.getElementById("ruleVisualization");
    const containerWidth = svgContainer.getBoundingClientRect().width;
    const containerHeight = svgContainer.getBoundingClientRect().height;
    
    var movingPos, stayingPos;
    var offset = 0;
    for (let i = 0; i < stayingGroups.length; i++) {
        stayingPos = {x: (containerWidth / 2) - (stayingGroups[i].width()/2) + offset, y: (containerHeight / 2) - (stayingGroups[i].height()/2) - offset};
        stayingGroups[i].addTo(svgContainer);
        stayingGroups[i].transform({translate: stayingPos});
        offset += 30;
    }
    
    for (let i = 0; i < movingGroups.length; i++) {
        movingGroups[i].addTo(svgContainer);
        movingPos = {x: (containerWidth / (movingGroups.length - i) - 200), y: containerHeight / 5};
        movingGroups[i].transform({translate: movingPos});
    }
    
    while (true) {
        for (let index = 0; index < reactionRules.length; index++) {
            const rule = reactionRules[index];
            const operations = rule.operations;

            for (const [key, value] of Object.entries(operations)) {
                const type = value.type;

                if (type === "StateChange") {
                    const site = value.site;
                }
                else if (type === "DeleteBond") {
                    const x1 = movingGroup.transform().translateX;
                    const y1 = movingGroup.transform().translateY;
                    const x2 = movingGroup.transform().translateX + 10; 
                    const y2 = movingGroup.transform().translateY; 
                    const distance = Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
                    const duration = distance * 10;
                    await animateSVGDeleteBond(movingGroup, duration, x1, y1, x2, y2);
                }
                else if (type ===  "AddBond") {
                    const group1 = value.site1;
                    const group2 = value.site2;
                    const molSiteName1 = getSiteNameByMolComp(group1, rule.reactant_mol_components);
                    const molSiteName2 = getSiteNameByMolComp(group2, rule.reactant_mol_components);
                    const molName1 = getMoleculeByMolComp(group1, rule.reactant_mol);
                    const molName2 = getMoleculeByMolComp(group2, rule.reactant_mol);

                    var twoRPsBecomeOnePP = false;
                    // check if two reactants become one product
                    if (rule.reactant_patterns.length === 2 && rule.product_patterns.length === 1) {
                        twoRPsBecomeOnePP = true;
                    }
                    
                    // check the conditions in which both molecules are designated as moving or staying
                    var movingGroup, stayingGroup, movingMolName, stayingMolName, movingSiteName, stayingSiteName;
                    var bothMoving = false;
                    if (whichMoving.includes(molName1) && whichMoving.includes(molName2)) {
                        // if both are moving, then arbitrarily designate one as moving and the other as staying
                        movingGroup = getSVGByName(movingGroups, molName1);
                        movingMolName = molName1;
                        movingSiteName = molSiteName1;
                        stayingGroup = getSVGByName(movingGroups, molName2);
                        stayingMolName = molName2;
                        stayingSiteName = molSiteName2;
                        bothMoving = true;
                    }
                    else if (whichStaying.includes(molName1) && whichStaying.includes(molName2)) {
                        // if both are staying, then arbitrarily designate one as moving and the other as staying
                        // this should probably never happen in practice though
                        movingGroup = getSVGByName(stayingGroups, molName1);
                        movingMolName = molName1;
                        movingSiteName = molSiteName1;
                        stayingGroup = getSVGByName(stayingGroups, molName2);
                        stayingMolName = molName2;
                        stayingSiteName = molSiteName2;
                    }
                    else if (whichMoving.includes(molName1) && whichStaying.includes(molName2)) {
                        movingGroup = getSVGByName(movingGroups, molName1);
                        movingMolName = molName1;
                        movingSiteName = molSiteName1;
                        stayingGroup = getSVGByName(stayingGroups, molName2);
                        stayingMolName = molName2;
                        stayingSiteName = molSiteName2;
                    }
                    else if (whichStaying.includes(molName1) && whichMoving.includes(molName2)) {
                        movingGroup = getSVGByName(movingGroups, molName2);
                        movingMolName = molName2;
                        movingSiteName = molSiteName2;
                        stayingGroup = getSVGByName(stayingGroups, molName1);
                        stayingMolName = molName1;
                        stayingSiteName = molSiteName1;
                    }

                    const moveFromSVGSites = movingGroup.find('circle'); // will get list of all the sites which are circles
                    const movingSiteGroup = getSVGByName(moveFromSVGSites, movingSiteName);
                    const x1 = movingSiteGroup.cx() + movingGroup.transform().translateX;
                    const y1 = movingSiteGroup.cy() + movingGroup.transform().translateY;
                    const moveToSVGSites = stayingGroup.find('circle');
                    const stayingSiteGroup = getSVGByName(moveToSVGSites, stayingSiteName);
                    const x2 = stayingSiteGroup.cx() + stayingGroup.transform().translateX;
                    const y2 = stayingSiteGroup.cy() + stayingGroup.transform().translateY;
                    const distance = Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
                    const duration = distance * 10;

                    await animateSVGAddBond(movingGroup, movingSiteGroup, duration, x1, y1, x2, y2);

                    if ( (twoRPsBecomeOnePP === true) && bothMoving === true) {
                        // if two reactants become one product and both are moving, then they probably will move together following?
                        const draw = SVG().addTo(svgContainer);
                        const parentGroup = draw.group();
                        parentGroup.add(movingGroup);
                        parentGroup.add(stayingGroup);
                        const groupedSVG = parentGroup.node;
                        groupedSVG.id = movingGroup.node.id + "_" + stayingGroup.node.id;
                        groupedSVGs.push(groupedSVG);
                    }
                    else if ( (twoRPsBecomeOnePP != true) && bothMoving === true ) {
                        error("Both molecules are moving, but they are not both becoming one product.");
                    };
                }
                else if (type === "AddMolecule") {
                    // figure out what to visualize in this case
                }
                else if (type === "DeleteMolecule") {
                    // figure out what to visualize in this case
                }
            }
            if (index === reactionRules.length - 1) {
                const x1 = movingGroup.transform().translateX;
                const y1 = movingGroup.transform().translateY;
                const x2 = movingGroup.transform().translateX + 100; 
                const y2 = movingGroup.transform().translateY - 50; // move the particle completely off before restarting 
                const distance = Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
                const duration = distance * 10;
                await animateSVGDeleteBond(movingGroup, duration, x1, y1, x2, y2);
                await animateSVGRestart(movingGroup, duration, movingPos);
            }
        if (index > 300) {
            // console.log(groupedSVGs);
            break;}
        }
    }
}

function checkIfGrouped(groupedSVGs, groupedName1, groupedName2) {
    var grouped = false;
    let regex1 = new RegExp(groupedName1);
    let regex2 = new RegExp(groupedName2);
    for (let n = 0; n < groupedSVGs.length; n++) {
        let svgId = groupedSVGs[n].id;
        if (regex1.test(svgId)) {
            grouped = true;
            break;
        }
        else if (regex2.test(svgId)) {
            grouped = true;
            break;
        }
    }
    return grouped;
}


async function iterateAndVisualizeSimulationFirings(modelRules, svgGroupsList, firings, moleculeTypes, userInput) {
    const svgContainer = document.getElementById("simulationVisualization");
    const containerWidth = svgContainer.getBoundingClientRect().width;
    const containerHeight = svgContainer.getBoundingClientRect().height;
    const whichMoving = getMovingMolNames(userInput);
    const whichStaying = getStayingMolNames(userInput);
    const groupedSVGs = [];

    var position, movPosition;
    for (let i = 0; i < svgGroupsList.length; i++) {
        for (let key in svgGroupsList[i]) {
            const groups = svgGroupsList[i][key];
            for (let j = 0; j < groups.length; j++) {
                const thisGroup = groups[j];
                const spacing_y = containerHeight / svgGroupsList.length;
                const space_y = spacing_y - (spacing_y / 2);
                position = {x: (containerWidth / (svgGroupsList.length - i)) - 150, y: space_y * (i+1)};
                thisGroup.addTo(svgContainer);
                thisGroup.transform({translate: position});
                const thisMolName = thisGroup.node.id.split("_")[0];
                if (whichMoving.includes(thisMolName)) {
                    thisGroup.attr('opacity', 1);
                    movPosition = position;
                }
            }
        }
    }

    for (let index = 0; index < firings.length; index++) {
        const firing = firings[index];
        const props = getValueByKey(firing, 'props');
        const ops = getValueByKey(firing, 'ops');
        const ruleName = props[0];
        const rule = getRuleByPropsName(modelRules, ruleName);
        const operations = rule.operations;

        var twoRPsBecomeOnePP = false;
        // check if two reactants become one product
        if (rule.reactant_patterns.length === 2 && rule.product_patterns.length === 1) {
            twoRPsBecomeOnePP = true;
        }           
        
        for (const [key, value] of Object.entries(operations)) {
            const type = value.type;
            var group1 = value.site1;
            const group2 = value.site2;
            
            // confirm each firing will only ever have at most 2 sites
            if (group1 === undefined) { // if above is true, then this would be the case where there is only 1 site
                group1 = value.site;
            }

            var movingGroups, movingGroup, movingTypeId, stayingGroups, stayingGroup, stayingTypeId;
            var movingMolName, stayingMolName, movingSiteName, stayingSiteName, movingMolNum, stayingMolNum;
            if (type === "StateChange") {
                // add something to visualize the state change
            }
            else if (type === "DeleteBond") {
                const deleteBond = getDeleteBondOp(ops);
                const molNum1 = deleteBond[0];
                const molNum2 = deleteBond[2];
                const molSiteName1 = getSiteNameByMolComp(group1, rule.reactant_mol_components);
                const molSiteName2 = getSiteNameByMolComp(group2, rule.reactant_mol_components);
                const molName1 = getMoleculeByMolComp(group1, rule.reactant_mol);
                const molName2 = getMoleculeByMolComp(group2, rule.reactant_mol);
                const molTypeId1 = getTypeIdFromMolName(moleculeTypes, molName1);
                const molTypeId2 = getTypeIdFromMolName(moleculeTypes, molName2);

                if (whichMoving.includes(molName1) && whichMoving.includes(molName2)) {
                    // if both are moving, for now just arbitrarily pick the first
                    movingGroups = getSVGListByTypeId(svgGroupsList, molTypeId1);
                    movingMolName = molName1;
                    movingSiteName = molSiteName1;
                    movingTypeId = molTypeId1;
                    movingMolNum = molNum1;
                }
                else if (whichStaying.includes(molName1) && whichStaying.includes(molName2)) {
                    // if both are staying, then for now arbitrarily pick the first
                    // this probably shouldn't ever be the case though
                    movingGroups = getSVGListByTypeId(svgGroupsList, molTypeId1);
                    movingMolName = molName1;
                    movingSiteName = molSiteName1;
                    movingTypeId = molTypeId1;
                    movingMolNum = molNum1;
                }
                else if (whichMoving.includes(molName1) && whichStaying.includes(molName2)) {
                    movingGroups = getSVGListByTypeId(svgGroupsList, molTypeId1);
                    movingMolName = molName1;
                    movingSiteName = molSiteName1;
                    movingTypeId = molTypeId1;
                    movingMolNum = molNum1;
                }
                else if (whichStaying.includes(molName1) && whichMoving.includes(molName2)) {
                    movingGroups = getSVGListByTypeId(svgGroupsList, molTypeId2);
                    movingMolName = molName2;
                    movingSiteName = molSiteName2;
                    movingTypeId = molTypeId2;
                    movingMolNum = molNum2;
                }

                const moveSVGName = movingMolName + "_" + movingMolNum;
                const movingGroup_i = getExactSVGByName(movingGroups, moveSVGName);
                const x1 = movingGroup_i.transform().translateX;
                const y1 = movingGroup_i.transform().translateY;
                const x2 = movingGroup_i.transform().translateX + 10; 
                const y2 = movingGroup_i.transform().translateY; 
                const distance = Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
                const duration = distance * 10; 
                await animateSVGDeleteBond(movingGroup_i, duration, x1, y1, x2, y2);
            }
            else if (type === "AddBond") {
                const addBond = getAddBondOp(ops); 
                const molNum1 = addBond[0];
                const molNum2 = addBond[2];
                const molSiteName1 = getSiteNameByMolComp(group1, rule.reactant_mol_components);
                const molSiteName2 = getSiteNameByMolComp(group2, rule.reactant_mol_components);
                const molName1 = getMoleculeByMolComp(group1, rule.reactant_mol);
                const molName2 = getMoleculeByMolComp(group2, rule.reactant_mol);
                const molTypeId1 = getTypeIdFromMolName(moleculeTypes, molName1);
                const molTypeId2 = getTypeIdFromMolName(moleculeTypes, molName2);
                var bothMoving = false;
                
                const groupedName1 = [molName1, molNum1].join("_");
                const groupedName2 = [molName2, molNum2].join("_");
                const groupedName = [molName1, molNum1, molName2, molNum2].join("_");
                // console.log(groupedName1, groupedName2);
                let grouped = checkIfGrouped(groupedSVGs, groupedName1, groupedName2);
                if (grouped == true){
                    console.log('bonded molecules what to do next', groupedName);
                    console.log(rule);
                }

                if (whichMoving.includes(molName1) && whichMoving.includes(molName2) && grouped === false) {
                    // if both are moving and they haven't bonded before, then arbitrarily designate one as moving and the other as staying
                    movingGroups = getSVGListByTypeId(svgGroupsList, molTypeId1);
                    movingMolName = molName1;
                    movingSiteName = molSiteName1;
                    movingTypeId = molTypeId1;
                    movingMolNum = molNum1;
                    stayingGroups = getSVGListByTypeId(svgGroupsList, molTypeId2);
                    stayingMolName = molName2;
                    stayingSiteName = molSiteName2;
                    stayingTypeId = molTypeId2;
                    stayingMolNum = molNum2;
                    bothMoving = true;
                }
                else if (whichStaying.includes(molName1) && whichStaying.includes(molName2) && grouped === false) {
                    // if both are staying, then arbitrarily designate one as moving and the other as staying
                    movingGroups = getSVGListByTypeId(svgGroupsList, molTypeId1);
                    movingMolName = molName1;
                    movingSiteName = molSiteName1;
                    movingTypeId = molTypeId1;
                    movingMolNum = molNum1;
                    stayingGroups = getSVGListByTypeId(svgGroupsList, molTypeId2);
                    stayingMolName = molName2;
                    stayingSiteName = molSiteName2;
                    stayingTypeId = molTypeId2;
                    stayingMolNum = molNum2;
                }
                else if (whichMoving.includes(molName1) && whichStaying.includes(molName2) && grouped === false) {
                    movingGroups = getSVGListByTypeId(svgGroupsList, molTypeId1);
                    movingMolName = molName1;
                    movingSiteName = molSiteName1;
                    movingTypeId = molTypeId1;
                    movingMolNum = molNum1;
                    stayingGroups = getSVGListByTypeId(svgGroupsList, molTypeId2);
                    stayingMolName = molName2;
                    stayingSiteName = molSiteName2;
                    stayingTypeId = molTypeId2;
                    stayingMolNum = molNum2;
                }
                else if (whichStaying.includes(molName1) && whichMoving.includes(molName2) && grouped === false) {
                    movingGroups = getSVGListByTypeId(svgGroupsList, molTypeId2);
                    movingMolName = molName2;
                    movingSiteName = molSiteName2;
                    movingTypeId = molTypeId2;
                    movingMolNum = molNum2;
                    stayingGroups = getSVGListByTypeId(svgGroupsList, molTypeId1);
                    stayingMolName = molName1;
                    stayingSiteName = molSiteName1;
                    stayingTypeId = molTypeId1;
                    stayingMolNum = molNum1;
                }

                const moveSVGName = movingMolName + "_" + movingMolNum;
                const staySVGName = stayingMolName + "_" + stayingMolNum;
                const movingGroup_i = getExactSVGByName(movingGroups, moveSVGName);
                const moveFromSVGSites = movingGroup_i.find('circle'); // will get list of all the sites which are circles
                const movingSiteGroup = getExactSVGByName(moveFromSVGSites, movingSiteName);
                const x1 = movingSiteGroup.cx() + movingGroup_i.transform().translateX;
                const y1 = movingSiteGroup.cy() + movingGroup_i.transform().translateY;
                const stayingGroup_i = getExactSVGByName(stayingGroups, staySVGName);
                const moveToSVGSites = stayingGroup_i.find('circle');
                const stayingSiteGroup = getExactSVGByName(moveToSVGSites, stayingSiteName);
                const x2 = stayingSiteGroup.cx() + stayingGroup_i.transform().translateX;
                const y2 = stayingSiteGroup.cy() + stayingGroup_i.transform().translateY;
                const distance = Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
                const duration = distance * 10; // increase number to increase how long it takes to move
                await animateSVGAddBond(movingGroup_i, movingSiteGroup, duration, x1, y1, x2, y2);

                if ( twoRPsBecomeOnePP === true && bothMoving === true && grouped === false) {
                    // if two reactants become one product and both are moving, then they probably will move together following?
                    const draw = SVG().addTo(svgContainer);
                    const parentGroup = draw.group();
                    parentGroup.add(movingGroup_i);
                    parentGroup.add(stayingGroup_i);
                    const groupedSVG = parentGroup.node;
                    groupedSVG.id = movingGroup_i.node.id + "_" + stayingGroup_i.node.id;
                    groupedSVGs.push(groupedSVG);
                }
                else if ( twoRPsBecomeOnePP != true && bothMoving === true ) {
                    error("Both molecules are moving, but they are not both becoming one product.");
                };            
            }
            else if (type === "AddMolecule") {
                // figure out what to visualize in this case
            }
            else if (type === "DeleteMolecule") {
                // figure out what to visualize in this case
            }
        }
        const checkIfEnd = getRuleIndexByRuleName(modelRules, ruleName);
        if (checkIfEnd === modelRules.length - 1) {
            const moveSVGName = movingMolName + "_" + movingMolNum;
            const movingGroup_i = getExactSVGByName(movingGroups, moveSVGName);
            const x1 = movingGroup_i.transform().translateX;
            const y1 = movingGroup_i.transform().translateY;
            const x2 = movingGroup_i.transform().translateX + 100; 
            const y2 = movingGroup_i.transform().translateY - 50; // move the particle off before restarting
            const distance = Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
            const duration = distance * 10; 
            await animateSVGDeleteBond(movingGroup_i, duration, x1, y1, x2, y2);
            await animateSVGRestart(movingGroup_i, duration, movPosition);
        }
    }
}


async function main() {
    const xmlUrl = './model_xml/model.xml';
    const svgBasePath = "./svg/";
    const jsonData = await fetchAndProcessXML(xmlUrl);
    const model = await createModelFromJson(jsonData);
    const userInput = await fetch("./model_xml/user_input.json").then(response => response.json());
    const simulation = await fetch("./model_xml/model.json").then(response => response.json());
    const firings = simulation["simulation"]["firings"];
    const moleculeTypes = simulation["simulation"]["molecule_types"];
    addSVGContainer();
    console.log(model);

    const moleculeReps = model.monomers.map(
        (monomer, index) => createMoleculeRepresentation(monomer, index, svgBasePath));
    
    const promisesModel = model.monomers.map(async (monomer, index) => {
        return await createMoleculeModelGroups(monomer, index, svgBasePath); 
    });
    const svgMoleculeGroupsModel =  await Promise.all(promisesModel);
    iterateAndVisualizeReactionRules(model.rules, svgMoleculeGroupsModel, userInput);

    const promises = model.monomers.map(async (monomer) => {
        return await createMoleculeGroups(monomer, simulation, userInput, svgBasePath); 
    });
    const svgMoleculeGroups = await Promise.all(promises);
    iterateAndVisualizeSimulationFirings(model.rules, svgMoleculeGroups, firings, moleculeTypes, userInput);
    
}

main();