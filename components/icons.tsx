import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import type { IconDefinition } from "@fortawesome/fontawesome-svg-core";
import { faArrowLeft, faArrowsRotate, faBagShopping, faBars, faBoxOpen, faCalendarDays, faCircleCheck, faEye, faEyeSlash, faFileLines, faFilterCircleXmark, faFloppyDisk, faGaugeHigh, faGear, faGraduationCap, faLock, faMagnifyingGlass, faMinus, faPause, faPen, faPlay, faPlus, faPrint, faReceipt, faRightFromBracket, faRightToBracket, faSpinner, faTags, faTrashCan, faUsers, faWallet, faXmark } from "@fortawesome/free-solid-svg-icons";

type IconProps = { size?: number; className?: string };
function createIcon(icon: IconDefinition) {
  return function Icon({ size = 18, className = "" }: IconProps) {
    return <FontAwesomeIcon icon={icon} aria-hidden="true" className={`inline-block shrink-0 align-middle ${className}`} style={{ width: size, height: size }} />;
  };
}

export const Eye = createIcon(faEye);
export const EyeOff = createIcon(faEyeSlash);
export const LockKeyhole = createIcon(faLock);
export const Plus = createIcon(faPlus);
export const RefreshCw = createIcon(faArrowsRotate);
export const Printer = createIcon(faPrint);
export const Pencil = createIcon(faPen);
export const Trash2 = createIcon(faTrashCan);
export const Search = createIcon(faMagnifyingGlass);
export const ShoppingBag = createIcon(faBagShopping);
export const Minus = createIcon(faMinus);
export const CheckCircle2 = createIcon(faCircleCheck);
export const ArrowLeft = createIcon(faArrowLeft);
export const Wallet = createIcon(faWallet);
export const Package = createIcon(faBoxOpen);
export const ReceiptText = createIcon(faReceipt);
export const LayoutDashboard = createIcon(faGaugeHigh);
export const Users = createIcon(faUsers);
export const GraduationCap = createIcon(faGraduationCap);
export const CalendarDays = createIcon(faCalendarDays);
export const LogOut = createIcon(faRightFromBracket);
export const Menu = createIcon(faBars);
export const X = createIcon(faXmark);
export const LoaderCircle = createIcon(faSpinner);
export const Save = createIcon(faFloppyDisk);
export const Login = createIcon(faRightToBracket);
export const Clear = createIcon(faFilterCircleXmark);
export const Details = createIcon(faFileLines);
export const Tags = createIcon(faTags);
export const Settings = createIcon(faGear);
export const Pause = createIcon(faPause);
export const Play = createIcon(faPlay);
