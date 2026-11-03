import { healthHandlers } from "./health";
import { scenarioHandlers } from "./scenario";

// A ordem importa: o handler de cenário precisa vir antes dos handlers de rota.
export const handlers = [...scenarioHandlers, ...healthHandlers];
