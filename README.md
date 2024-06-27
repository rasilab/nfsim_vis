# nfsim_vis

Basic visualization helper library for nfsim trajectories

## Structure

classes 
- Representation: General visualization class
- Component: General PySB class (akin to PySB Component)
- Monomer: Derived from Component, represents a moleculetype
- Site: Derived from Component, represents a site on a moleculetype
- SiteState: Derived from Component, represents a state of a site on a moleculetype
- Rule: Derived from Component, represents a rule


## Notes

- 2024-04-10 Bond visualization logic:
  - If the two molecules that are forming a bond are not connected, then transform the molecules so that the sites are offset by 10px.
  - If the molecule forming a bond is connected to another molecule before the reaction, then the full complex should be moved. This might not be important for rule visualization, but would be important in simulation visualization.
  - if two molecules forming a bond are connected to the same third molecule, then don't move the molecules, but just draw a straight line connecting the two sites.

- 2024-04-10 Rule visualization plan:
  - First create all the molecules in the initial state.
  - Then form the bonds that are necessary for the reactant patterns.
  - Then render the reactants.
  - Then form the bonds that are necessary for the product patterns. Make any state changes, remove bonds, delete molecules, add molecules.
  - Then animate the bonds that are forming and breaking as well as all other changes. To begin with, you can simply just do a simple transform and run the rule in a loop.

- 2024-04-08: We can think of visualization of PySB models as not that different from the chemical reaction syntax of PySB. In both cases, we are representing programming objects in another language. In one case, we use symbols that accurately convey the program structure in a chemical/mathematical langugage, and in the other case, we use symbols that accurately convey the program structure in a visual language.

## How to run the visualization
- Put your desired images into ```./model/svg``` as svg files (smaller is better)
- Put your desired model.xml and corresponding model.json into the ```./model/model_xml``` directory.
- Update the code in ```./model/main.js``` in the ```main``` function to the names of your desired model.xml and model.json files
- Edit the "name" entry of the ```./model/model_xml/user_input.json``` file to be the same as the svg image files that you put into ```./model/svg``` (e.g. if your svg file is called "ribosome.svg", then "name" should be "ribosome"). Whichever of these molecules should move in the model should go with the "movingGroup" type, and whichever molecule should stay put should go with the "stayingGroup" type. Don't edit the "type" entry, because "movingGroup" and "stayingGroup" terms are used explicitly in the code.
- If you have multiple molecules that will move in the model, add more entries for type "movingGroup" (see ```./model/model_xml/user_input_4.json``` for example). Note that currently the code assumes that there will only ever be one "stayingGroup" per model.
- In VSCode, right click ```./model/index.html``` and select "Open with Live Server" (download the VSCode extension) which should then run the simulation in a web browser.

### Walkthrough
- 2024-06-27
- In directory ```./model```
- Requires a ```user_input.json``` file that defines which molecule should move ("movingGroup") and which should stay ("stayingGroup").
#### main.js
- ```createModelFromJson(jsonData);```
  - Parses the JSON model.xml and extracts all pertinent information as a set of Objects (associative arrays) as defined in ```model.js```
  - All reactant rules are parsed into the rules Object, and each rule includes another set of Objects parsed from the model (e.g. product bonds, product molecule components etc)
- ```createMoleculeModelGroups``` is just for visualzing the rules (not simulation) and is simpler version of ```createMoleculeGroups```, which is for visualizing simulation firings. Both classes take in svg content, perform some visualization manipulations via ```representation.js```, and return named group elements back to ```main.js```
  - The molecule ```typeID``` as defined in model.json is used as the index for the group elements. So if the typeID for mrna is 0, then all the SVG group elements for mRNA will be in the zero indexed position of the array.
- ```iterateAndVisualizeReactionRules```: mostly the same as ```iterateAndVisualizeSimulationFirings``` below but just for visualizing the rules
- ```iterateAndVisualizeSimulationFirings```
  - Takes in the array of group elements that are all named after the molecule and ID number as defined by model.json and model.xml
  - determines which molecule should be moving and which should be staying put based on ```user_input.json```
  - determines the ```typeID``` based on molecule name for both the moving molecule and the staying molecule from model.json
  - gets the array of SVG group elements using this typeID as the index
  - iterates through simulation firings
    - uses the name of the firing to match with the model rules
- TODO
  - could include viz of the firing number for reference
  - maybe need to add functionality to do the inital set of "ops" in model.json, so far the models I've used have not had anything under "ops" so I have not considered it at all
  - need to include viz functionality for AddMolecule, DeleteMolecule, StateChange
  - in a more complex model (e.g. with multiple molecules that could move depending on the firings, and ones that could move while bonded to other ones based on previous rules), need to check if molecules are bonded and if they should move together