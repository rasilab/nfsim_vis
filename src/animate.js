import * as core from "./core.js";

console.log("starting");

// core system initialization, async
let settings = new core.Settings("../complex_vis/complex_vis_settings.json", "../complex_vis/complex_log.json");
// await settings.initialize();
await settings.parse_settings_file();
let sys = settings.system;

// load log
let log_file = "../complex_vis/complex_log.json";
let log_obj = await fetch(log_file).then((log) => log.json());
console.log("done fetching log");
let firings = log_obj["simulation"]["firings"];
// let firings = sys.events;

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
  if (typeID == -1) {
    for (let i = 0; i < number; i++) {
      index++;
    }
  }
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
      switch(name) {
        case "mrna":
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
          break;

        // todo: fix the cases where something can't be positioned because it was loaded before mrna
        case "lsu":
          if (window_center != undefined && mrna_size != undefined) {
            render.center(0, window_center.y + 2*mrna_size.h);
          }
          render.opacity(0);
          break;
        case "ssu":
          if (window_center != undefined && mrna_size != undefined) {
            render.center(0, window_center.y - 2*mrna_size.h);
          }
          render.opacity(0);
          break;
        case "tc":
          if (window_center != undefined && mrna_size != undefined) {
            render.center(0, window_center.y - mrna_size.h);
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
      instance.animator = render.animate(1, 0, "absolute");
    }
    
  }
}

// note that movement of ribosomes between positions on the mrna
// is hard-coded based on the width of the mrna svg and number of
// positions, not tied to the actual given pos of the components
let ribosome_movement = mrna_size.w / (mrna_positions.length - 1);

// we need to (loosely, just enough for animation) keep track of what is bound to what
let ssu_bonds = {};
// also keep track of how far each ssu has moved along the mrna
let ssu_movement = {};

for (const molecule_index of Object.keys(state)) {
  if (state[molecule_index].name == "ssu") {
    ssu_bonds[molecule_index] = {
      tc: undefined,
      lsu: undefined
    };
    ssu_movement[molecule_index] = 0;
  }
}

// iterate over firings and schedule animations
for (const firing of firings) {
  let props = firing["props"];
  let reaction_name = props[0];
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
        break;
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
    let duration = 1; // 100;
    let time_multiplier = 500; // 1000;

    let slow_duration = 500; // so that we can see some animations more clearly (when overlap isn't much of a risk)

    // the following code relies on assumptions about indices as well as
    // relationships between reactions, operations, and desired animations

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

    switch(reaction_name) {
      // note: this is not complete by any means. also need to double check my interpretations of operations.
      case "tc_free_ssu_binding":
        // this reaction consists of ops: AddBond
        // - tc binds to an ssu (not on mRNA) not bound by a large subunit; this is required for cap binding
        // AddBond: ssu, tcsite, tc, ssusite

        // use AddBond as representative operation
        switch(op_name) {
          case "AddBond":
            // for our records
            ssu_bonds[mol_1_index].tc = mol_2_index;

            // ssu and tc: opacity 1, move together to somewhere around but not at left edge of mrna

            inst_1.animator = inst_1.animator.animate({
              duration: duration,
              delay: time*time_multiplier,
              when: "absolute"
            }).center(
              300,
              window_center.y - 5*mrna_size.h
            ).opacity(1);

            inst_2.animator = inst_2.animator.animate({
              duration: duration,
              delay: time*time_multiplier,
              when: "absolute"
            }).center(
              300,
              window_center.y - 4*mrna_size.h
            ).opacity(1);

            break;
          default:
            break;
        }
        break;
      case "bind_cap_pic":
        // this reaction consists of ops: AddBond, StateChange
        // - PIC binds to mRNA and blocks subsequent PICs from binding by blocking the 5' end
        // AddBond: ssu, asite, mrna, pos
        // StateChange: mrna, end5, blocked

        // use AddBond as representative operation
        switch(op_name) {
          case "AddBond":
            // ssu and tc: move together to left edge of mrna

            inst_1.animator = inst_1.animator.animate({
              duration: duration,
              delay: time*time_multiplier,
              when: "absolute"
            }).center(
              window_center.x - mrna_size.w/2,
              window_center.y - 2*mrna_size.h
            );

            let tc_index = ssu_bonds[mol_1_index].tc;
            let tc_inst = state[tc_index];

            tc_inst.animator = tc_inst.animator.animate({
              duration: duration,
              delay: time*time_multiplier,
              when: "absolute"
            }).center(
              window_center.x - mrna_size.w/2,
              window_center.y - mrna_size.h
            );

            break;
          default:
            break;
        }
        break;
      case "scan":
        // this reaction consists of ops: StateChange, DeleteBond, AddBond
        // - PIC scans from mRNA pos to pos+1
        // StateChange: ssu, terminating, no
        // DeleteBond: ssu, asite, mrna, pos
        // AddBond: ssu, asite, mrna, pos+1

        // use AddBond as representative operation
        switch(op_name) {
          case "AddBond":
            // for our records
            ssu_movement[mol_1_index] += ribosome_movement;

            // ssu and tc: move x to next position along mrna

            inst_1.animator = inst_1.animator.animate({
              duration: duration,
              delay: time*time_multiplier,
              when: "absolute"
            }).dx(ribosome_movement);

            let tc_index = ssu_bonds[mol_1_index].tc;
            let tc_inst = state[tc_index];

            tc_inst.animator = tc_inst.animator.animate({
              duration: duration,
              delay: time*time_multiplier,
              when: "absolute"
            }).dx(ribosome_movement);

            break;
          default:
            break;
        }
        break;
      case "scan_to_elongate":
        // this reaction consists of ops: DeleteBond, AddBond
        // - convert scanning ribosomes at pos to elongating ribosomes at newpos
        // - not actually seeing or accounting for position change right now. how does that work?
        // DeleteBond: ssu, tcsite, tc, ssusite
        // AddBond: ssu, isbi, lsu, isbi

        // use both DeleteBond and AddBond
        switch(op_name) {
          case "DeleteBond":
            // for our records
            ssu_bonds[mol_1_index].tc = undefined;

            // tc: opacity 0, move to top edge of screen

            inst_2.animator = inst_2.animator.animate({
              duration: slow_duration, // can be slower than other events
              delay: time*time_multiplier,
              when: "absolute"
            }).dy(-window_center.y).opacity(0);

            break;
          case "AddBond":
            // for our records
            ssu_bonds[mol_1_index].lsu = mol_2_index;

            // lsu: opacity 1, move to where ssu is

            // pre-position: x under the ssu, y at bottom edge of screen
            inst_2.animator = inst_2.animator.animate({
              duration: duration,
              delay: time*time_multiplier - slow_duration - duration, // is this okay to do?
              when: "absolute"
            }).center(
              window_center.x - mrna_size.w/2 + ssu_movement[mol_1_index],
              2*window_center.y
            );

            // move y to just under mrna
            // - this is tricky. not sure if it's possible to make the animation
            // visible/smooth without causing misalignment between the ssu and lsu
            // - currently handling this by scheduling longer-duration animations earlier, so that
            // they end by the time of the reaction firing. but this brings up some questions about
            // how animation start and end times should be handled in general.
            inst_2.animator = inst_2.animator.animate({
              duration: slow_duration,
              delay: time*time_multiplier - slow_duration,
              when: "absolute"
            }).center(
              window_center.x - mrna_size.w/2 + ssu_movement[mol_1_index],
              window_center.y + 2*mrna_size.h
            ).opacity(1);

            break;
          default:
            break;
        }
        break;
      case "elongate":
        // this reaction consists of ops: DeleteBond, AddBond
        // - 80S moves from mRNA pos to pos+3
        // DeleteBond: ssu, asite, mrna, pos
        // AddBond: ssu, asite, mrna, pos+3

        // use AddBond as representative operation
        switch(op_name) {
          case "AddBond":
            // for our records
            ssu_movement[mol_1_index] += 3*ribosome_movement;

            // ssu and lsu: move x to next position along mrna

            inst_1.animator = inst_1.animator.animate({
              duration: duration,
              delay: time*time_multiplier,
              when: "absolute"
            }).dx(3*ribosome_movement);

            let lsu_index = ssu_bonds[mol_1_index].lsu;
            let lsu_inst = state[lsu_index];

            lsu_inst.animator = lsu_inst.animator.animate({
              duration: duration,
              delay: time*time_multiplier,
              when: "absolute"
            }).dx(3*ribosome_movement);

            break;
          default:
            break;
        }
        break;
      case "terminate":
        // this reaction consists of ops: StateChange, DeleteBond
        // - terminate at pos by leaving of the large subunit
        // StateChange: ssu, terminating, yes
        // DeleteBond: ssu, isbi, lsu, isbi

        // use DeleteBond as representative operation
        switch(op_name) {
          case "DeleteBond":
            // for our records
            ssu_bonds[mol_1_index].lsu = undefined;

            // lsu: opacity 0, move to bottom edge of screen

            inst_2.animator = inst_2.animator.animate({
              duration: slow_duration, // can be slower than other events
              delay: time*time_multiplier,
              when: "absolute"
            }).dy(window_center.y).opacity(0);

            break;
          default:
            break;
        }
        break;
      case "recycle":
        // this reaction consists of ops: StateChange, DeleteBond
        // - ssu on mRNA after termination without large subunit is recycled to the free ssu pool
        // StateChange: ssu, terminating, no
        // DeleteBond: ssu, asite, mrna, pos

        // use DeleteBond as representative operation
        switch(op_name) {
          case "DeleteBond":
            // for our records
            ssu_movement[mol_1_index] = 0;

            // ssu: opacity 0, move to top edge of screen

            inst_1.animator = inst_1.animator.animate({
              duration: slow_duration, // can be slower than other events
              delay: time*time_multiplier,
              when: "absolute"
            }).dy(-window_center.y).opacity(0);

            break;
          default:
            break;
        }
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