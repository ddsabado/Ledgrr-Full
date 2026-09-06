import { QueryClient } from '@tanstack/react-query'

/**
 * Singleton QueryClient instance.
 *
 * Defined in its own module (not in main.tsx) so that collection files
 * can import it without creating a circular dependency:
 *   main.tsx → App → ... → collections → queryClient ← main.tsx  ✗
 *   main.tsx → App → ... → collections → lib/queryClient          ✓
 */
export const queryClient = new QueryClient()
