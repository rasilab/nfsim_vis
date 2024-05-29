export class Model {
    constructor(name) {
        this.name = name;
        this.monomers = [];
        this.parameters = [];
        this.rules = [];
        this.initialConditions = [];
    }

    addMonomer(monomer) {
        this.monomers.push(monomer);
    }

    addParameter(parameter) {
        this.parameters.push(parameter);
    }

    addRule(rule) {
        this.rules.push(rule);
    }

    addInitialCondition(initialCondition) {
        this.initialConditions.push(initialCondition);
    }

    getMonomer(name) {
        return this.monomers.find(monomer => monomer.name === name);
    }

    getParameter(name) {
        return this.parameters.find(parameter => parameter.name === name);
    }

    getRule(name) {
        return this.rules.find(rule => rule.name === name);
    }

    // Additional methods to manipulate and query the model can be added here
}

export class Monomer {
    constructor(name, sites, states = {}) {
        this.name = name;
        this.sites = sites; // Array of strings or objects representing binding sites
        this.states = states; // Object with site names as keys and possible states as values
    }
}

export class Parameter {
    constructor(name, value) {
        this.name = name;
        this.value = value; // Assuming value is a numerical value representing the parameter
    }
}

export class Rule {
    constructor(name, reactant_patterns, reactant_mol, reactant_mol_components, reactant_num_bonds, product_patterns, product_mol, product_mol_components, product_num_bonds, product_bonds, product_states, rate, rateConstant, operations) {
        this.name = name;
        this.rate = rate; // Numerical value representing the rate of the reaction
        this.rateConstant = rateConstant; // String for the rate parameter of that rule
        this.reactant_patterns = reactant_patterns; // Array of strings or objects representing reactants
        this.reactant_mol = reactant_mol; // Dictionary of reactant molecule ID (e.g. 1, 2) to molecule name
        this.reactant_mol_components = reactant_mol_components; // Dictionary of reactant component ID (e.g. 1, 2) to component name
        this.reactant_num_bonds = reactant_num_bonds; // Dictionary of component ID to number of bonds for that component
        this.product_patterns = product_patterns;
        this.product_mol = product_mol;
        this.product_mol_components = product_mol_components;
        this.product_num_bonds = product_num_bonds;
        this.product_bonds = product_bonds;
        this.product_states = product_states; // Dictionary of component ID to state
        this.operations = operations;
    }
}

export class InitialCondition {
    constructor(species, value) {
        this.species = species; // String or object representing the species
        this.value = value; // Numerical value representing the initial concentration/number of the species
    }
}
