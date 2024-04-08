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

- 2024-04-08: We can think of visualization of PySB models as not that different from the chemical reaction syntax of PySB. In both cases, we are representing programming objects in another language. In one case, we use symbols that accurately convey the program structure in a chemical/mathematical langugage, and in the other case, we use symbols that accurately convey the program structure in a visual language.