import {
  Award,
  Banknote,
  Briefcase,
  Building2,
  Calendar,
  ChevronsUpDown,
  FileText,
  Globe,
  Hash,
  IdCard,
  Link as LinkIcon,
  Lock,
  Mail,
  MapPin,
  Pencil,
  Phone,
  Search,
  User,
  type LucideIcon,
} from 'lucide-react';

/**
 * Centrally picks a tasteful leading icon for a form field, so inputs/selects can be
 * icon-styled everywhere without hand-annotating each field. Inference order:
 *   1. the input `type` (most reliable)
 *   2. a keyword match against the field `name` / `placeholder`
 *   3. a neutral fallback (per field kind)
 */
type FieldKind = 'input' | 'select';

interface GuessArgs {
  type?: string;
  name?: string;
  placeholder?: string;
  kind?: FieldKind;
}

const BY_TYPE: Record<string, LucideIcon> = {
  email: Mail,
  password: Lock,
  tel: Phone,
  date: Calendar,
  'datetime-local': Calendar,
  month: Calendar,
  number: Hash,
  search: Search,
  url: LinkIcon,
};

// Ordered: first matching keyword wins. Keep specific terms before generic ones.
const BY_KEYWORD: Array<[RegExp, LucideIcon]> = [
  [/email/, Mail],
  [/password|secret/, Lock],
  [/phone|mobile|whatsapp|tel/, Phone],
  [/org|company|business|employer|crèche|creche/, Building2],
  [/country/, Globe],
  [/location|city|address|state|region/, MapPin],
  [/salary|pay|amount|fee|price|rate|cost|budget|wage/, Banknote],
  [/title|role|position|job/, Briefcase],
  [/deadline|expiry|expires|\bdob\b|birth|\bdate\b/, Calendar],
  [/search|query|^q$/, Search],
  [/url|website|link/, LinkIcon],
  [/openings|quantity|count|hours|number|amount|age/, Hash],
  [/description|notes|details|bio|reason|summary|message/, FileText],
  [/cert|certificate|licen|award|qualification/, Award],
  [/nin|passport|document|^id$|identity|voter/, IdCard],
  [/name/, User],
];

export function guessFieldIcon({ type, name, placeholder, kind = 'input' }: GuessArgs): LucideIcon {
  if (type && BY_TYPE[type]) return BY_TYPE[type];

  const haystack = `${name ?? ''} ${placeholder ?? ''}`.toLowerCase();
  if (haystack.trim()) {
    for (const [re, icon] of BY_KEYWORD) {
      if (re.test(haystack)) return icon;
    }
  }

  return kind === 'select' ? ChevronsUpDown : Pencil;
}
