import * as core from "./core.js";

// core system initialization, async
let settings = new core.Settings("settings.json", "events.json");
await settings.initialize();
console.log(settings);
let sys = settings.system;

// load log
let log_file = "events.json";
let log_obj = await fetch(log_file).then((log) => log.json());
let firings = sys.events;

// get molecule types
let molecule_types = {}; // key: typeID, value: molecule type name
let molecule_types_obj = log_obj["simulation"]["molecule_types"];
for (const molecule_type of molecule_types_obj) {
  molecule_types[molecule_type["typeID"]] = molecule_type["name"];
}

// some info for positioning things
let window_center;
let mrna_size;
let mrna_positions;

// get initial state
let state = {}; // key: index, value: molecule instance
let initial_state_obj = log_obj["simulation"]["initialState"];
let molecule_array = initial_state_obj["molecule_array"];
let index = 0;
for (const entry of molecule_array) {
  let typeID = entry[0];
  let number = entry[1];
  let name = molecule_types[typeID];
  if (name != undefined) {
    for (let i = 0; i < number; i++) {
      let instance = sys.add_actor_from_name(name);
      state[index] = instance;
      index++;

      // does it make sense to do the initial render here?
      let render = instance.render();

      // set up initial appearance
      // - mrna: opacity 1; x,y centered in window
      // - ribosomes: opacity 0; x at left edge; y above mrna
      if (name == "mrna") {
        // load info for positioning here (using render)
        // - alternatively, could maybe do something similar by
        // reading svg information directly from vis_settings.json
        window_center = render.point(window.innerWidth/2, window.innerHeight/2);
        mrna_size = {
          w: render.width(),
          h: render.height()
        };
        mrna_positions = Object.keys(instance.components);

        render.center(window_center.x, window_center.y); // place mrna
        render.opacity(1); // show mrna
      } else if (name == "ribosome") {
        if (window_center != undefined && mrna_size != undefined) {
          render.center(0, window_center.y - 2*mrna_size.h); // place ribosome
          // todo: maybe figure out a better / more logical y position
          // - currently all positioning calculations are done based on
          // the size of mrna svg alone, ribosome svg is not considered
        }
        render.opacity(0); // hide ribosome for now
      }
      // sync locations 
      instance.sync_svg_location();
      // initialize animator
      instance.animator = render.animate(1, 0, "absolute");
    }
    
  }
}

// note that movement of ribosomes between positions on the mrna
// is hard-coded based on the width of the mrna svg and number of
// positions, not tied to the actual given pos of the components
let ribosome_movement = mrna_size.w / (mrna_positions.length - 1);

// iterate over firings and schedule animations
for (const firing of firings) {
  let props = firing["props"];
  let reaction_name = props[0]; // not currently used
  let time = props[2];
  let ops = firing["ops"];

  for (const op of ops) {
    let op_name = op[0];

    // figure out what we're working with

    let mol_1_index;
    let comp_1_index;
    let comp_state_index;
    let mol_2_index;
    let comp_2_index;
    
    switch(op_name) {
      case "StateChange":
        mol_1_index = op[1];
        comp_1_index = op[2];
        comp_state_index = op[3];
        break;

      // AddBond, DeleteBond have the same arguments
      case "AddBond":
      case "DeleteBond":
        mol_1_index = op[1];
        comp_1_index = op[2];
        mol_2_index = op[3];
        comp_2_index = op[4];
        break;
      
      default:
        break
    }

    // schedule corresponding animation

    let inst_1;
    let inst_2;

    if (mol_1_index != undefined) {
      inst_1 = state[mol_1_index];
    }
    if (mol_2_index != undefined) {
      inst_2 = state[mol_2_index];
    }

    // where does it make sense to set opacity of actors?
    
    // todo:
    // figure out how exactly to handle timing to make animation smooth
    // while also avoiding overlap between the end of one event and the
    // beginning of the next (depends on duration & spacing of firings)
    // - specifically overlap between events on the same actor, not sure
    // if this is an issue for events on different actors (probaby not?)
    let duration = 100;
    let time_multiplier = 1000;

    // the following code relies on assumptions about indices as well as
    // relationships between reactions, operations, and desired animations
    switch(op_name) {
      // todo: handle StateChange
      case "StateChange":
        // are components guaranteed to be ordered in such a way that this works?
        let component_name = Object.keys(inst_1.components)[comp_1_index];
        let component = inst_1.components[component_name];
        // component.set_state_by_id(comp_state_index);

        // probably need to remove render and generate a new one
        // how to schedule this kind of update?
        // alternatively, can try to do this just by animating opacity changes
        // - would have to call .animate on state renders directly rather than going
        // through the .animator thing, not exactly sure how/if this would work
        // - also, I suspect this can only work if each state keeps track of its render
        for (const state of component.states) {
          if (state.id == comp_state_index) {
            // schedule animation on state render to set its opacity to 1
          } else {
            // schedule animation on state render to set its opacity to 0
          }
        }
        // to avoid this loop, could maybe..
        // - get component.current_render and schedule an animation on it (opacity 0)
        // - use component.set_state_by_id(comp_state_index) to update current state info
        // - ??? all the same issues come up here
        break;

      // AddBond is used as the representative operation for initiate, elongate
      case "AddBond":
        // AddBond at first position on mrna (initiate)
        // ribosome animation: opacity to 1; move x to left edge of mrna, move y to above mrna
        if (mol_2_index == 0 && comp_2_index == 0) {
          inst_1.animator = inst_1.animator.animate({
            duration: duration,
            delay: time*time_multiplier,
            when: "absolute"
          }).center(
            window_center.x - mrna_size.w/2,
            window_center.y - 2*mrna_size.h
          ).opacity(1);
        }
        // AddBond elsewhere (elongate)
        // ribosome animation: move x to next position along mrna
        else {
          inst_1.animator = inst_1.animator.animate({
            duration: duration,
            delay: time*time_multiplier,
            when: "absolute"
          }).dx(ribosome_movement);
        }
        // should maybe use move instead of center (in general, throughout this
        // whole thing), might match up better with how components are positioned
        break;

      // DeleteBond is used as the representative operation for terminate
      // - DeleteBond in elongate reactions is currently ignored
      case "DeleteBond":
        // DeleteBond at last position on mrna (terminate)
        // ribosome animation: opacity to 0; move y to top edge
        if (mol_2_index == 0 && comp_2_index == mrna_positions.length - 1) {
          inst_1.animator = inst_1.animator.animate({
            duration: duration*5, // can be slower than other events
            delay: time*time_multiplier,
            when: "absolute"
          }).dy(-window_center.y).opacity(0);
        }
        break;
      
        default:
          break
    }

  }
}

// pause by default
sys.timeline.pause();

// press p to play
document.onkeydown = function (event) {
  if (event.key == "p") {
    sys.timeline.play();
  }
}

// how exactly should timeline/runners be handled here and controlled by user?

/*
// allows us to use the buttons even after animation finishes
// stops SVG.js from removing the timeline after completion
sys.timeline.persist(true);
// start stop restart
let play = sys.canvas.group().use(sys.symbols["play"]);
play.timeline(sys.timeline);
play.size(800);
play.center(500, 50);
let pause = sys.canvas.group().use(sys.symbols["pause"]);
pause.timeline(sys.timeline);
pause.center(1000, -400);
let restart = sys.canvas.group().use(sys.symbols["stop"]);
restart.timeline(sys.timeline);
restart.center(2000, -400);
// functions
play.click(function () {
  this.timeline().play();
});
pause.click(function () {
  this.timeline().pause();
});
restart.click(function () {
  this.timeline().stop();
});

// Example removal after animation
ssu_inst_2.animator.after(()=>{
  ssu_inst_2_grp.remove();
});
*/