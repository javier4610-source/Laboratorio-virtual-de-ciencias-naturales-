# Inventario automático del laboratorio

Generado por `node scripts/inventario.mjs` el 2026-10-25. No editar a mano: se regenera desde el código.

- Prácticas en el catálogo: **65**
- Con laboratorio registrado: 65 · con prueba E2E propia: 65 · con revisión axe: 0
- Con modo de instrumento real: 23 · con modo avanzado: 20 · con parámetros editables: 8
- Con manipulación directa: 32 · con sonido: 46 · con texto que rotula partes ilustrativas: 27
- Archivos de pruebas unitarias: 62 (913 pruebas declaradas)

| Práctica | Grado | Área | Laboratorio (líneas) | Modelos | Pruebas unitarias | E2E | axe | Instr. real | Avanzado | Manipulación | Sonido | Rótulo ilustrativo |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| `calor` Calor, temperatura y equilibrio térmico | 6.º | fisica | HeatLab (568) | heat | 14 en heat.test.ts | sí | no | sí | no | sí | sí | no |
| `celulas` Microscopio virtual: células animales y vegetales | 6.º | biologia | MicroscopeLab (324) | microscope | 15 en microscope.test.ts | sí | no | no | no | sí | sí | sí |
| `densidad` Medición de masa, volumen y densidad | 6.º | fisica | DensityLab (240) | density | 55 en models.test.ts | sí | no | sí | sí | sí | sí | no |
| `ecosistema` Ecosistema: agua, luz y alimento | 6.º | ambiental | EcosystemLab (704) | ecosystem | 13 en ecosystem.test.ts | sí | no | sí | no | sí | sí | no |
| `maquinas` Máquinas simples: palancas y poleas | 6.º | fisica | MachinesLab (800) | simpleMachines | 14 en simpleMachines.test.ts | sí | no | sí | no | sí | sí | sí |
| `mezclas` Separación de mezclas: filtración, decantación, imantación y evaporación | 6.º | quimica | MixturesLab (203) | mixtures | 21 en models3.test.ts | sí | no | no | no | no | sí | sí |
| `movimiento` Movimiento y distancia recorrida | 6.º | fisica | MotionLab (820) | motion | 9 en motion.test.ts | sí | no | sí | sí | sí | sí | no |
| `redes` Cadenas y redes alimentarias | 6.º | ambiental | FoodWebLab (375) | foodweb | 12 en foodweb.test.ts | sí | no | no | no | no | no | sí |
| `circuitos-simples` Circuitos simples con baterías, interruptores y bombillas | 7.º | fisica | SimpleCircuitsLab (1050) | simpleCircuits | 16 en simpleCircuits.test.ts | sí | no | sí | sí | sí | sí | no |
| `conduccion` Transferencia de calor por conducción | 7.º | fisica | ConductionLab (760) | conduction | 15 en conduction.test.ts | sí | no | sí | no | sí | sí | no |
| `conductores` Materiales conductores y aislantes | 7.º | fisica | ConductorsLab (408) | conductors | 12 en conductors.test.ts | sí | no | sí | no | no | sí | no |
| `descomposicion` Factores de la descomposición de la materia orgánica | 7.º | ambiental | DecompositionLab (400) | decomposition | 10 en decomposition.test.ts | sí | no | no | no | no | no | sí |
| `flotacion` Empuje y flotación: principio de Arquímedes | 7.º | fisica | BuoyancyLab (619) | buoyancy, pressure | 46 en advanced.test.ts, buoyancy.test.ts, pressure.test.ts | sí | no | sí | no | sí | sí | no |
| `mitosis` Mitosis al microscopio: fases e índice mitótico | 7.º | biologia | MitosisLab (262) | mitosis | 24 en models2.test.ts | sí | no | no | no | no | no | sí |
| `osmosis` Difusión y ósmosis a través de la membrana | 7.º | biologia | OsmosisLab (424) | osmosis | 55 en models.test.ts | sí | no | no | no | no | no | sí |
| `presion` Presión en líquidos y presión atmosférica | 7.º | fisica | PressureLab (1042) | pressure | 46 en advanced.test.ts, buoyancy.test.ts, pressure.test.ts | sí | no | sí | sí | sí | no | sí |
| `balanceo` Balanceo de ecuaciones químicas con conteo de átomos | 8.º | quimica | BalancingLab (607) | balancing | 49 en balancing.test.ts, compoundForge.test.ts, mole.test.ts | sí | no | no | no | sí | sí | no |
| `cinetica-potencial` Energía cinética y energía potencial | 8.º | fisica | KineticPotentialLab (1076) | kineticPotential | 28 en kineticPotential.test.ts | sí | no | sí | sí | sí | sí | no |
| `conservacion` Conservación de la masa en sistemas abiertos y cerrados | 8.º | quimica | ConservationLab (518) | massConservation | 12 en massConservation.test.ts | sí | no | no | no | no | sí | no |
| `extraccion-adn` Modelo interactivo de ADN y complementariedad | 8.º | biologia | DnaExtractionLab (881) | dnaExtraction | 12 en dnaExtraction.test.ts | sí | no | sí | sí | sí | sí | sí |
| `mendel` Herencia mendeliana y cuadros de Punnett | 8.º | biologia | MendelLab (398) | mendel | 55 en models.test.ts | sí | no | no | no | no | no | sí |
| `ondas` Laboratorio de ondas: frecuencia, amplitud y longitud de onda | 8.º | fisica | WavesLab (272) | waves | 24 en models2.test.ts | sí | no | no | sí | sí | no | no |
| `optica` Reflexión y refracción de la luz | 8.º | fisica | OpticsLab (200) | optics | 21 en models3.test.ts | sí | no | sí | sí | sí | sí | no |
| `sonido` Sonido y resonancia | 8.º | fisica | SoundLab (932) | soundResonance | 13 en soundResonance.test.ts | sí | no | sí | no | sí | sí | no |
| `adn` Del ADN a la proteína: replicación, transcripción y traducción | 9.º | biologia | DnaLab (496) | dna | 93 en geneExpression.test.ts, models.test.ts, sequences.test.ts | sí | no | no | no | no | no | no |
| `cinematica` Velocidad, aceleración y movimiento | 9.º | fisica | KinematicsLab (302) | kinematics | 12 en kinematics.test.ts | sí | no | no | sí | no | sí | no |
| `mol` Cálculos estequiométricos básicos | 9.º | quimica | MoleLab (744) | mole, balancing | 49 en balancing.test.ts, compoundForge.test.ts, mole.test.ts | sí | no | sí | sí | sí | sí | sí |
| `newton` Leyes de Newton: fuerza, masa y aceleración | 9.º | fisica | NewtonLab (335) | newton | 41 en advanced.test.ts, models3.test.ts | sí | no | sí | sí | sí | sí | no |
| `seleccion` Selección natural con cambios ambientales | 9.º | biologia | SelectionLab (279) | selection | 14 en selection.test.ts | sí | no | no | no | no | no | no |
| `trabajo` Trabajo, potencia y plano inclinado | 9.º | fisica | WorkLab (813) | workPower | 12 en workPower.test.ts | sí | no | sí | no | sí | sí | no |
| `acidos-sales` Ácidos y sales: hidrácidos, oxácidos, neutralización y nomenclatura | 10.º | quimica | AcidsSaltsLab (295) | aqueousEquilibria, acidsSalts, inorganicNomenclature, oxidesHydroxides | 39 en compoundForge.test.ts, inorganicChemistry.test.ts, inorganicNomenclature.test.ts | sí | no | no | no | no | sí | sí |
| `choques` Choques y cantidad de movimiento | 10.º | fisica | CollisionsLab (485) | collisions | 13 en collisions.test.ts | sí | no | no | sí | no | sí | no |
| `cinetica` Factores que afectan la velocidad de reacción | 10.º | quimica | KineticsLab (334) | kinetics | 31 en advanced.test.ts, kinetics.test.ts | sí | no | no | sí | sí | sí | sí |
| `energia` Conservación de la energía mecánica | 10.º | fisica | EnergyLab (483) | energy, energyTime | 56 en advanced.test.ts, energyTime.test.ts, models3.test.ts | sí | no | no | sí | no | sí | no |
| `enzimas` Actividad enzimática: temperatura, pH y concentración | 10.º | biologia | EnzymeLab (289) | enzyme | 66 en lib.test.ts, models.test.ts | sí | no | no | no | sí | no | sí |
| `fotosintesis` Fotosíntesis: luz, CO₂ y temperatura | 10.º | biologia | PhotoLab (199) | photosynthesis | 24 en models2.test.ts | sí | no | no | no | sí | no | sí |
| `gases` Leyes de los gases: presión, volumen y temperatura | 10.º | quimica | GasLab (208) | gases | 41 en advanced.test.ts, models3.test.ts | sí | no | sí | sí | sí | sí | no |
| `geometria` Geometría molecular en 3D y modelo VSEPR | 10.º | quimica | GeometryLab (704) | geometry, balancing | 83 en balancing.test.ts, chemKit.test.ts, compoundForge.test.ts, geometry.test.ts, mole.test.ts | sí | no | no | no | no | sí | no |
| `nomenclatura-inorganica` Nomenclatura química inorgánica | 10.º | quimica | InorganicNomenclatureLab (274) | geometry, inorganicNomenclature | 60 en chemKit.test.ts, compoundForge.test.ts, geometry.test.ts, inorganicNomenclature.test.ts | sí | no | no | no | no | sí | no |
| `oxidos-hidroxidos` Óxidos e hidróxidos: formación, nomenclatura y carácter ácido-base | 10.º | quimica | OxidesHydroxidesLab (261) | inorganicNomenclature, oxidesHydroxides | 39 en compoundForge.test.ts, inorganicChemistry.test.ts, inorganicNomenclature.test.ts | sí | no | no | no | no | sí | sí |
| `pendulo` Péndulo simple y movimiento armónico | 10.º | fisica | PendulumLab (451) | pendulum | 31 en advanced.test.ts, pendulum.test.ts | sí | no | no | sí | sí | sí | no |
| `proyectiles` Movimiento de proyectiles | 10.º | fisica | ProjectileLab (505) | projectile | 33 en advanced.test.ts, projectile.test.ts | sí | no | no | sí | sí | sí | no |
| `respiracion` Respiración celular y balance energético | 10.º | biologia | RespirationLab (423) | respiration | 11 en respiration.test.ts | sí | no | sí | no | sí | sí | no |
| `soluciones` Preparación de soluciones, molaridad y colorimetría | 10.º | quimica | SolutionsLab (281) | solutions, chemistry | 73 en models.test.ts, mole.test.ts | sí | no | no | no | no | sí | no |
| `agua` Contaminación del agua e indicadores fisicoquímicos y biológicos | 11.º | ambiental | WaterQualityLab (637) | waterQuality | 15 en waterQuality.test.ts | sí | no | sí | no | sí | sí | no |
| `aromaticos` Hidrocarburos aromáticos | 11.º | quimica | AromaticsLab (319) | hydrocarbons, aromaticity, organicGraph, organicNomenclature, organicBuilder | 60 en functionalNomenclature.test.ts, organicFunctions.test.ts, organicModels.test.ts, organicNomenclature.test.ts | sí | no | no | no | no | no | sí |
| `circuitos` Circuitos eléctricos: voltaje, corriente y resistencia | 11.º | fisica | CircuitLab (342) | circuits | 55 en models.test.ts | sí | no | sí | sí | sí | sí | no |
| `equilibrio` Equilibrio químico y principio de Le Châtelier | 11.º | quimica | EquilibriumLab (469) | equilibrium | 11 en equilibrium.test.ts | sí | no | no | no | no | sí | sí |
| `estequiometria` Estequiometría y reactivo limitante | 11.º | quimica | StoichLab (215) | stoichiometry, chemistry | 84 en lib.test.ts, models.test.ts, mole.test.ts | sí | no | no | no | no | no | no |
| `expresion` Expresión génica y efecto de mutaciones en la proteína | 11.º | biologia | ExpressionLab (862) | geneExpression, dna | 93 en geneExpression.test.ts, models.test.ts, sequences.test.ts | sí | no | no | no | sí | sí | no |
| `grupos-nitrogenados` Funciones orgánicas nitrogenadas: aminas y amidas | 11.º | quimica | NitrogenGroupsLab (389) | functionalGroups, functionalProperties, functionalNomenclature, organicGraph, organicReactions | 60 en functionalNomenclature.test.ts, organicFunctions.test.ts, organicModels.test.ts, organicNomenclature.test.ts | sí | no | no | no | no | no | sí |
| `grupos-oxigenados` Funciones orgánicas oxigenadas: alcoholes, fenoles, éteres, aldehídos, cetonas, ácidos carboxílicos y ésteres | 11.º | quimica | OxygenatedGroupsLab (342) | functionalGroups, functionalProperties, functionalNomenclature, organicGraph | 60 en functionalNomenclature.test.ts, organicFunctions.test.ts, organicModels.test.ts, organicNomenclature.test.ts | sí | no | no | no | no | sí | sí |
| `hidrocarburos` Hidrocarburos: alcanos, alquenos y alquinos | 11.º | quimica | HydrocarbonsLab (522) | hydrocarbons, organicGraph, organicNomenclature | 60 en functionalNomenclature.test.ts, organicFunctions.test.ts, organicModels.test.ts, organicNomenclature.test.ts | sí | no | no | no | no | sí | sí |
| `induccion` Magnetismo e inducción electromagnética | 11.º | fisica | InductionLab (1248) | induction | 12 en induction.test.ts | sí | no | sí | sí | sí | sí | no |
| `interferencia` Interferencia y difracción de la luz | 11.º | fisica | InterferenceLab (603) | interference | 19 en interference.test.ts | sí | no | sí | sí | sí | sí | no |
| `metabolismo` Metabolismo celular: análisis de balance de flujos (FBA) | 11.º | biologia | MetabolismLab (500) | metabolism | 20 en metabolism.test.ts | sí | no | no | no | no | no | no |
| `nomenclatura-organica` Nomenclatura orgánica IUPAC | 11.º | quimica | NomenclatureLab (437) | organicBuilder, organicGraph, organicNomenclature | 60 en functionalNomenclature.test.ts, organicFunctions.test.ts, organicModels.test.ts, organicNomenclature.test.ts | sí | no | no | no | no | sí | sí |
| `ph` pH, dilución y neutralización ácido-base | 11.º | quimica | AcidBaseLab (280) | acidbase, chemistry | 110 en inorganicChemistry.test.ts, models.test.ts, models2.test.ts, mole.test.ts | sí | no | no | no | sí | sí | no |
| `poblacion` Crecimiento poblacional y capacidad de carga | 11.º | ambiental | PopulationLab (203) | population | 55 en models.test.ts | sí | no | no | no | no | no | sí |
| `popgen` Genética de poblaciones y frecuencias alélicas | 11.º | biologia | PopGenLab (179) | popgen | 24 en models2.test.ts | sí | no | no | no | no | no | sí |
| `proteinas` Estructura 3D de proteínas: experimental y predicha | 11.º | biologia | ProteinLab (1125) | protein | 16 en protein.test.ts | sí | no | no | no | no | sí | no |
| `rastreo` Rastreo génico: del gen a la proteína y su función | 11.º | biologia | GeneTraceLab (495) | geneTrace | 17 en geneTrace.test.ts | sí | no | no | no | no | no | sí |
| `reacciones-organicas` Reacciones orgánicas en 3D | 11.º | quimica | OrganicReactionsLab (350) | functionalProperties, functionalNomenclature, organicGraph, organicReactions | 60 en functionalNomenclature.test.ts, organicFunctions.test.ts, organicModels.test.ts, organicNomenclature.test.ts | sí | no | no | no | no | sí | sí |
| `reto` Reto de indagación con interpretación de datos | 11.º | ambiental | InquiryLab (459) | inquiry | 10 en inquiry.test.ts | sí | no | no | no | no | sí | sí |
| `secuencias` Secuencias biológicas: análisis y alineamiento | 11.º | biologia | SequencesLab (601) | sequences, dna, geneExpression | 93 en geneExpression.test.ts, models.test.ts, sequences.test.ts | sí | no | no | no | no | no | no |
