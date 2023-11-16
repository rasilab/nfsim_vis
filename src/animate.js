import * as core from "./core.js";

// --- initialization ---
// requires: settings JSON file, events JSON file
let settings = new core.Settings("../complex_vis/complex_vis_settings.json", "../complex_vis/complex_log_1000.json");
await settings.initialize();
let sys = settings.system;
let firings = sys.events; // object taken directly from events JSON file

// --- initial rendering ---
let window_center;
let mrna_size = {w: 6000, h: 200};
// todo: this needs to not be hardcoded, but there seems to be something weird about getting width/height of a nested group
// which seems especially annoying if we want to move things by their upper left corners (in the interest of consistency)

// loop over all molecules in full_state to set up initial rendering
// - full_state: dictionary
// -- key: molecule index/id
// -- value: instance of core.Molecule
for (const instance of Object.values(sys.full_state)) {
      let render;
      switch(instance.name) {
        // mrna: requires pre-processing, needs to be positioned & visible
        case "mrna":
          // loop over nt components to spread them out evenly
          let mrna_positions = Object.keys(instance.components).slice(1);
          for (let i = 0; i<mrna_positions.length; i++) {
            // update x position of each nt component
            let component = instance.components[mrna_positions[i]];
            component.pos[0] += (mrna_size.w / mrna_positions.length) * i;
          }

          // designate mrna as a fixed molecule (its position will not change)
          instance.set_fixed();

          // generate render
          render = instance.render();

          // load info for positioning in coordinate system of render (this could maybe be done a better way)
          window_center = render.point(window.innerWidth/2, window.innerHeight/2);
          // console.log(render.width(), render.height()); // result: 0, 0

          // position mrna at center of window
          render.move(
            window_center.x - mrna_size.w/2,
            window_center.y - mrna_size.h/2
          );

          break;
        // all other molecules: not positioned & not visible
        default:
          render = instance.render();
          render.opacity(0);
          break;
      }

      // sync internal representations of location & opacity to current attributes of render
      // - internal representations must be stored & must be updated as animations
      //   are scheduled, since the attributes of the actual render will change as
      //   the animation plays (ie. will not be current at the point of scheduling)
      // - we sync this information here before starting to schedule animations
      instance.sync_svg_location();
      instance.sync_opacity();

      // initialize animator
      // todo: this should probably not be exposed here, try to move into core
      instance.animator = render.animate(1, 0, "absolute");
}

// --- animation scheduling ---
// loop over firings to schedule corresponding animations
// current framework:
// - molecules can be fixed (permanent), fixed through bonds (temporary), or not fixed in any way
// - molecules are only visible (opacity 1) when fixed / fixed through bonds
// - operations handled:
// -- DeleteBond:
// --- animation only occurs when a molecule loses fixed through bonds status
// --- animation: move (to top/bottom edge of window) & opacity change (to 0)
// -- AddBond:
// --- animation only occurs when a molecule that is not fixed binds to a molecule
//     that is fixed / fixed through bonds & thus gains fixed through bonds status
// --- animation: move (to align with "fixed" molecule) & opacity change (to 1)
// -- "MoveBond":
// --- represents/replaces pair of DeleteBond & AddBond which operate on the same 2 molecules
// --- handles case where DeleteBond should not be animated (because the molecules involved
//     will still be fixed through bonds after all operations in the firing have been applied)
//     and AddBond should be animated with move but not opacity change (...)
// -- StateChange:
// --- ...
for (const firing of firings) {
  let props = firing["props"];
  // let reaction_name = props[0];
  let time = props[2];
  let ops = firing["ops"]; // list of operations in firing

  // create a copy of the operation list w/ MoveBond replacements as needed
  // - this for loop currently only catches the case where DeleteBond is followed
  //   immediately by a corresponding AddBond; doesn't correctly handle reactions
  //   such as scan_from_scan_collision where there's another operation in between
  // - what amounts/orderings of operations (in one firing) should this be able to handle?
  let modified_op_list = [];
  for (let i = 0; i < ops.length; i++) {
    if (ops[i][0] == "DeleteBond") {
      if (i < ops.length - 1 && ops[i+1][0] == "AddBond") {
        if (ops[i][1] == ops[i+1][1] && ops[i][3] == ops[i+1][3]) {
          modified_op_list.push(["MoveBond"].concat(ops[i+1].slice(1)));
          i++;
          continue;
        }
      }
    }
    modified_op_list.push(ops[i]);
  }
  // events with same name should have same structure --> can be "compiled" in advance

  for (const op of ops) {
    // parse operation
    let operation = new core.Operation(op[0], op.slice(1), sys);
    
    // todo: handle MoveBond
    // - currently cannot be parsed & applied the same way as a regular operation

    // store any useful information about the previous state (before operation is applied)
    let previous_state_info = {};

    let inst_1;
    let inst_2;

    // todo: write comment explaining why this is here (addbond/deletebond issue)
    // - if this isn't recorded here but rather checked after the operation has been applied,
    //   it will for example be the same for both molecules involved in addbond
    if (operation.mol_1_index != null) {
      inst_1 = sys.full_state[operation.mol_1_index];

      previous_state_info.mol_1_fixed_through_bonds = inst_1.is_fixed_through_bonds();
    }
    if (operation.mol_2_index != null) {
      inst_2 = sys.full_state[operation.mol_2_index];

      previous_state_info.mol_2_fixed_through_bonds = inst_2.is_fixed_through_bonds();
    }

    // apply operation
    operation.apply(sys.full_state);
    
    // there is a tradeoff between smoothness and accuracy of the animation;
    // longer durations (ie. smoother animations) can (depending on spacing
    // of firings) create overlap between events involving the same actor &
    // cause animations to be cut short, which leads to misaligned molecules
    let duration = 1;
    let time_multiplier = 150;
    let slow_duration = 500; // used when overlap of events is not much of a risk
    // these settings provide a decently accurate (though very jumpy) animation

    // note: custom animations for smoothing scan_to_elongate have been removed

    // schedule animations based on operation type & relevant info about molecules involved
    switch(operation.type) {
      case "DeleteBond":
        // todo: make animate_move_off_screen() recursive
        if (previous_state_info.mol_1_fixed_through_bonds && !inst_1.is_fixed_through_bonds()) {
          animate_move_off_screen(
            inst_1,
            time*time_multiplier,
            slow_duration
          );
          animate_opacity(
            inst_1,
            0,
            time*time_multiplier,
            slow_duration
          );
        } // else if? can both of these be true?
        if (previous_state_info.mol_2_fixed_through_bonds && !inst_2.is_fixed_through_bonds()) {
          animate_move_off_screen(
            inst_2,
            time*time_multiplier,
            slow_duration
          );
          animate_opacity(
            inst_2,
            0,
            time*time_multiplier,
            slow_duration
          );
        }
        // right now this checks fixed through bonds status after the current operation
        // has been applied, not at the end of the entire firing; movebond addresses one
        // situation where this animation should not be applied, but maybe not all (?)
        // - what if a molecule is involved in a deletebond & addbond with 2 distinct bond partners?
        break;
      case "AddBond":
        if (previous_state_info.mol_1_fixed_through_bonds && !previous_state_info.mol_2_fixed_through_bonds) {
          recursive_opacity(
            inst_2,
            1,
            time*time_multiplier,
            duration
          );
        } else if (!previous_state_info.mol_1_fixed_through_bonds && previous_state_info.mol_2_fixed_through_bonds) {
          recursive_opacity(
            inst_1,
            1,
            time*time_multiplier,
            duration
          );
        } else {
          // no animation
        }
      case "MoveBond":
        if (previous_state_info.mol_1_fixed_through_bonds && !previous_state_info.mol_2_fixed_through_bonds) {
          recursive_animate_move(
            inst_2.component_by_id[operation.comp_2_index],
            inst_1.component_by_id[operation.comp_1_index],
            time*time_multiplier,
            duration
          );
        } else if (!previous_state_info.mol_1_fixed_through_bonds && previous_state_info.mol_2_fixed_through_bonds) {
          recursive_animate_move(
            inst_1.component_by_id[operation.comp_1_index],
            inst_2.component_by_id[operation.comp_2_index],
            time*time_multiplier,
            duration
          );
        } else {
          // no animation
        }
        break;
      case "StateChange":
        // todo: test with a visible component
        let component = inst_1.component_by_id[operation.comp_1_index];
        let prev_state = component.get_state_by_id(component.prev_state_id);
        let curr_state = component.current_state;
        if (component.prev_state_id != component.curr_state_id) {
          animate_state_opacity(
            prev_state,
            0,
            time*time_multiplier,
            duration
          );
          animate_state_opacity(
            curr_state,
            1,
            time*time_multiplier,
            duration
          );
        }
        break;
      default:
        break;
    }
  }
}

console.log("--Animation initialized--");

// --- animation playback ---
// pause animation by default
sys.timeline.pause();
// user can press p to play animation
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

// --- animation utilities ---
// todo: put the following block of animation functions somewhere, maybe in a class or something
// todo: improve these (correctness, efficiency, structure)

function animate_move(molecule, x, y, time, duration) {
  // update x,y for molecule and its components, then schedule animation
  if (x != null && y != null) {
    molecule.x = x;
    molecule.y = y;
    for (const component of Object.values(molecule.components)) {
      component.x = molecule.x + component.pos[0];
      component.y = molecule.y + component.pos[1];
    }
    // move in x,y
    molecule.animator = molecule.animator.animate({
      duration: duration,
      delay: time,
      when: "absolute"
    }).move(x, y);
  } else if (x != null) {
    molecule.x = x;
    for (const component of Object.values(molecule.components)) {
      component.x = molecule.x + component.pos[0];
    }
    // move only in x
    molecule.animator = molecule.animator.animate({
      duration: duration,
      delay: time,
      when: "absolute"
    }).x(x);
  } else if (y != null) {
    molecule.y = y;
    for (const component of Object.values(molecule.components)) {
      component.y = molecule.y + component.pos[1];
    }
    // move only in y
    molecule.animator = molecule.animator.animate({
      duration: duration,
      delay: time,
      when: "absolute"
    }).y(y);
  }
}

function animate_opacity(molecule, opacity, time, duration) {
  molecule.opacity = opacity;
  molecule.animator = molecule.animator.animate({
    duration: duration,
    delay: time,
    when: "absolute"
  }).opacity(opacity);
}

function animate_state_opacity(state, opacity, time, duration) {
  state.render.animate({
    duration: duration,
    delay: time,
    when: "absolute"
  }).opacity(opacity);
}

// get the y coordinate to which a molecule needs to move
// so that the given component on that molecule appears to
// have a bond to the given component on a fixed molecule
function get_next_y(moving_component, fixed_component) {
  let y = fixed_component.parent.y; // does it make sense to do this as opposed to the component y?
  // todo: think about how exactly things should be placed relative to one another
  // - based on molecule boundary? component boundary?

  let offset = 100;
  // should offset magnitude be constant or depend on the molecules involved?

  let fixed_molecule_height = fixed_component.parent.molecule_type.symbol.node.firstChild.height.baseVal.value;
  let moving_molecule_height = moving_component.parent.molecule_type.symbol.node.firstChild.height.baseVal.value;
  // - is there a better way to do this?
  // - does this require us to assume no resizing?
  
  // the following does not currently take into account where fixed_component is on its molecule
  let direction;
  if (moving_molecule_height/2 - moving_component.pos[1] > 0) {
    // moving_component is at top of molecule, positive offset (positioned under fixed molecule)
    direction = 1;
    offset += fixed_molecule_height;
  }
  else {
    // moving_component is at bottom of molecule, negative offset (positioned above fixed molecule)
    direction = -1;
    offset += moving_molecule_height;
  }
  offset *= direction;

  return y + offset;
}

// recursively calculate & schedule animations for a given molecule and all (non-fixed) molecules bound to it
// - moving component on moving molecule is moved to match up with fixed component (on fixed molecule)
function recursive_animate_move_util(finished, moving_component, fixed_component, time, duration) {
  let moving_molecule = moving_component.parent;

  // first schedule animation for moving molecule (this updates its x,y before anything else uses that info)
  animate_move(
    moving_molecule,
    fixed_component.x,
    get_next_y(moving_component, fixed_component),
    time,
    duration
  );

  finished.add(moving_molecule);

  // then schedule animations for all molecules which are bound to (ie. should move with) the given moving molecule
  // - filter out molecules which should be kept fixed
  let bond_keys = Object.keys(moving_molecule.bonds).filter((tuple) => !((sys.full_state[tuple.split(',')[0]]).fixed));
  for (const bond_key of bond_keys) {
    let moving_component = moving_molecule.bonds[bond_key]; // component on a bond partner of previously moving (now fixed) molecule
    let fixed_component = Object.values(moving_component.bonds)[0]; // component on previously moving (now fixed) molecule
    // - will a component's bonds dictionary ever contain more than one k,v pair at a time?

    if (!finished.has(moving_component.parent)) {
      recursive_animate_move_util(finished, moving_component, fixed_component, time, duration);
    }
  }
}
function recursive_animate_move(moving_component, fixed_component, time, duration) {
  let finished = new Set();
  finished.add(fixed_component.parent);
  recursive_animate_move_util(finished, moving_component, fixed_component, time, duration);
}

// todo: check whether this is going through mrna
function recursive_opacity_util(finished, molecule, opacity, time, duration) {
  if (molecule.opacity != opacity) {
    animate_opacity(
      molecule,
      opacity,
      time,
      duration
    );
  }
  finished.add(molecule);
  for (const bond_key of Object.keys(molecule.bonds)) {
    let next_molecule = molecule.bonds[bond_key].parent;
    if (!finished.has(next_molecule)) {
      recursive_opacity_util(finished, next_molecule, opacity, time, duration);
    }
  }
}
function recursive_opacity(molecule, opacity, time, duration) {
  let finished = new Set();
  recursive_opacity_util(finished, molecule, opacity, time, duration);
}

function animate_move_off_screen(molecule, time, duration) {
  let y;

  // determine closest edge (currently not exact, but matches mrna position)
  if (molecule.y < window_center.y - mrna_size.h/2) {
    y = 0;
  } else {
    y = 2*window_center.y;
  }

  animate_move(
    molecule,
    null,
    y,
    time,
    duration
  );
}