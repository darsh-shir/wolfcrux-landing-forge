/**
 * Ex-employees and closed trading accounts, stored in existing fields so no
 * database change is needed:
 *  - an ex-employee keeps their profile and every record; profiles.employee_role
 *    is set to "ex_employee" and their sign-in is blocked on the server.
 *  - a closed trading account keeps its trades; its name starts with "[Closed] ".
 */
export const EX_EMPLOYEE_ROLE = "ex_employee";
export const CLOSED_PREFIX = "[Closed] ";

export const isExEmployee = (p: { employee_role?: string | null } | null | undefined) =>
  (p?.employee_role || "").toLowerCase() === EX_EMPLOYEE_ROLE;

export const isClosedAccount = (a: { account_name?: string | null } | null | undefined) =>
  (a?.account_name || "").startsWith(CLOSED_PREFIX);

/** Account name without the closed marker. */
export const accountLabel = (a: { account_name?: string | null } | null | undefined) =>
  (a?.account_name || "").replace(CLOSED_PREFIX, "");
