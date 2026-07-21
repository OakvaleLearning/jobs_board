import { redirect } from 'next/navigation';

// §5: route groups consolidated into /employer/*. Kept as a back-compat
// redirect for bookmarked URLs.
export default function LegacyCorporateRedirect() {
  redirect('/employer/dashboard');
}
