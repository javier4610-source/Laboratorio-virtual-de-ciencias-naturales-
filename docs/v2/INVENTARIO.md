# Inventario automático del laboratorio

Generado por `node scripts/inventario.mjs` el 2026-10-18. No editar a mano: se regenera desde el código.

- Prácticas en el catálogo: **47**
- Con laboratorio registrado: 47 · con prueba E2E propia: 47 · con revisión axe: 47
- Con modo de instrumento real: 20 · con modo avanzado: 17 · con parámetros editables: 8
- Con manipulación directa: 29 · con sonido: 33 · con texto que rotula partes ilustrativas: 15
- Archivos de pruebas unitarias: 40 (580 pruebas declaradas)

| Práctica | Grado | Área | Laboratorio (líneas) | Modelos | Pruebas unitarias | E2E | axe | Instr. real | Avanzado | Manipulación | Sonido | Rótulo ilustrativo |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| `calor` Calor, temperatura y equilibrio térmico | 6.º | fisica | HeatLab (568) | heat | 14 en heat.test.ts | sí | sí | sí | no | sí | sí | no |
| `celulas` Microscopio virtual: células animales y vegetales | 6.º | biologia | MicroscopeLab (324) | microscope | 15 en microscope.test.ts | sí | sí | no | no | sí | sí | sí |
| `densidad` Medición de masa, volumen y densidad | 6.º | fisica | DensityLab (240) | density | 55 en models.test.ts | sí | sí | sí | sí | sí | sí | no |
| `ecosistema` Ecosistema: agua, luz y alimento | 6.º | ambiental | EcosystemLab (704) | ecosystem | 13 en ecosystem.test.ts | sí | sí | sí | no | sí | sí | no |
| `maquinas` Máquinas simples: palancas y poleas | 6.º | fisica | MachinesLab (800) | simpleMachines | 14 en simpleMachines.test.ts | sí | sí | sí | no | sí | sí | sí |
| `mezclas` Separación de mezclas: filtración, decantación, imantación y evaporación | 6.º | quimica | MixturesLab (203) | mixtures | 21 en models3.test.ts | sí | sí | no | no | no | sí | sí |
| `movimiento` Movimiento y distancia recorrida | 6.º | fisica | MotionLab (820) | motion | 9 en motion.test.ts | sí | sí | sí | sí | sí | sí | no |
| `redes` Cadenas y redes alimentarias | 6.º | ambiental | FoodWebLab (375) | foodweb | 12 en foodweb.test.ts | sí | sí | no | no | no | no | sí |
| `circuitos-simples` Circuitos simples con baterías, interruptores y bombillas | 7.º | fisica | SimpleCircuitsLab (1050) | simpleCircuits | 16 en simpleCircuits.test.ts | sí | sí | sí | sí | sí | sí | no |
| `conduccion` Transferencia de calor por conducción | 7.º | fisica | ConductionLab (760) | conduction | 15 en conduction.test.ts | sí | sí | sí | no | sí | sí | no |
| `conductores` Materiales conductores y aislantes | 7.º | fisica | ConductorsLab (408) | conductors | 12 en conductors.test.ts | sí | sí | sí | no | no | sí | no |
| `descomposicion` Factores de la descomposición de la materia orgánica | 7.º | ambiental | DecompositionLab (400) | decomposition | 10 en decomposition.test.ts | sí | sí | no | no | no | no | sí |
| `flotacion` Empuje y flotación: principio de Arquímedes | 7.º | fisica | BuoyancyLab (619) | buoyancy, pressure | 46 en advanced.test.ts, buoyancy.test.ts, pressure.test.ts | sí | sí | sí | no | sí | sí | no |
| `mitosis` Mitosis al microscopio: fases e índice mitótico | 7.º | biologia | MitosisLab (262) | mitosis | 24 en models2.test.ts | sí | sí | no | no | no | no | sí |
| `osmosis` Difusión y ósmosis a través de la membrana | 7.º | biologia | OsmosisLab (424) | osmosis | 55 en models.test.ts | sí | sí | no | no | no | no | sí |
| `presion` Presión en líquidos y presión atmosférica | 7.º | fisica | PressureLab (1042) | pressure | 46 en advanced.test.ts, buoyancy.test.ts, pressure.test.ts | sí | sí | sí | sí | sí | no | sí |
| `balanceo` Balanceo de ecuaciones químicas con conteo de átomos | 8.º | quimica | BalancingLab (607) | balancing | 16 en balancing.test.ts | sí | sí | no | no | sí | sí | no |
| `conservacion` Conservación de la masa en sistemas abiertos y cerrados | 8.º | quimica | ConservationLab (518) | massConservation | 12 en massConservation.test.ts | sí | sí | no | no | no | sí | no |
| `mendel` Herencia mendeliana y cuadros de Punnett | 8.º | biologia | MendelLab (398) | mendel | 55 en models.test.ts | sí | sí | no | no | no | no | sí |
| `ondas` Laboratorio de ondas: frecuencia, amplitud y longitud de onda | 8.º | fisica | WavesLab (272) | waves | 24 en models2.test.ts | sí | sí | no | sí | sí | no | no |
| `optica` Reflexión y refracción de la luz | 8.º | fisica | OpticsLab (200) | optics | 21 en models3.test.ts | sí | sí | sí | sí | sí | sí | no |
| `sonido` Sonido y resonancia | 8.º | fisica | SoundLab (932) | soundResonance | 13 en soundResonance.test.ts | sí | sí | sí | no | sí | sí | no |
| `adn` Del ADN a la proteína: replicación, transcripción y traducción | 9.º | biologia | DnaLab (496) | dna | 69 en geneExpression.test.ts, models.test.ts | sí | sí | no | no | no | no | no |
| `cinematica` Velocidad, aceleración y movimiento | 9.º | fisica | KinematicsLab (302) | kinematics | 12 en kinematics.test.ts | sí | sí | no | sí | no | sí | no |
| `newton` Leyes de Newton: fuerza, masa y aceleración | 9.º | fisica | NewtonLab (335) | newton | 41 en advanced.test.ts, models3.test.ts | sí | sí | sí | sí | sí | sí | no |
| `seleccion` Selección natural con cambios ambientales | 9.º | biologia | SelectionLab (279) | selection | 14 en selection.test.ts | sí | sí | no | no | no | no | no |
| `trabajo` Trabajo, potencia y plano inclinado | 9.º | fisica | WorkLab (813) | workPower | 12 en workPower.test.ts | sí | sí | sí | no | sí | sí | no |
| `choques` Choques y cantidad de movimiento | 10.º | fisica | CollisionsLab (485) | collisions | 13 en collisions.test.ts | sí | sí | no | sí | no | sí | no |
| `cinetica` Factores que afectan la velocidad de reacción | 10.º | quimica | KineticsLab (334) | kinetics | 31 en advanced.test.ts, kinetics.test.ts | sí | sí | no | sí | sí | sí | sí |
| `energia` Conservación de la energía mecánica | 10.º | fisica | EnergyLab (202) | energy | 41 en advanced.test.ts, models3.test.ts | sí | sí | no | sí | no | sí | no |
| `enzimas` Actividad enzimática: temperatura, pH y concentración | 10.º | biologia | EnzymeLab (289) | enzyme | 66 en lib.test.ts, models.test.ts | sí | sí | no | no | sí | no | sí |
| `fotosintesis` Fotosíntesis: luz, CO₂ y temperatura | 10.º | biologia | PhotoLab (199) | photosynthesis | 24 en models2.test.ts | sí | sí | no | no | sí | no | sí |
| `gases` Leyes de los gases: presión, volumen y temperatura | 10.º | quimica | GasLab (208) | gases | 41 en advanced.test.ts, models3.test.ts | sí | sí | sí | sí | sí | sí | no |
| `pendulo` Péndulo simple y movimiento armónico | 10.º | fisica | PendulumLab (451) | pendulum | 31 en advanced.test.ts, pendulum.test.ts | sí | sí | no | sí | sí | sí | no |
| `proyectiles` Movimiento de proyectiles | 10.º | fisica | ProjectileLab (505) | projectile | 33 en advanced.test.ts, projectile.test.ts | sí | sí | no | sí | sí | sí | no |
| `respiracion` Respiración celular y balance energético | 10.º | biologia | RespirationLab (423) | respiration | 11 en respiration.test.ts | sí | sí | sí | no | sí | sí | no |
| `soluciones` Preparación de soluciones, molaridad y colorimetría | 10.º | quimica | SolutionsLab (281) | solutions, chemistry | 55 en models.test.ts | sí | sí | no | no | no | sí | no |
| `agua` Contaminación del agua e indicadores fisicoquímicos y biológicos | 11.º | ambiental | WaterQualityLab (637) | waterQuality | 15 en waterQuality.test.ts | sí | sí | sí | no | sí | sí | no |
| `circuitos` Circuitos eléctricos: voltaje, corriente y resistencia | 11.º | fisica | CircuitLab (342) | circuits | 55 en models.test.ts | sí | sí | sí | sí | sí | sí | no |
| `equilibrio` Equilibrio químico y principio de Le Châtelier | 11.º | quimica | EquilibriumLab (469) | equilibrium | 11 en equilibrium.test.ts | sí | sí | no | no | no | sí | sí |
| `estequiometria` Estequiometría y reactivo limitante | 11.º | quimica | StoichLab (215) | stoichiometry, chemistry | 66 en lib.test.ts, models.test.ts | sí | sí | no | no | no | no | no |
| `expresion` Expresión génica y efecto de mutaciones en la proteína | 11.º | biologia | ExpressionLab (862) | geneExpression, dna | 69 en geneExpression.test.ts, models.test.ts | sí | sí | no | no | sí | sí | no |
| `induccion` Magnetismo e inducción electromagnética | 11.º | fisica | InductionLab (1248) | induction | 12 en induction.test.ts | sí | sí | sí | sí | sí | sí | no |
| `interferencia` Interferencia y difracción de la luz | 11.º | fisica | InterferenceLab (603) | interference | 19 en interference.test.ts | sí | sí | sí | sí | sí | sí | no |
| `ph` pH, dilución y neutralización ácido-base | 11.º | quimica | AcidBaseLab (280) | acidbase, chemistry | 79 en models.test.ts, models2.test.ts | sí | sí | no | no | sí | sí | no |
| `poblacion` Crecimiento poblacional y capacidad de carga | 11.º | ambiental | PopulationLab (203) | population | 55 en models.test.ts | sí | sí | no | no | no | no | sí |
| `popgen` Genética de poblaciones y frecuencias alélicas | 11.º | biologia | PopGenLab (179) | popgen | 24 en models2.test.ts | sí | sí | no | no | no | no | sí |
