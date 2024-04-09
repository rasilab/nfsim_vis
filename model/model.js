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
    constructor(name, reactants, products, rate) {
        this.name = name;
        this.reactants = reactants; // Array of strings or objects representing reactants
        this.products = products; // Array of strings or objects representing products
        this.rate = rate; // Numerical value representing the rate of the reaction
    }
}

export class InitialCondition {
    constructor(species, value) {
        this.species = species; // String or object representing the species
        this.value = value; // Numerical value representing the initial concentration/number of the species
    }
}