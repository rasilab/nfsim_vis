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
    // component.set_system(this.system);
    // there's something weird about how systems are set
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

      // in mol_viewer, click event listeners on current_render are
      // blocked by invisible renders that are in front of current_render
      render_inst.back();
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
  }
  async initialize(settings) {
    // we need to load in the SVG strings first
    await this.load_svgs(settings["svgs"]);
    // we now make symbols from each for re-use
    await this.define_symbols();
    // adding actors and associate them with symbols
    await this.add_actor_definitions(settings["molecule_types"]);
  }
  async add_actor_definitions(mol_types) {
    for (let i = 0; i < mol_types.length; i++) {
      this.actor_definitions[mol_types[i].name] = mol_types[i];
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
  make_actor_from_def(def) {
    let molecule = new Molecule(
      def["name"],
      this,
      {},
      this.symbols[def["svg_name"]]
    );
    for (let i = 0; i < def["components"].length; i++) {
      let component = new Component(
        def["components"][i]["name"],
        molecule,
        [],
        0,
        def["components"][i]["pos"]
      );
      component.set_system(this);
      for (
        let j = 0;
        j < def["components"][i]["component_states"].length;
        j++
      ) {
        let name = def["components"][i]["component_states"][j]["name"];
        let state = new ComponentState(
          name,
          component,
          this.symbols[
            `${def["components"][i]["component_states"][j]["svg_name"]}`
          ]
        );
        state.set_id(def["components"][i]["component_states"][j]["state_id"]);
        component.add_state(state);
      }
      component.set_state(
        component.states[def["components"][i]["current_state"]]
      );
      molecule.add_component(component.name, component);
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
    let w = vis_settings["general"]["width"] ? vis_settings["general"]["width"]:(window.innerWidth*10);
    // TODO: figure out an automated way to do this
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
