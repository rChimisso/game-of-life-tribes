# Epidemic Model Comparison

## Scope Of The Comparison

The GoLT preset has the same named flow structure as an SIRSD model - `S → I → R → S`, with `I → D` - but implements it as a local stochastic cellular automaton. This chapter compares structures, not outputs, as no external model was run and the GoLT probabilities are not calibrated to a particular disease or unit of time.

## Compartmental SIR And SIRSD

The classical Kermack-McKendrick tradition models aggregate _Susceptible_, _Infectious_, and _Removed_ populations with continuous equations and homogeneous or otherwise specified mixing. Hethcote's review describes the threshold concepts and model families built from that foundation. Wolff's SIRSD construction adds a separate disease-death compartment and loss of immunity from _Recovered_ back to _Susceptible_.

| Feature            | Compartmental SIRSD                                   | GoLT SIRSD Epidemic                                                      |
| ------------------ | ----------------------------------------------------- | ------------------------------------------------------------------------ |
| State variables    | Continuous population totals or fractions             | One discrete state per lattice cell                                      |
| Time               | Continuous rate equations                             | Synchronous discrete generations                                         |
| Contact            | Population-level mixing term                          | Eight fixed Moore neighbors                                              |
| Infection pressure | Usually scales with `S`, `I`, and a transmission rate | Fixed $50\%$ if at least one _Infectious_ neighbor exists                |
| Recovery/death     | Competing rates from `I`                              | Ordered $5\%$ recovery roll, then nominal $0.1\%$ conditional death roll |
| Immunity loss      | Rate from `R` to `S`                                  | $1\%$ roll per _Recovered_ cell per generation                           |
| Empty space        | Usually not a compartment                             | Empty/Dead lattice sites break local contact paths                       |
| Spatial history    | Not present in a homogeneous model                    | Clusters, fronts, local depletion, and toroidal paths emerge             |

Changing occupied density therefore has a different meaning in GoLT. It changes the connectivity of the contact substrate and the probability that infection can find a local path. In a homogeneous compartmental model, changing total population while keeping the same fractions and frequency-dependent rates need not create the same geometric transition.

## Spatial SIRS References

Joo and Lebowitz studied a stochastic SIRS process on one- and two-dimensional lattices and showed that spatial correlations can make mean-field approximations inaccurate. Van Ballegooijen and Boerlijst used an eight-neighbor grid-structured SIRS model in which local outbreaks, turbulent waves, and recurring waves arise for different infection and resistance parameters.

Those studies are structurally closer to GoLT SIRSD Epidemic preset because local contact and spatial organization matter. Important differences remain:

- Their infection hazards can depend on the number of _Infectious_ neighbors, whereas GoLT's preset saturates after one.
- Some models use continuous-time or small-step dynamics instead of one synchronous generation.
- Infectious and resistant periods may be fixed durations rather than geometric waiting times from per-step rolls.
- The cited SIRS lattice models do not necessarily include GoLT's absorbing _Dead_ state.
- GoLT's experiment varies occupied-site density while keeping its transition probabilities fixed.

The local analysis's occasional resurgence events are qualitatively compatible with the possibility of recurring spatial waves under waning immunity.

## What A Direct Validation Would Require

A direct numerical comparison with Wolff's SIRSD equations or another SIRSD implementation would require:

1. A common interpretation of one generation as physical time.
2. Matched infection, recovery, death, and immunity-loss hazards.
3. Agreement on whether infection hazard grows with the number of infectious contacts.
4. Matched initial `S`, `I`, `R`, and `D` fractions and population normalization.
5. Matched topology, population mobility, and contact network.
6. Identical endpoints and replicated stochastic seeds.

Comparing a spatial CA against a compartmental model would then be useful precisely because their differences are interpretable: divergence would quantify the effect of local correlations and empty-space connectivity rather than being attributed to unmatched protocols.

Primary sources for these comparisons are collected in [References](References#epidemic-models).
