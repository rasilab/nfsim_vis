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
