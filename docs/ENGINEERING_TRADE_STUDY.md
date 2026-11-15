# Engineering trade study

Source: NASA Goddard **Mission Design Lab**, sections “Tailored Trade Study,” “MDL Capabilities,” and “MDL Disciplines.” Its engineering study approach considers requirements, alternatives, subsystem estimates, mass, power, data rate, cost and risk together.

`tradeStudy` and `tradeAlternatives` in `src/research/trade-study.js` analyze the current spacecraft, without changing the game. Every selected instrument/radio combination has a separate JSON file. Eight combinations are produced per mission; the functions also accept any existing equipment kit, objective, service and budget.

| Area | Computation and source |
| --- | --- |
| Mass | Actual configured dry mass, maximum propellant, instrument/radio mass and capacity margin |
| Propulsion | Existing `Navigation.remainingDV`; actual engine thrust, Isp and dry/wet mass |
| Power | Existing 1800 W base load, 600 W maximum thruster increment, instrument/radio loads, generation and battery capacity |
| Communications | Existing `ScienceOperations`, live reference positions, `linkGeometry`, rate cap, inverse-square penalty, solar occultation and light time |
| Storage | Existing generation, finite storage, transmission and dropped-data accounting |
| Cost | Existing spacecraft, instrument, radio and service prices; budget margin |
| Feasibility | Original design checks, reference-route quality, projected science return and energy survival |

The study replays the unchanged reference track at 0.25 control-second intervals and uses the existing science class. It assumes coasting, no obstacles, no resource pickups, nominal reference timing and fixed power generation. The resource clock is control time; Earth receipts use TDB propagation timestamps. These projections are not observed player outcomes or multi-year energy-autonomy calculations.

The report separates observed flight evidence from projected alternatives. Every numerical hardware input is tagged **Educational Assumption**, with its actual parameter path. NASA MDL supplies the study method; it does not supply or validate these fictional hardware specifications and prices.

CubeSat 101's budget discussion (PDF p. 21, printed p. 13) recommends reserves when possible. The separate CubeSat review reports a 10% advisory reserve check, using `(budget - cost)/cost` as the project convention. It does not modify the game's budget check or score.

Run `npm run evidence` and inspect `data/evidence/mars/trade-studies/`. A heavier instrument reduces available delta-v; an increased load reduces battery margin; greater data generation changes storage/downlink demands; a high-gain radio adds mass, power and cost while improving the range-limited rate. Regression tests check these numerical relationships.
