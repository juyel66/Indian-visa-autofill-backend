export interface SectionDefinition {
  id: string;
  title: string;
  description: string;
  iconName: string;
}

export const APPLICATION_SECTIONS: SectionDefinition[] = [
  {
    id: 'registration',
    title: 'Registration',
    description: 'Mission, nationality, and service selection',
    iconName: 'FileText',
  },
  {
    id: 'basic_details',
    title: 'Basic Details',
    description: 'Personal identity, name, birth, and citizenship information',
    iconName: 'User',
  },
  {
    id: 'family_details',
    title: 'Family Details',
    description: 'Parents, marital status, and spouse details',
    iconName: 'Users',
  },
  {
    id: 'present_address',
    title: 'Present Address',
    description: 'Current residential address and contact details',
    iconName: 'Home',
  },
  {
    id: 'permanent_address',
    title: 'Permanent Address',
    description: 'Permanent domicile address',
    iconName: 'MapPin',
  },
  {
    id: 'passport',
    title: 'Passport',
    description: 'Passport credentials, issue/expiry dates, and travel documents',
    iconName: 'BookOpen',
  },
  {
    id: 'employment',
    title: 'Employment',
    description: 'Occupation, employer details, and military background',
    iconName: 'Briefcase',
  },
  {
    id: 'visa',
    title: 'Visa & References',
    description: 'Stay duration, entry points, and references in India / home country',
    iconName: 'Compass',
  },
  {
    id: 'additional_questions',
    title: 'Additional Questions',
    description: 'Travel history, SAARC visits, and declarations',
    iconName: 'HelpCircle',
  },
  {
    id: 'metadata',
    title: 'Metadata & Source',
    description: 'System timestamps, confidence scores, and provenance',
    iconName: 'Database',
  },
];

// Mapping of known canonical Indian visa form field keys to their display labels
export const FIELD_LABELS: Record<string, string> = {
  // Registration
  'appl.country_name': 'Country / Region Applying From',
  'appl.mission_code': 'Indian Mission / Office',
  'appl.nationality_name': 'Nationality / Region',
  'appl.dob': 'Date of Birth',
  'appl.email_id': 'Email Address',
  'appl.exp_arrival_date': 'Expected Date of Arrival',
  'appl.visa_type': 'Visa Service / Type',
  'appl.purpose_of_visit': 'Purpose of Visit',

  // Basic Details
  'appl.surname': 'Surname',
  'appl.applname': 'Given Name(s)',
  'appl.prev_name': 'Previous Name',
  'appl.prev_surname': 'Previous Surname',
  'appl.sex': 'Gender',
  'appl.gender': 'Gender',
  'appl.pob': 'Town / City of Birth',
  'appl.cob': 'Country of Birth',
  'appl.citizenship_national_id_no': 'National ID / Citizenship No',
  'appl.religion': 'Religion',
  'appl.visible_mark': 'Visible Identification Marks',
  'appl.edu': 'Educational Qualification',
  'appl.acquire_nationality': 'Nationality Mode (Birth / Naturalization)',
  'appl.prev_nationality': 'Previous Nationality',

  // Family Details
  'appl.father_name': "Father's Full Name",
  'appl.father_nationality': "Father's Nationality",
  'appl.father_prev_nationality': "Father's Previous Nationality",
  'appl.father_pob': "Father's Place of Birth",
  'appl.father_cob': "Father's Country of Birth",
  'appl.mother_name': "Mother's Full Name",
  'appl.mother_nationality': "Mother's Nationality",
  'appl.mother_prev_nationality': "Mother's Previous Nationality",
  'appl.mother_pob': "Mother's Place of Birth",
  'appl.mother_cob': "Mother's Country of Birth",
  'appl.marital_status': 'Marital Status',
  'appl.spouse_name': "Spouse's Full Name",
  'appl.spouse_nationality': "Spouse's Nationality",
  'appl.spouse_prev_nationality': "Spouse's Previous Nationality",
  'appl.spouse_pob': "Spouse's Place of Birth",
  'appl.spouse_cob': "Spouse's Country of Birth",
  'appl.grandparent_pak_flag': 'Grandparents Pakistan Origin',
  'appl.grandparent_pak_details': 'Grandparent Origin Details',

  // Present Address
  'appl.pres_addr_line1': 'House / Street / Address Line',
  'appl.pres_city': 'Village / Town / City',
  'appl.pres_state': 'State / Province / District',
  'appl.pres_pincode': 'Postal / ZIP Code',
  'appl.pres_phone_no': 'Phone Number',
  'appl.pres_mobile_no': 'Mobile Number',

  // Permanent Address
  'appl.perm_addr_line1': 'Permanent Address Line',
  'appl.perm_city': 'City / Town',
  'appl.perm_state': 'State / Province',
  'appl.perm_pincode': 'Postal / ZIP Code',

  // Passport
  'appl.passno': 'Passport Number',
  'appl.place_of_issue': 'Place of Issue',
  'appl.issue_date': 'Date of Issue',
  'appl.exp_date': 'Date of Expiry',
  'appl.other_pass_held': 'Other Valid Passport Held',
  'appl.other_pass_no': 'Other Passport Number',
  'appl.other_pass_issue_place': 'Other Passport Place of Issue',
  'appl.other_pass_issue_date': 'Other Passport Issue Date',
  'appl.other_pass_nationality': 'Other Passport Nationality',

  // Employment
  'appl.occupation': 'Present Occupation',
  'appl.emp_name': 'Employer / Business Name',
  'appl.emp_designation': 'Designation / Rank',
  'appl.emp_addr': 'Employer Address',
  'appl.emp_phone': 'Employer Phone',
  'appl.past_occupation': 'Past Occupation',
  'appl.military_service': 'Military / Police / Security Service',
  'appl.military_org': 'Military / Police Organization',
  'appl.military_designation': 'Rank / Designation in Service',
  'appl.military_place': 'Place of Posting',

  // Visa
  'appl.places_to_visit': 'Places to Visit in India',
  'appl.visa_duration_months': 'Duration of Visa (Months)',
  'appl.no_of_entries': 'Number of Entries',
  'appl.port_of_arrival': 'Port of Arrival',
  'appl.port_of_exit': 'Expected Port of Exit',
  'appl.prev_visit_details': 'Previous Visit to India',
  'appl.prev_visa_no': 'Previous Visa Number',
  'appl.prev_visa_type': 'Previous Visa Type',
  'appl.prev_visa_issue_place': 'Previous Visa Issue Place',
  'appl.prev_visa_issue_date': 'Previous Visa Issue Date',
  'appl.ref_name_india': 'Reference Name in India',
  'appl.ref_addr_india': 'Address of Reference in India',
  'appl.ref_phone_india': 'Phone of Reference in India',
  'appl.ref_name_home': 'Reference Name in Home Country',
  'appl.ref_addr_home': 'Address of Reference in Home Country',
  'appl.ref_phone_home': 'Phone of Reference in Home Country',

  // Additional Questions
  'appl.saarc_visited': 'Visited SAARC Countries in Last 3 Years',
  'appl.saarc_details': 'SAARC Countries Visit Details',
  'appl.crime_record': 'Arrest / Conviction / Prosecution Record',
  'appl.crime_details': 'Crime Record Details',
  'appl.visa_refused': 'Ever Refused Indian Visa or Entry',
  'appl.visa_refused_details': 'Visa Refusal Details',
};

// Section categorizer function
export function getSectionForFieldKey(key: string): string {
  const k = key.toLowerCase();

  // Registration
  if (
    k.includes('mission') ||
    k.includes('visatype') ||
    k.includes('visa_type') ||
    k.includes('applying_from') ||
    k.includes('country_name') ||
    k.includes('nationality_name')
  ) {
    return 'registration';
  }

  // Present Address
  if (k.includes('pres_') || k.includes('present_addr') || k.includes('current_addr')) {
    return 'present_address';
  }

  // Permanent Address
  if (k.includes('perm_') || k.includes('permanent_addr')) {
    return 'permanent_address';
  }

  // Family
  if (
    k.includes('father') ||
    k.includes('mother') ||
    k.includes('spouse') ||
    k.includes('marital') ||
    k.includes('grandparent') ||
    k.includes('family')
  ) {
    return 'family_details';
  }

  // Passport
  if (k.includes('pass') || k.includes('mrz') || k.includes('issue_date') || k.includes('exp_date')) {
    return 'passport';
  }

  // Employment
  if (
    k.includes('emp_') ||
    k.includes('occup') ||
    k.includes('business') ||
    k.includes('military') ||
    k.includes('salary')
  ) {
    return 'employment';
  }

  // Visa & References
  if (
    k.includes('visa') ||
    k.includes('visit') ||
    k.includes('arrival') ||
    k.includes('exit') ||
    k.includes('ref_') ||
    k.includes('port_')
  ) {
    return 'visa';
  }

  // Additional
  if (
    k.includes('saarc') ||
    k.includes('crime') ||
    k.includes('arrest') ||
    k.includes('refus') ||
    k.includes('deport') ||
    k.includes('question')
  ) {
    return 'additional_questions';
  }

  // Metadata
  if (
    k.includes('created') ||
    k.includes('updated') ||
    k.includes('status') ||
    k.includes('provenance') ||
    k.includes('confidence') ||
    k.includes('source')
  ) {
    return 'metadata';
  }

  // Basic Details default for name, dob, gender, religion, birth, etc.
  return 'basic_details';
}

// Convert camelCase or dot.separated to Title Case
export function formatFieldLabel(key: string): string {
  if (FIELD_LABELS[key]) {
    return FIELD_LABELS[key];
  }

  const cleanKey = key.replace(/^appl\./, '');
  return cleanKey
    .replace(/[._-]+/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
