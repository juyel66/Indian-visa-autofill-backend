/**
 * Formats applicant display name strictly adhering to: Given Name + Surname.
 * Example: Given Name: SHREE JOTIMOY, Surname: RAY -> Display: SHREE JOTIMOY RAY
 */
export function formatApplicantDisplayName(givenName?: string | null, surname?: string | null): string {
  const given = (givenName || '').trim();
  const sur = (surname || '').trim();
  return [given, sur].filter(Boolean).join(' ').trim() || 'Unnamed Applicant';
}

/**
 * Extracts and formats applicant names according to Bangladesh/Indian visa conventions:
 * Display Name must always be: Given Name + Surname
 * Example: SHREE JOTIMOY RAY (NOT: RAY SHREE JOTIMOY)
 */
export function extractApplicantNames(
  applicationData: any,
  storedApplicantName?: string | null
): {
  givenName: string;
  surname: string;
  fullName: string;
} {
  let givenName = '';
  let surname = '';

  if (applicationData && typeof applicationData === 'object') {
    const fields = applicationData.fields || applicationData;

    if (fields && typeof fields === 'object') {
      const rawSurname =
        fields['appl.surname']?.value ??
        fields['surname']?.value ??
        fields['appl.surname'] ??
        fields['surname'];
      if (typeof rawSurname === 'string') surname = rawSurname.trim();

      const rawGivenName =
        fields['appl.applname']?.value ??
        fields['appl.name']?.value ??
        fields['givenName']?.value ??
        fields['applname']?.value ??
        fields['appl.applname'] ??
        fields['appl.name'];
      if (typeof rawGivenName === 'string') givenName = rawGivenName.trim();
    }
  }

  // Fallback if individual fields are not found but a composite name was stored
  if (!givenName && !surname && storedApplicantName) {
    const parts = storedApplicantName.trim().split(/\s+/);
    if (parts.length > 1) {
      givenName = parts.slice(0, -1).join(' ');
      surname = parts[parts.length - 1];
    } else {
      givenName = storedApplicantName.trim();
    }
  }

  // Construct display format: Given Name + Surname
  const fullName =
    [givenName, surname].filter(Boolean).join(' ').trim() ||
    storedApplicantName?.trim() ||
    'Unnamed Applicant';

  return {
    givenName,
    surname,
    fullName,
  };
}
