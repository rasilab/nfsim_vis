import * as core from "./core.js";

// core system initialization
let settings = new core.Settings("../complex_vis/complex_vis_settings.json", "../complex_vis/complex_log_1000.json");
await settings.initialize();
let sys = settings.system;
let firings = sys.events; // event log

// some info for positioning things
let window_center;
let mrna_size = {w: 6000, h: 200};
// this needs to not be hardcoded, but there seems to be something weird about getting width/height of a nested group
// which seems especially annoying if we want to move things by their upper left corners (in the interest of consistency)

let fixed_molecules = new Set(); // ids of all molecules which should not move in animation

// initial rendering
for (const mol_id of Object.keys(sys.full_state)) {
  let mol_instance = sys.full_state[mol_id];
  // first find and process mrna
  if (mol_instance.name == "mrna") {
    let mrna_positions = Object.keys(mol_instance.components).slice(1);
    for (let i = 0; i<mrna_positions.length; i++) {
      // spread out nt component positions
      let component = mol_instance.components[mrna_positions[i]];
      component.pos[0] += (mrna_size.w / mrna_positions.length) * i;
    }

    fixed_molecules.add(mol_id);
  }
}
for (const instance of Object.values(sys.full_state)) {
      let render = instance.render();
      
      // now set up initial appearance for all molecules
      // - mrna: opacity 1; x,y centered in window
      // - ribosomes: opacity 0; x at left edge; y above mrna
      switch(instance.name) {
        case "mrna":
          // load info for positioning here (using render) - maybe this can be done a better way
          window_center = render.point(window.innerWidth/2, window.innerHeight/2);

          // console.log(render.width(), render.height()); // result: 0, 0

          render.move(
            window_center.x - mrna_size.w/2,
            window_center.y - mrna_size.h/2
          ); // place mrna
          break;

        // the following might be unnecessary if these are moved later anyway
        case "lsu":
          if (window_center != undefined && mrna_size != undefined) {
            render.move(0, window_center.y + mrna_size.h);
          }
          render.opacity(0);
          break;
        case "ssu":
          if (window_center != undefined && mrna_size != undefined) {
            render.move(0, window_center.y - 3.5*mrna_size.h);
          }
          render.opacity(0);
          break;
        case "tc":
          if (window_center != undefined && mrna_size != undefined) {
            render.move(0, window_center.y - 2.5*mrna_size.h);
          }
          render.opacity(0);
          break;

        case "ribosome": // for basic model
          if (window_center != undefined && mrna_size != undefined) {
            render.center(0, window_center.y - 2*mrna_size.h); // place ribosome
            // todo: maybe figure out a better / more logical y position
            // - currently all positioning calculations are done based on
            // the size of mrna svg alone, ribosome svg is not considered
          }
          render.opacity(0); // hide ribosome for now
          break;
      }
      // sync locations 
      instance.sync_svg_location();
      // initialize animator
      // - this is probably not something that should be left for the user to do
      instance.animator = render.animate(1, 0, "absolute");
}

// iterate over firings and schedule animations
for (const firing of firings) {
  let props = firing["props"];
  let reaction_name = props[0];
  let time = props[2];
  let ops = firing["ops"];

  // todo:
  // - loop over & copy operations into a new list
  // - when deletebond & addbond act on the same 2 molecules, replace these with a movebond operation

  // issue: need to distinguish between cases (1) and (2) of DeleteBond
  // 1) molecule(s) involved no longer have any bonds and should leave screen
  // 2) molecule(s) involved still have >0 bonds and should stay where they are
  // so, before animations are scheduled, there needs to be a way to check
  // whether any bonds remain after all operations have been applied (since,
  // for example, a firing could contain a DeleteBond followed by an AddBond)
  // and this might require some setup here

  /*
  // option 1: make a copy of full_state and apply all operations to it
  let full_state_copy = structuredClone(sys.full_state);
  // using the JS function structuredClone() for creating a deep copy of an object
  // - Uncaught DOMException: Failed to execute 'structuredClone'
  //   on 'Window': SVGSVGElement object could not be cloned.
  // - I don't know if there's a straightforward way of making a deep copy here.
  //   seems like functions (in addition to SVGs, apparently) are not something
  //   that can be cloned by structuredClone(), which presents an issue because we
  //   need access to Molecule.add_bond()/remove_bond(), etc. in operation.apply().
  //   I couldn't find any other built-in deep copy utilities that seem any better.
  for (const op of ops) {
    let operation = new core.Operation(op[0], op.slice(1), sys);
    operation.apply(full_state_copy);
  }
  */

  /*
  // option 2: reorder operations to put AddBond before DeleteBond (no other changes)
  function compareOps(a, b) {
    if (a[0] == "AddBond" && b[0] == "DeleteBond") {
      return -1;
    } else if (a[0] == "DeleteBond" && b[0] == "AddBond") {
      return 1;
    } else {
      return 0;
    }
  }
  ops.sort(compareOps);
  // this is making recycle & scan_terminate_no_hit_tc_ejects reactions
  // fail to apply DeleteBond operation. specifically, seems like the mrna
  // molecule (maybe its components also, but it fails before that is attempted)
  // can't find the target tuple key. my theory as to why this is happening:
  // - these 2 reactions involve mrna trying to delete from its bonds dictionary a
  //   tuple (key) which is now being deleted in a previous reaction (eg. elongate)
  // - this key is deleted in a previous reaction that includes both a DeleteBond
  //   and an AddBond which act on the same non-mrna molecule & component (ie. have
  //   the same target tuple) and are re-ordered so DeleteBond comes after AddBond,
  //   deleting that tuple from the mrna's bonds dictionary right after it is added
  */

  for (const op of ops) {
    // parse and apply operation
    let operation = new core.Operation(op[0], op.slice(1), sys);
    operation.apply(sys.full_state);
    // are there any scenarios in which it would be useful to know the previous state?

    // schedule corresponding animation

    let inst_1;
    let inst_2;

    if (operation.mol_1_index != null) {
      inst_1 = sys.full_state[operation.mol_1_index];
    }
    if (operation.mol_2_index != null) {
      inst_2 = sys.full_state[operation.mol_2_index];
    }

    // where does it make sense to set opacity of actors?
    
    // figure out how exactly to handle timing to make animation smooth
    // while also avoiding overlap between the end of one event and the
    // beginning of the next (depends on duration & spacing of firings)
    // - specifically overlap between events on the same actor, not sure
    // if this is an issue for events on different actors (probaby not?)
    let duration = 1; // 100;
    let time_multiplier = 150; // 500, 1000;

    let slow_duration = 500; // so that we can see some animations more clearly (when overlap isn't much of a risk)

    // get generic reaction name (can probably make this better)
    // - order is important here (prefixes)
    if (reaction_name.startsWith("bind_cap_pic")) reaction_name = "bind_cap_pic";
    else if (reaction_name.startsWith("scan_from_scan_collision")) reaction_name = "scan_from_scan_collision";
    else if (reaction_name.startsWith("scan_from_elongation_collision")) reaction_name = "scan_from_elongation_collision";
    else if (reaction_name.startsWith("scan_terminate_from_collision_both_hit_elongating_elongating_tc_ejects")) reaction_name = "scan_terminate_from_collision_both_hit_elongating_elongating_tc_ejects";
    else if (reaction_name.startsWith("scan_terminate_from_collision_both_hit_elongating_scanning_tc_ejects")) reaction_name = "scan_terminate_from_collision_both_hit_elongating_scanning_tc_ejects";
    else if (reaction_name.startsWith("scan_terminate_from_collision_both_hit_scanning_elongating_tc_ejects")) reaction_name = "scan_terminate_from_collision_both_hit_scanning_elongating_tc_ejects";
    else if (reaction_name.startsWith("scan_terminate_from_collision_both_hit_scanning_scanning_tc_ejects")) reaction_name = "scan_terminate_from_collision_both_hit_scanning_scanning_tc_ejects";
    else if (reaction_name.startsWith("scan_terminate_from_collision_both_hit_elongating_elongating")) reaction_name = "scan_terminate_from_collision_both_hit_elongating_elongating";
    else if (reaction_name.startsWith("scan_terminate_from_collision_both_hit_elongating_scanning")) reaction_name = "scan_terminate_from_collision_both_hit_elongating_scanning";
    else if (reaction_name.startsWith("scan_terminate_from_collision_both_hit_scanning_elongating")) reaction_name = "scan_terminate_from_collision_both_hit_scanning_elongating";
    else if (reaction_name.startsWith("scan_terminate_from_collision_both_hit_scanning_scanning")) reaction_name = "scan_terminate_from_collision_both_hit_scanning_scanning";
    else if (reaction_name.startsWith("scan_terminate_no_hit_tc_ejects")) reaction_name = "scan_terminate_no_hit_tc_ejects";
    else if (reaction_name.startsWith("scan_terminate_no_hit")) reaction_name = "scan_terminate_no_hit";
    else if (reaction_name.startsWith("scan_terminate_from_elongation_collision_5_hit_tc_ejects")) reaction_name = "scan_terminate_from_elongation_collision_5_hit_tc_ejects";
    else if (reaction_name.startsWith("scan_terminate_from_elongation_collision_5_hit")) reaction_name = "scan_terminate_from_elongation_collision_5_hit";
    else if (reaction_name.startsWith("scan_terminate_from_scan_collision_5_hit_tc_ejects")) reaction_name = "scan_terminate_from_scan_collision_5_hit_tc_ejects";
    else if (reaction_name.startsWith("scan_terminate_from_scan_collision_5_hit")) reaction_name = "scan_terminate_from_scan_collision_5_hit";
    else if (reaction_name.startsWith("scan_terminate_from_elongation_collision_3_hit_tc_ejects")) reaction_name = "scan_terminate_from_elongation_collision_3_hit_tc_ejects";
    else if (reaction_name.startsWith("scan_terminate_from_elongation_collision_3_hit")) reaction_name = "scan_terminate_from_elongation_collision_3_hit";
    else if (reaction_name.startsWith("scan_terminate_from_scan_collision_3_hit_tc_ejects")) reaction_name = "scan_terminate_from_scan_collision_3_hit_tc_ejects";
    else if (reaction_name.startsWith("scan_terminate_from_scan_collision_3_hit")) reaction_name = "scan_terminate_from_scan_collision_3_hit";
    else if (reaction_name.startsWith("backward_scan_from_scan_collision")) reaction_name = "backward_scan_from_scan_collision";
    else if (reaction_name.startsWith("backward_scan_from_elongation_collision")) reaction_name = "backward_scan_from_elongation_collision";
    else if (reaction_name.startsWith("backward_scan")) reaction_name = "backward_scan";
    else if (reaction_name.startsWith("scan_to_elongate_from_leading_collision")) reaction_name = "scan_to_elongate_from_leading_collision";
    else if (reaction_name.startsWith("scan_to_elongate_from_trailing_scan_collision")) reaction_name = "scan_to_elongate_from_trailing_scan_collision";
    else if (reaction_name.startsWith("scan_to_elongate_from_trailing_elongation_collision")) reaction_name = "scan_to_elongate_from_trailing_elongation_collision";
    else if (reaction_name.startsWith("scan_to_elongate")) reaction_name = "scan_to_elongate";
    else if (reaction_name.startsWith("scan")) reaction_name = "scan";    
    else if (reaction_name.startsWith("elongate_from_scan_collision")) reaction_name = "elongate_from_scan_collision";
    else if (reaction_name.startsWith("elongate_from_elongation_collision")) reaction_name = "elongate_from_elongation_collision";
    else if (reaction_name.startsWith("elongate")) reaction_name = "elongate";
    else if (reaction_name.startsWith("terminate")) reaction_name = "terminate";
    else if (reaction_name.startsWith("recycle_from_leading_collision")) reaction_name = "recycle_from_leading_collision";
    else if (reaction_name.startsWith("recycle_from_trailing_collision")) reaction_name = "recycle_from_trailing_collision";
    else if (reaction_name.startsWith("recycle_from_both_collision")) reaction_name = "recycle_from_both_collision";
    else if (reaction_name.startsWith("recycle")) reaction_name = "recycle";
    else if (reaction_name.startsWith("collide_upon_scanning")) reaction_name = "collide_upon_scanning";
    else if (reaction_name.startsWith("collide_upon_elongation")) reaction_name = "collide_upon_elongation";
    else if (reaction_name.startsWith("collide_upon_backward_scanning")) reaction_name = "collide_upon_backward_scanning";
    else if (reaction_name.startsWith("elong_preterm_no_hit")) reaction_name = "elong_preterm_no_hit";
    // is this the full set of reactions to consider?

    switch(operation.type) {
      // todo: handle movebond
      // - no opacity changes (both molecules should already have the desired opacity)
      // - call recursive_animate_move() as in addbond (is anything different?)

      case "AddBond":
        // todo: generalize opacity changes
        // - make molecules visible only upon binding to a molecule that is fixed / connected to fixed
        // - keep track of opacity like x,y in full_state

        let mol_1_fixed = fixed_molecules.has(String(operation.mol_1_index));
        let mol_2_fixed = fixed_molecules.has(String(operation.mol_2_index));
        
        if (mol_1_fixed && !mol_2_fixed) {
          recursive_animate_move(
            inst_2.component_by_id[operation.comp_2_index],
            inst_1.component_by_id[operation.comp_1_index],
            time*time_multiplier,
            duration
          );
        } else if (!mol_1_fixed && mol_2_fixed) {
          recursive_animate_move(
            inst_1.component_by_id[operation.comp_1_index],
            inst_2.component_by_id[operation.comp_2_index],
            time*time_multiplier,
            duration
          );
        } else if (!mol_1_fixed && !mol_2_fixed) {
          // todo: if neither is fixed, check if one is connected to a fixed molecule and use that as the fixed one
          // - implement everything needed to keep track of this
          // - think about cases where both are connected to a fixed molecule (eg. collide_upon_scanning)

          // move inst_1 according to reaction
          if (reaction_name == "tc_free_ssu_binding") {
            // move to hardcoded position
            animate_move(
              inst_1,
              300,
              window_center.y - 5*mrna_size.h,
              time*time_multiplier,
              duration
            );
          }
          else if (reaction_name == "scan_to_elongate") {
            // no need to move
          }
          
          // treat inst_1 as fixed and move inst_2 to match up with it
          recursive_animate_move(
            inst_2.component_by_id[operation.comp_2_index],
            inst_1.component_by_id[operation.comp_1_index],
            time*time_multiplier,
            duration
          );
        } else {
          // if both are fixed..? do nothing, I guess?
        }

        if (reaction_name == "tc_free_ssu_binding") {
          // ssu, tc
          animate_opacity(
            inst_1,
            1,
            time*time_multiplier,
            duration
          );
          animate_opacity(
            inst_2,
            1,
            time*time_multiplier,
            duration
          );
        }
        else if (reaction_name == "scan_to_elongate") {
          // lsu
          animate_opacity(
            inst_2,
            1,
            time*time_multiplier,
            duration
          );
        }

        // note: custom animations for smoothing scan_to_elongate have been removed

        break;
      case "DeleteBond":

        // molecules involved in DeleteBond
        let molecules = [
          [operation.mol_1_index, inst_1],
          [operation.mol_2_index, inst_2]
        ];

        // filter out molecules which should be kept fixed
        molecules = molecules.filter((element) => !(fixed_molecules.has(String(element[0]))));

        // filter out molecules which still have bonds
        molecules = molecules.filter((element) => Object.keys(element[1].bonds).length == 0);
        
        // for the remaining molecules (not fixed & no bonds left), schedule animations to leave screen
        for (const element of molecules) {
          let mol_inst = element[1];

          animate_move_off_screen(
            mol_inst,
            time*time_multiplier,
            slow_duration
          );
          animate_opacity(
            mol_inst,
            0,
            time*time_multiplier,
            slow_duration
          );
        }

        // right now this checks only whether bonds remain after the current operation
        // has been applied, not whether bonds remain at the end of the entire firing;
        // this approach seems to work here but probably has issues in the general case
        // (in scan, elongate, etc. the ssu is always bound to tc/lsu in addition to the
        // mrna, so the DeleteBond between ssu & mrna will not cause the ssu to leave)
        // - is this fully addressed by separate handling of movebond?
        
        break;
      default:
        break;
    }

    // can get rid of this block when no longer needed
    // ideally would not need to know/use reaction name
    switch(reaction_name) {
      // note: this is not complete by any means. also need to double check my interpretations of operations.
      case "tc_free_ssu_binding":
        // this reaction consists of ops: AddBond
        // - tc binds to an ssu (not on mRNA) not bound by a large subunit; this is required for cap binding
        // AddBond: ssu, tcsite, tc, ssusite
      case "bind_cap_pic":
        // this reaction consists of ops: AddBond, StateChange
        // - PIC binds to mRNA and blocks subsequent PICs from binding by blocking the 5' end
        // AddBond: ssu, asite, mrna, pos
        // StateChange: mrna, end5, blocked
      case "scan":  
        // this reaction consists of ops: StateChange, DeleteBond, AddBond
        // - PIC scans from mRNA pos to pos+1
        // StateChange: ssu, terminating, no
        // DeleteBond: ssu, asite, mrna, pos
        // AddBond: ssu, asite, mrna, pos+1
      case "scan_from_scan_collision":
        // this reaction consists of ops: StateChange, DeleteBond, DeleteBond, AddBond
        // StateChange: ssu, terminating, no
        // DeleteBond: ssu, asite, mrna, pos
        // DeleteBond: ssu, hit5, ssu, hit3
        // AddBond: ssu, asite, mrna, pos+1
      case "elongate":
        // this reaction consists of ops: DeleteBond, AddBond
        // - 80S moves from mRNA pos to pos+3
        // DeleteBond: ssu, asite, mrna, pos
        // AddBond: ssu, asite, mrna, pos+3
      case "scan_to_elongate":
        // this reaction consists of ops: DeleteBond, AddBond
        // - convert scanning ribosomes at pos to elongating ribosomes at newpos
        // - not actually seeing or accounting for position change right now. how does that work?
        // DeleteBond: ssu, tcsite, tc, ssusite
        // AddBond: ssu, isbi, lsu, isbi
      case "terminate":
        // this reaction consists of ops: StateChange, DeleteBond
        // - terminate at pos by leaving of the large subunit
        // StateChange: ssu, terminating, yes
        // DeleteBond: ssu, isbi, lsu, isbi        
      case "recycle":
        // this reaction consists of ops: StateChange, DeleteBond
        // - ssu on mRNA after termination without large subunit is recycled to the free ssu pool
        // StateChange: ssu, terminating, no
        // DeleteBond: ssu, asite, mrna, pos
      case "scan_terminate_no_hit_tc_ejects":
        // this reaction consists of ops: DeleteBond, DeleteBond
        // - scanning ribosome leaves mRNA, PIC must not be hit by a scanning/elongating ribosome, tc ejected
        // DeleteBond: ssu, asite, mrna, pos
        // DeleteBond: ssu, tcsite, tc, ssusite
      case "collide_upon_scanning":
        // this reaction consists of ops: AddBond
        // - PIC at pos collides with a scanning or elongating ribosome because its scanning is blocked
        // AddBond: ssu, hit3, ssu, hit5

        // how to represent this?
        break;
      default:
        console.log(reaction_name);
        break;
    }
// below code was for basic model
/*
    switch(op_name) {
      case "StateChange":
        // are components guaranteed to be ordered in such a way that this works?
        let component_name = Object.keys(inst_1.components)[comp_1_index];
        let component = inst_1.components[component_name];

        // animate opacity changes on component state renders
        // - duration of animation is currently 1 (basically instant), I think this looks cleaner than fading states in/out
        for (const state of component.states) {
          let state_render = state.render;
          if (state.id == comp_state_index) {
            // set opacity of new state to 1
            state_render.animate({
              duration: 1,
              delay: time*time_multiplier,
              when: "absolute"
            }).opacity(1);
          } else {
            // set opacity of all other states to 0
            if (state_render.opacity() != 0) {
              state_render.animate({
                duration: 1,
                delay: time*time_multiplier,
                when: "absolute"
              }).opacity(0);
            }
          }
        }
        // would probably be more efficient to avoid this loop, but I think this would require updating current state
        // - set opacity to 0 for old state (component.current_state)
        // - update current state of component to match comp_state_index (component.set_state_by_id(comp_state_index))
        // - set opacity to 1 for new state (component.current_state)
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
          break;
    }
*/
  }
}

console.log("finished processing firings");

// pause by default
sys.timeline.pause();

// press p to play
document.onkeydown = function (event) {
  if (event.key == "p") {
    sys.timeline.play();
  }
}

// todo: put the following block of animation functions somewhere, maybe in a class or something
// take an array of molecules? some sort of context?

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
  molecule.animator = molecule.animator.animate({
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

  let fixed_molecule_height = fixed_component.parent.symbol.node.firstChild.height.baseVal.value;
  let moving_molecule_height = moving_component.parent.symbol.node.firstChild.height.baseVal.value;
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
  let bond_keys = Object.keys(moving_molecule.bonds).filter((tuple) => !(fixed_molecules.has(tuple.split(',')[0])));
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