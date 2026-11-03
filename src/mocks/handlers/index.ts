import { authHandlers } from "./auth";
import { cartHandlers } from "./cart";
import { favoriteHandlers } from "./favorites";
import { healthHandlers } from "./health";
import { nftHandlers } from "./nfts";
import { orderHandlers } from "./orders";
import { quoteHandlers } from "./quote";
import { scenarioHandlers } from "./scenario";
import { walletHandlers } from "./wallets";

// A ordem importa: o handler de cenário precisa vir antes dos handlers de rota.
export const handlers = [...scenarioHandlers, ...healthHandlers, ...authHandlers, ...nftHandlers, ...cartHandlers, ...quoteHandlers, ...walletHandlers, ...orderHandlers, ...favoriteHandlers];
