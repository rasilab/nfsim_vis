import * as core from "./vis_core.js";

// core system initialization, async
let settings = new core.Settings("vis_settings.json");
await settings.parse_settings_file();
let sys = settings.system;

// keep track of what we are currently showing
let current_render;
let current_inst;
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
    if (current_render!=null) {
      console.log(`removing previous render`)
      current_render.remove();
    }
    console.log(`rendering: ${defn['@id']}`);
    // let's figure out what's going on here
    let inst = sys.add_actor_from_name(defn['@id']);
    // render
    for (let j = 0;j<Object.keys(inst.components).length;j++) {
      // set default state
      inst.components[Object.keys(inst.components)[i]].set_state_by_id(0);
    }
    let inst_grp = inst.render();
    current_inst = inst;
    current_render = inst_grp;
    // moves relative to current location
    inst_grp.dmove(1000, 1000);
    // resizing, null allows for proportional resizing
    inst_grp.size(2000, null);
    // make component buttons
    for (let j = 0;j<Object.keys(current_inst.components).length;j++) {
      // set default state
      var comp_button = document.createElement("button");
      comp_button.id = `${Object.keys(current_inst.components)[j]}`;
      comp_button.innerText = `${Object.keys(current_inst.components)[j]}`;
      comp_button.className = "compbtn";
      // button functionality
      comp_button.addEventListener("click", ()=>{
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
        // now we can render 
        current_render = current_inst.render();
        current_render.dmove(1000, 1000);
        current_render.size(2000, null);
      });
      document.getElementById("compbuttons").appendChild(comp_button);
    }
  });
  x.appendChild(mol_el);
}

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

