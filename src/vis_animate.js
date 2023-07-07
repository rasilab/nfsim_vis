import * as core from "./vis_core.js";

// core system initialization, async
let settings = new core.Settings("vis_settings.json", "nika_log.json");
// await settings.parse_settings_file();
await settings.initialize();
console.log(settings);
let sys = settings.system;

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

// basic test of system
let ssu_inst_1 = sys.add_actor_from_name("ssu");
ssu_inst_1.components["component1"].set_state_by_id(0);
ssu_inst_1.components["component2"].set_state_by_id(0);
let ssu_inst_1_grp = ssu_inst_1.render();
// sets the center location
ssu_inst_1_grp.center(1000, 1000);
// moves relative to current location
ssu_inst_1_grp.dmove(1000, 1000);
// resizing, null allows for proportional resizing
ssu_inst_1_grp.size(2000, null);

// ssu_inst_1_grp.each(function(i,children) {
//   console.log(children);
//   console.log(i);
// });

let ssu_inst_2 = sys.add_actor_from_name('ssu');
ssu_inst_2.components['component1'].set_state_by_id(1);
ssu_inst_2.components['component2'].set_state_by_id(1);


let lsu_inst_1 = sys.add_actor_from_name("lsu");
lsu_inst_1.components["component1"].set_state_by_id(1);
lsu_inst_1.components["component2"].set_state_by_id(1);
let lsu_inst_1_grp = lsu_inst_1.render();

// sets the center location
lsu_inst_1_grp.center(1000, 1000);
// moves relative to current location
lsu_inst_1_grp.dmove(1000, 3000);
// resizing, null allows for proportional resizing
lsu_inst_1_grp.size(2000, null);

// ANIMATE
ssu_inst_1.animator = ssu_inst_1_grp
  .animate({
    duration: 500,
    delay: 0,
    when: "absolute",
    swing: true,
    times: 5,
  })
  .transform({ translate: [500, 500], rotate: 125 }, lsu_inst_1_grp);
ssu_inst_1.animator = ssu_inst_1.animator
  .animate({
    duration: 2000,
    delay: 0,
    when: "after",
    swing: false,
    times: 1,
  })
  .opacity(0.0);
ssu_inst_1.animator = ssu_inst_1.animator
  .animate({
    duration: 2000,
    delay: 0,
    when: "after",
    swing: false,
    times: 1,
  })
  .opacity(1.0);
ssu_inst_1.animator = ssu_inst_1.animator
  .animate({
    duration: 2000,
    delay: 0,
    when: "after",
    swing: false,
    times: 1,
  })
  .transform({ translate: [-500, -500], rotate: -125 }, ssu_inst_1_grp);

// ssu2 
let ssu_inst_2_grp = ssu_inst_2.render();
ssu_inst_2_grp.move(0,2000);
ssu_inst_2.animator = ssu_inst_2_grp.animate({
  duration: 5000,
  delay: 0,
  when: "absolute",
  swing: true,
  times: 2,
})
.transform({ translate: [10, 10], rotate: 360 }, lsu_inst_1_grp)
.animate({
  duration: 100,
  delay: 0,
  when: "after",
  swing: false,
  times: 1,
}).opacity(0.0)
// Example removal after animation
ssu_inst_2.animator.after(()=>{
  ssu_inst_2_grp.remove();
});


// animate lsu separately
let lsu_animator = lsu_inst_1_grp
  .animate({
    duration: 2000,
    delay: 200,
    when: "absolute",
    swing: false,
    times: 1,
  })
  .transform({ translate: [500, 500], rotate: 125 }, ssu_inst_1_grp)
  .animate({
    duration: 1000,
    delay: 0,
    when: "after",
    swing: false,
    times: 1,
  })
  .opacity(0.0)
  .animate({
    duration: 1000,
    delay: 0,
    when: "after",
    swing: false,
    times: 1,
  })
  .opacity(1.0);
lsu_animator
  .animate({
    duration: 1000,
    delay: 0,
    when: "after",
    swing: false,
    times: 1,
  })
  .transform({ translate: [500, 500], rotate: 125 }, ssu_inst_1_grp);
