// this is needed when running from npm
// import { SVG } from '@svgdotjs/svg.js'

// Begin: Actor classes
export class Actor {
  constructor(name, parent) {
    this.name = name;
    this.parent = parent;
    this.system = null;
  }
  set_parent(parent) {
    this.parent = parent;
  }
  set_system(system) {
    this.system = system;
  }
  render() {
    Error("Not implemented for template class");
  }
}

export class Molecule extends Actor {
  constructor(name, parent, components, symbol) {
    super(name, parent);
    this.components = components;
    this.symbol = symbol;
    this.group = null;
    this.animator = null;
  }
  add_component(name, component) {
    component.set_system(this.system);
    this.components[name] = component;
  }
  render() {
    if (this.group == null) {
      this.group = this.system.canvas.group();
    }
    // render molecule
    this.group.use(this.symbol);
    // render components
    for (let i = 0; i < Object.keys(this.components).length; i++) {
      this.components[Object.keys(this.components)[i]].render();
    }
    // setup the runner for the group here as well
    this.group.timeline(this.system.timeline);
    return this.group;
  }
  transform(transform_dict) {
    this.group.transform(transform_dict);
  }
  // detail printing for debug purposes
  print_details() {
    console.log(`Molecule name: ${this.name}`);
    console.log(`Molecule rep: ${this.symbol}`);
    for (let i = 0; i < Object.keys(this.components).length; i++) {
      this.components[Object.keys(this.components)[i]].print_details();
    }
  }
}

export class Component extends Actor {
  constructor(name, parent, states, current_state, pos) {
    super(name, parent);
    this.states = states;
    this.current_state = current_state;
    this.curr_state_id = null;
    this.current_render;
    this.pos = pos;
  }
  add_state(state) {
    state.set_system(this.system);
    if (state.id != null) {
      this.states[state.id] = state;
    } else {
      this.states.push(state);
    }
    state.set_parent(this);
  }
  set_state(state) {
    this.curr_state_id = state.id;
    this.current_state = state;
  }
  set_state_by_id(state_id) {
    this.curr_state_id = state_id;
    this.current_state = this.states[state_id];
  }
  next_state () {
    let next_id = (this.curr_state_id+1)%this.states.length;
    this.curr_state_id = next_id;
    this.current_state = this.states[this.curr_state_id];
  }
  render() {
    // render component states
    for (let i = 0;i<this.states.length;i++) { 
      if (i==this.current_state.id) {
        let render_inst = this.current_state.render(true);
        this.current_render = render_inst;
        render_inst.transform({
          translateX: this.pos[0],
          translateY: this.pos[1],
        });
      } else {
        let render_inst = this.states[i].render(false);
        render_inst.transform({
          translateX: this.pos[0],
          translateY: this.pos[1],
        });
      }
    } 
    
    return this.current_render;
  }
  // detail printing for debug purposes
  print_details() {
    console.log(`  Component name: ${this.name}`);
    console.log(`  Component state: ${this.current_state.name}`);
    console.log(`  Component pos: ${this.pos}`);
    for (let i = 0; i < Object.keys(this.states).length; i++) {
      this.states[Object.keys(this.states)[i]].print_details();
    }
  }
}

export class ComponentState extends Actor {
  constructor(name, parent, symbol) {
    super(name, parent);
    this.symbol = symbol;
  }
  set_symbol(symbol) {
    this.symbol = symbol;
  }
  set_id(state_id) {
    this.id = state_id;
  }
  render(visible) {
    // render state
    let render_inst = this.parent.parent.group.use(this.symbol);
    if (!visible) { 
      render_inst.opacity(0.0);
    }
    // transform as needed
    return render_inst;
  }
  // detail printing for debug purposes
  print_details() {
    console.log(`    State name: ${this.name}`);
    console.log(`    State rep: ${this.symbol}`);
  }
}
// End: Actor classes

// Begin: Rules and related classes
export class Rule {
  constructor(name, reactants, products, rate_law, operations) {
    this.name = name;
    this.reactants = reactants;
    this.products = products;
    this.rate_law = rate_law;
    this.operations = operations;
  }
}
export class Operation {
  constructor(type, dict) {
    this.type = type;
    this.dict = dict;
  }
}
// End: Rules

// Main system class
export class System {
  constructor(canvas, actors, svgs, timeline) {
    this.canvas = canvas;
    this.actors = actors;
    this.actor_definitions = {};
    this.timeline = timeline;
    this.svgs = svgs;
    this.symbols = {};
    this.instances = [];
    this.rules = {};
  }
  async initialize(settings) {
    // we need to load in the SVG strings first
    await this.load_svgs(settings["svgs"]);
    // we now make symbols from each for re-use
    await this.define_symbols();
    // adding actors and associate them with symbols
    await this.add_actor_definitions(settings);
    // get rules
    await this.add_rules(settings);
  }
  async add_rules(settings) {
    let model = settings['model']['sbml']['model'];
    let rules = model['ListOfReactionRules']['ReactionRule'];
    for (let i = 0; i < rules.length; i++) {
      this.add_rule(rules[i]);
    }
  }
  add_rule(rule_dict) {
    let name         = rule_dict["@name"];
    let reactants    = this.parse_reactants(rule_dict["ListOfReactantPatterns"]["ReactantPattern"]);
    let products     = this.parse_products(rule_dict["ListOfProductPatterns"]["ProductPattern"]);
    let ratelaw      = this.parse_ratelaw(rule_dict["RateLaw"]);
    let ops          = this.parse_ops(rule_dict["ListOfOperations"]);
    let rule         = Rule(name, reactants, products, ratelaw, ops);
    this.rules[name] = rule;
  }
  parse_reactants(reactants_dict){}
  parse_products(products_dict){}
  parse_ratelaw(rate_law_dict){}
  parse_ops(list_of_ops){
    ops = [];
    for (let i = 0;i<Object.keys(list_of_ops).length;i++) {
      op_type = Object.keys(list_of_ops)[i];
      op_dict = list_of_ops[op_type];
      // TODO: Check if these can be lists?
      op = Operation(op_type, op_dict);
      ops.push(op);
    } 
    return ops;
  }
  async add_actor_definitions(settings) {
    let model = settings['model']['sbml']['model'];
    let mol_types = model['ListOfMoleculeTypes']['MoleculeType'];
    for (let i = 0; i < mol_types.length; i++) {
      this.actor_definitions[mol_types[i]['@id']] = mol_types[i];
    }
  }
  add_actor_from_name(actor_name) {
    let actor = this.make_actor_from_def(this.actor_definitions[actor_name]);
    actor.set_system(this);
    return actor;
  }
  add_actor(actor) {
    actor.set_system(this);
    this.actors[actor.name] = actor;
  }
  parse_state(state_dict, component) {
    let name = state_dict["@id"];
    let state = new ComponentState(
      name,
      component,
      this.symbols[
        `${state_dict["svg_name"]}`
      ]
    );
    state.set_id(state_dict["state_id"]);
    return state;
  }
  parse_states(states, component) {
    if (Array.isArray(states)) {
      for (
        let j = 0;
        j < states.length;
        j++
      ) {
        let state = this.parse_state(states[j],component);
        component.add_state(state);
      }
    } else {
      let state = this.parse_state(states,component);
      component.add_state(state);
    }
  }
  parse_comp(comp, molecule) {
    let component = new Component(
      comp["@id"],
      molecule,
      [],
      0,
      comp["pos"]
    );
    component.set_system(this);
    if ("ListOfAllowedStates" in comp) {
      let states = comp["ListOfAllowedStates"]["AllowedState"];
      this.parse_states(states, component);
    } else {
      // we have no states but we want a default rep
      let state_name = `${molecule.name}_${component.name}_0`;
      let state_svg = "<svg height=\"500\" width=\"500\"><circle cx=\"100\" cy=\"100\" r=\"100\" stroke=\"black\" stroke-width=\"3\" fill=\"black\" /></svg>"
      if (!(state_name in this.svgs)) {
        this.add_svg(state_name, state_svg);
        if (!(state_name in this.symbols)) {
          this.define_symbol(state_name);
        }
      }
      let state = new ComponentState(
        state_name,
        component,
        this.symbols[
          `${state_name}`
        ]
      );
      state.set_id(0);
      component.add_state(state);
    }
    component.set_state_by_id(0);
    return component;
  }
  parse_comps(comps, molecule) {
    if (Array.isArray(comps)) {
      for (let i = 0; i < comps.length; i++) {
        let component = this.parse_comp(comps[i], molecule);
        molecule.add_component(component.name, component);
      }
    } else {
      // single component
      let component = this.parse_comp(comps, molecule);
      molecule.add_component(component.name, component);
    }
  }
  make_actor_from_def(def) {
    let molecule = new Molecule(
      def["@id"],
      this,
      {},
      this.symbols[def["svg_name"]]
    );
    if ("ListOfComponentTypes" in def) {
      let comps = def["ListOfComponentTypes"]['ComponentType'];
      this.parse_comps(comps, molecule);
    }
    return molecule;
  }
  // svgs and related methods
  add_svg(name, svg) {
    this.svgs[name] = svg;
  }
  async load_svgs(svgs) {
    for (let i = 0; i < svgs.length; i++) {
      let svg = svgs[i];
      // check if it's a file
      if (svg["type"] == "file") {
        await fetch(svg["path"])
          .then((resp) => resp.text())
          .then((str) => this.add_svg(`${svg["name"]}`, str));
      } else if (svg["type"] == "string") {
        this.add_svg(`${svg["name"]}`, svg["string"]);
      } else {
        Error(`SVG type ${svg["type"]} is not implemented!`);
      }
    }
  }
  define_symbol(rep_name) {
    let s = this.canvas.symbol();
    let def = s.svg(this.svgs[rep_name]);
    this.symbols[rep_name] = def;
  }
  define_symbols() {
    return Promise.all(
      Object.keys(this.svgs).map((x) => this.define_symbol(x))
    );
  }
}

// Main settings class for parsing a setting file
export class Settings {
  constructor(setting_file) {
    this.setting_file = setting_file;
    this.system = null;
  }
  async parse_settings_file() {
    // fetch settings JSON
    let settings_json = await fetch(this.setting_file).then((setting) =>
      setting.json()
    );
    // initialize system from settings
    let vis_settings = settings_json["visualization_settings"];
    // TODO: figure out an automated way to get suitable height/width
    let w = vis_settings["general"]["width"] ? vis_settings["general"]["width"]:(window.innerWidth*10);
    let h = vis_settings["general"]["height"] ? vis_settings["general"]["height"]:(window.innerHeight*10)-1000;
    //
    let timeline = new SVG.Timeline();
    let canvas = SVG()
      .addTo("body")
      .size(window.innerWidth, window.innerHeight)
      .viewbox(0, 0, w, h);
    let sys = new System(canvas, {}, {}, timeline);
    // initialize
    await sys.initialize(vis_settings);
    // return initialized system
    console.log("--System intialized--");
    this.system = sys;
  }
}
