import * as core from "./vis_core.js";

// core system initialization, async
let settings = new core.Settings("vis_settings.json", "nika_log.json");
await settings.initialize();
console.log(settings);
// await settings.parse_settings_file();
let sys = settings.system;

let instances = {};
// only one instance of a molecule type can be active at a time

let all_molecule_types = Object.values(sys.actor_definitions);

let dropdown = document.getElementById("molec_dropdown");

// make molecule type buttons and add to dropdown list
for (const molecule_type of all_molecule_types) {
  let mol_type_button = document.createElement("button");
  mol_type_button.id = `${molecule_type.name}`;
  mol_type_button.innerText = `${molecule_type.name}`;
  mol_type_button.className = "contentbtn";

  mol_type_button.addEventListener("click", toggle_mol);

  dropdown.appendChild(mol_type_button);
}
// todo: make buttons less ugly (also probably get rid of component buttons in html/css)

// handle click on molecule type button
// - if already pressed ("active"), remove the existing instance
// - if not already pressed (not "active"), initialize an instance
// note: whether or not button is "active" depends only on click handling,
// not directly tied to whether instance of molecule type actually exists
function toggle_mol(event) {
  let mol_type_button = event.target;
  let name = mol_type_button.id;

  if (mol_type_button.classList.contains("active")) {
    remove_instance(name);
  } else {
    initialize_mol(name);
  }

  mol_type_button.classList.toggle("active");
}

// todo: figure out exactly how removing things works
function remove_instance(name) {
  remove_render(name);
  // remove instance, probably
  delete instances[name];
}

function remove_render(name) {
  instances[name].group.remove(); // removes render from DOM
  // todo: turn off event listeners, maybe? or somewhere else? is it necessary?
}

function initialize_mol(name) {
  let inst = sys.add_actor_from_name(name);

  // set default component states
  for (const component of Object.values(inst.components)) {
    component.set_state_by_id(0);
  }

  instances[name] = inst;
  inst.render();
  
  initial_placement(name);

  // make molecule draggable
  make_draggable(inst);

  // make components clickable
  initialize_component_listeners(inst);

  /*
  // testing remove - put this somewhere else
  // some interesting behavior here
  render.on('click', function () {
    remove_instance(name);
    console.log(instances[name]);
    instances[name].render();
    console.log(instances[name]);
  });
  */
}

// todo: figure out why some component state renders move away from rest of group
function make_draggable(inst) {
  let render = inst.group;
  let name = inst.name;

  render.on('mousedown', function () {
    render.on('mousemove', function (event) {
      let mouse_position = render.point(event); // convert to correct coordinate system
      place_render(name, mouse_position, null);
    });
  });
  render.on('mouseup', function () {
    render.off('mousemove');
  });

  // maybe having all these anonymous functions is not ideal
}

function initialize_component_listeners(inst) {
  for (const component of Object.values(inst.components)) {
    let current_render = component.current_render;
    current_render.on('click', next_state(inst, component));
  }
}

function next_state(inst, component) {
  // event listener callback only takes event as a parameter
  // this is a workaround to get inst, component also; might be bad/annoying
  // related to turning event listeners off / resetting them
  // https://stackoverflow.com/questions/55650739/how-to-remove-event-listener-with-currying-function
  return function handle_component_click(event) {
    // todo: switch to next state correctly

    // need to put new things in same positions as old things
    // (assuming full re-render is necessary)
    // this may not be the best way to do it
    let cx = inst.group.cx();
    let cy = inst.group.cy();
    let size = inst.group.width();

    remove_render(inst.name);
    inst.group = null; // I don't like this, figure out how removing things works
    component.next_state();
    inst.render();

    // messes up listeners attached to renders, so you can only do this once (I think)
    // I guess replacing the whole instance would fix this, but idk if that's a great solution
    // the following also fixes this, but idk if I like it either
    initialize_component_listeners(inst);
    make_draggable(inst);

    place_render(inst.name, {x: cx, y: cy}, size);
  }
}

function place_render(name, position, size) {
  let render = instances[name].group;

  if (size != null) {
    render.size(size);
  }

  if (position != null) {
    // positioning by center might not be ideal
    // dragging isn't smooth if initial click is not centered
    render.center(position.x, position.y);
  }
}

function initial_placement(name) {
  // todo: needs logic, should probably respect container size
  // (and not place molecules so close to edges that they get cut off)
  let rand_x = Math.random() * 4000;
  let rand_y = Math.random() * 4000;
  let position = {
    x: rand_x,
    y: rand_y
  };
  let size = 2000;

  place_render(name, position, size);
}

// --- old code + experiments ---
/*
// keep track of what we are currently showing
let current_instances = {};
let current_renders = {};

let current_render;
let current_inst;

function place_render(render, pos)  {
  let rand = Math.random() * 5000;
  // moves relative to current location
  if (pos) {
    render.move(pos.x, pos.y);
  } else {
    render.dmove(rand, 2000);
    // resizing, null allows for proportional resizing
    render.size(2000, null);
  }
}

function remove_render(name) {
  let render = current_renders[name];
  if (render != null) {
    render.remove();
    current_renders[name] = null;
  }
}

// add dropdown functionality
var x = document.getElementById("molec_dropdown");
for (let i=0;i<Object.keys(sys.actor_definitions).length;i++) {
  let defn = sys.actor_definitions[Object.keys(sys.actor_definitions)[i]];
  var mol_el = document.createElement("button");
  mol_el.id = `${defn['@id']}`;
  mol_el.innerText = `${defn["@id"]}`;
  mol_el.className = "contentbtn";
  // event listener for rendering molecule
  mol_el.addEventListener("click", ()=>{
    // remove previous buttons
    document.getElementById("compbuttons").innerHTML = "";
    // /*
    if (current_render!=null) {
      console.log(`removing previous render`)
      current_render.remove();
    }
    // * /

    // clean up previous renders
    for (let q=0; q<Object.keys(current_renders).length; q++) {
      let name = Object.keys(current_renders)[q];
      remove_render(name);
    }
    
    console.log(`rendering: ${defn.name}`); // old
    console.log(`rendering: ${defn['@id']}`); // new
    // let's figure out what's going on here
    let inst = sys.add_actor_from_name(defn['@id']);
    // render
    for (let j = 0;j<Object.keys(inst.components).length;j++) {
      // set default state
      inst.components[Object.keys(inst.components)[j]].set_state_by_id(0);
    }
    let inst_grp = inst.render();
    current_inst = inst;
    current_render = inst_grp;
    
    inst_grp.on('click', function () {
      inst_grp.on('mousedown', function () {
        inst_grp.on('mousemove', function (event) {
          let pos = {x: event.clientX, y: event.clientY};
          place_render(current_render, pos);
        });
        inst_grp.on('mouseup', function () {
          console.log("off");
          inst_grp.off('mousemove');
          inst_grp.off('mousedown');
        });
      });
    })
    // this logic is not right for capturing drag

    current_instances[defn.name] = current_inst;
    current_renders[defn.name] = current_render;
    console.log(current_instances);
    console.log(current_renders);

    // place_render(current_render);

    for (let q=0; q<Object.keys(current_renders).length; q++) {
      let name = Object.keys(current_renders)[q];
      if (current_renders[name] != null) place_render(current_renders[name]);
    }

    // make component buttons
    for (let j = 0;j<Object.keys(current_inst.components).length;j++) {
      // put event listener on component.current_render
      let comp = current_inst.components[Object.keys(current_inst.components)[j]];
      let current_render = comp.current_render;
      // current_render.on('click', function() {console.log("clicked component");});
      
      // set default state
      var comp_button = document.createElement("button");
      comp_button.id = `${Object.keys(current_inst.components)[j]}`;
      comp_button.innerText = `${Object.keys(current_inst.components)[j]}`;
      comp_button.className = "compbtn";
      // button functionality
      comp_button.addEventListener("click", ()=>{
        let name = current_inst.name;
        remove_render(name);

        current_inst.group = null; // iffy
        //current_render.remove();
        current_inst.components[Object.keys(current_inst.components)[j]].next_state();
// /*
        // keep track of stuff
        let curr_name = current_inst.name;
        // save current states
        let curr_states = {};
        for (let k = 0;k<Object.keys(current_inst.components).length;k++) {
          let key = Object.keys(current_inst.components)[k];
          let comp = current_inst.components[key];
          curr_states[comp.name] = comp.curr_state_id;
        }
        // remove old render
        current_render.remove();
        // get new one in here
        current_inst = sys.add_actor_from_name(curr_name);
        // set states correctly
        for (let k = 0;k<Object.keys(current_inst.components).length;k++) {
          let key = Object.keys(current_inst.components)[k];
          let comp = current_inst.components[key];
          comp.set_state_by_id(curr_states[key]);
          if (k==j) {
            comp.next_state();
          }
        }
// * /
        // now we can render 
        current_render = current_inst.render();

        current_renders[name] = current_render;
        
        place_render(current_render);
      });
      document.getElementById("compbuttons").appendChild(comp_button);
    }
  });
  x.appendChild(mol_el);
}
*/

// on click function
function show_molecules() {
  document.getElementById("molec_dropdown").classList.toggle("show");
}

// get button to add click listener
var btn = document.getElementById("molec_button");
btn.addEventListener("click", show_molecules);

// close list when clicked outside
window.onclick = function(e) {
    if (!e.target.matches('.dropbtn')) {
    var myDropdown = document.getElementById("molec_dropdown");
      if (myDropdown.classList.contains('show')) {
        myDropdown.classList.remove('show');
      }
    }
  }

// */