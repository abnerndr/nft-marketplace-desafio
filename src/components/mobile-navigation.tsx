import { Link } from "@tanstack/react-router";
import accountIcon from "@/assets/mobile-nav/account.svg";
import background from "@/assets/mobile-nav/background.svg";
import cartIcon from "@/assets/mobile-nav/cart.svg";
import center from "@/assets/mobile-nav/center.svg";
import heartIcon from "@/assets/mobile-nav/heart.svg";
import homeIcon from "@/assets/mobile-nav/home.svg";
import scanBottomLeft from "@/assets/mobile-nav/scan-bottom-left.svg";
import scanBottomRight from "@/assets/mobile-nav/scan-bottom-right.svg";
import scanLine from "@/assets/mobile-nav/scan-line.svg";
import scanTopLeft from "@/assets/mobile-nav/scan-top-left.svg";
import scanTopRight from "@/assets/mobile-nav/scan-top-right.svg";
import { useCartCount } from "@/features/cart/api";
import { useSession } from "@/features/auth/session";

const itemClass = "pointer-events-auto absolute top-[59px] flex size-11 -translate-x-1/2 items-center justify-center rounded-full focus-visible:outline-2 focus-visible:outline-primary";

/** Navegação fixa do início mobile, com área de toque independente do fundo decorativo. */
export function MobileNavigation() {
  const cartCount = useCartCount();
  const session = useSession();
  const accountTo = session.data ? "/account/profile" : "/login";

  return (
    <nav aria-label="Navegação mobile" className="pointer-events-none fixed inset-x-0 bottom-0 z-40 lg:hidden">
      <div className="relative mx-auto h-[calc(126px+env(safe-area-inset-bottom))] max-w-[480px]">
        <div
          aria-hidden="true"
          className="absolute -left-[30px] -right-[30px] bottom-[-20px] h-[155px] bg-[length:100%_100%] bg-no-repeat"
          style={{ backgroundImage: `url("${background}")` }}
        />
        <div className="absolute inset-x-0 bottom-[env(safe-area-inset-bottom)] h-[126px]">
          <Link to="/" aria-label="Início" aria-current="page" className={`${itemClass} left-[11.1%]`}>
            <img src={homeIcon} alt="" />
          </Link>

          <Link to="/" hash="catalogo" aria-label="Favoritos (use o coração nos cards do catálogo)" className={`${itemClass} left-[28.5%]`}>
            <img src={heartIcon} alt="" />
          </Link>

          <Link to="/" hash="catalogo" aria-label="Explorar catálogo" className="pointer-events-auto absolute left-1/2 top-0 flex size-[65px] -translate-x-1/2 items-center justify-center rounded-full focus-visible:outline-2 focus-visible:outline-primary">
            <img src={center} alt="" className="absolute left-0 top-0" />
            <span aria-hidden="true" className="absolute left-1/2 top-[21px] h-[24px] w-[27px] -translate-x-1/2">
              <img src={scanTopLeft} alt="" className="absolute left-[1px] top-0" />
              <img src={scanTopRight} alt="" className="absolute right-[1px] top-0" />
              <img src={scanLine} alt="" className="absolute left-0 top-[11px]" />
              <img src={scanBottomLeft} alt="" className="absolute bottom-0 left-[1px]" />
              <img src={scanBottomRight} alt="" className="absolute bottom-0 right-[1px]" />
            </span>
          </Link>

          <Link to="/cart" aria-label="Carrinho" className={`${itemClass} left-[72.9%]`}>
            <img src={cartIcon} alt="" />
            {cartCount > 0 ? (
              <span className="absolute right-0 top-0 flex size-4 items-center justify-center rounded-full bg-primary text-[9px] font-bold text-ink">{cartCount}</span>
            ) : null}
          </Link>

          <Link to={accountTo} aria-label="Conta" className={`${itemClass} left-[88%]`}>
            <img src={accountIcon} alt="" />
          </Link>
        </div>
      </div>
    </nav>
  );
}
