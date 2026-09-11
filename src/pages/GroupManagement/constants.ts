export interface CandidateMember {
  id: string;
  name: string;
  callsign: string;
}

export const CANDIDATE_MEMBERS: CandidateMember[] = [
  { id: 'U-001', name: 'Col. Sarah Connor', callsign: 'alpha-01' },
  { id: 'U-002', name: 'Maj. John Doe', callsign: 'bravo-01' },
  { id: 'U-003', name: 'Capt. Alex Vance', callsign: 'charlie-01' },
  { id: 'U-004', name: 'Lt. Marcus Wright', callsign: 'delta-01' },
  { id: 'U-005', name: 'Sgt. Frank Miller', callsign: 'falcon-03' },
  { id: 'U-006', name: 'Cpt. Ellen Ripley', callsign: 'eagle-01' },
  { id: 'U-007', name: 'Maj. Alan Schaefer', callsign: 'defender-02' },
];

export const ADMIN_OPTIONS = [
  'Col. Sarah Connor',
  'Maj. John Doe',
  'Capt. Alex Vance',
  'Lt. Marcus Wright',
];
