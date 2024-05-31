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

### Walkthrough
- 2024-05-29 
- ```createModelFromJson(jsonData);```
  - Parses the JSON model.xml and extracts all pertinent information as a set of Objects (associative arrays) as defined in model.js
  - All reactant rules are parsed into the rules Object, and each rule includes another set of Objects parsed from the model (e.g. product bonds, product molecule components etc)
- ```defineBondsFromReactionRules(model.rules);```
  - Iterates through the Reaction Rules of the model and stores all products and reactants as more simple indexed arrays which can be accessed a little easier than Objects
  - e.g. Reactant Rules' product molecules is stored as an indexed array, and corresponding sites and IDs (e.g. "RR1_PP1_M1_C1") are stored also as separate indexed arrays (aka they should all correspond with each other by index)
- Requires a user input json file that defines which molecule should move and which should stay. At the moment I think this code only supports one of each of these.
- ```createMoleculeModelGroups``` is a more simple version of ```createMoleculeGroups``` for visualizing just the rules. 
- ```createMoleculeGroups``` is for visualizing the simulation firings, wherein there will be multiple particles of each molecule. Both classes take in svg content, perform some visualization manipulations, and return named group elements back to main.js
  - The molecule ```typeID``` as defined in model.json is used as the index for the group elements. So if the typeID for mrna is 0, then all the SVG group elements for mRNA will be in the zero indexed position of the array.
- ```iterateAndVisualizeSimulationFirings```
  - Takes in the array of group elements that are all named after the molecule and number as defined by model.json and model.xml
  - determines which molecule should be moving and which should be staying put based on user input 
  - determines the ```typeID``` based on molecule name for both the moving molecule and the staying molecule from model.json
  - gets the array of SVG group elements using this typeID as the index
  - iterates through simulation firings
    - uses the name of the firing to match with the model rules and definedBonds arrays
- TODO
  - include the firing number
  - include viz of states
  - visualize a more complex model
  - maybe need to add functionality to do the inital set of "ops", so far the models I've used have not had anything under "ops"
    - on a related note, so far the model.json files I've used have been missing one bracket [ in the initial "ops" section
  - need to include functionality for AddMolecule, DeleteMolecule, StateChange